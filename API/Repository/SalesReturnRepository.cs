using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class SalesReturnRepository : ISalesReturnRepository
{
    private readonly MKSTableContext _context; private readonly IHttpContextAccessor _http;
    public SalesReturnRepository(MKSTableContext ctx, IHttpContextAccessor http) { _context = ctx; _http = http; }

    private enum SalesOrderStatus { Draft = 1, Paid = 2, Debt = 3, PartialRefund = 4, Refund = 5, Exchange = 6, PartialExchange = 7 }

    public async Task<SalesReturnModel> FillForm(int id) => await InternalFillForm(id);
    private async Task<SalesReturnModel> InternalFillForm(int id)
    {
        if (id == 0) return new SalesReturnModel();
        var t = await _context.Trades.FindAsync(id); if (t == null) return new SalesReturnModel();
        var details = await _context.SalesReturnItems.Where(i => i.TradeID == id && !i.IsReplacement).ToListAsync();
        var replacements = await _context.SalesReturnItems.Where(i => i.TradeID == id && i.IsReplacement).ToListAsync();
        string returnType = replacements.Any() ? "Exchange" : (details.FirstOrDefault()?.ReturnType ?? "Refund");
        int? linkedSO = null; bool isLinked = false; if (!string.IsNullOrEmpty(t.Note) && t.Note.Contains("SO:")) { var parts = t.Note.Split('|'); var soPart = parts.FirstOrDefault(p => p.StartsWith("SO:")); if (soPart != null && int.TryParse(soPart.Replace("SO:", ""), out int soId)) { linkedSO = soId; isLinked = true; } }
        return new SalesReturnModel { ID = t.ID, Date = t.Date, No = t.No, CustomerID = t.CustomerID ?? 0, Note = t.Note, Amount = t.Amount, ReturnType = returnType, RefundAmount = details.Sum(d => d.RefundAmount), IsLinked = isLinked, LinkedSalesOrderID = linkedSO, Details = details.Select(d => new SalesReturnDetailModel { ID = d.ID, ProductID = d.ProductID, ProductName = _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.Name).FirstOrDefault(), Quantity = d.Quantity, UnitPrice = d.UnitPrice, IsReplacement = false, ExchangeSourceItemID = null, RefundAmount = d.RefundAmount, SourceSalesOrderItemID = d.SourceSalesOrderItemID }).ToList(), ReplacementDetails = replacements.Select(d => new SalesReturnDetailModel { ID = d.ID, ProductID = d.ProductID, ProductName = _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.Name).FirstOrDefault(), Quantity = d.Quantity, UnitPrice = d.UnitPrice, IsReplacement = true, ExchangeSourceItemID = d.ExchangeSourceItemID, RefundAmount = d.RefundAmount, SourceSalesOrderItemID = d.SourceSalesOrderItemID }).ToList() };
    }

    public async Task<object> GetSearchList() => await _context.Trades.Where(t => t.TradeTypeID == 5).OrderByDescending(t => t.ID).Select(t => new { id = t.ID, no = t.No, date = t.Date.ToString("yyyy-MM-dd"), amount = t.Amount, customer = _context.Customers.Where(c => c.ID == t.CustomerID).Select(c => c.Name).FirstOrDefault() ?? "-" }).ToListAsync();
    public async Task<object> GetDetailList(int id) { var details = await _context.SalesReturnItems.Where(i => i.TradeID == id).Select(d => new { id = d.ID, productID = d.ProductID, product = _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.Name).FirstOrDefault(), quantity = d.Quantity, unitPrice = d.UnitPrice, subTotal = d.Quantity * d.UnitPrice, isReplacement = d.IsReplacement, exchangeSourceItemID = d.ExchangeSourceItemID, returnType = d.ReturnType, refundAmount = d.RefundAmount, sourceSalesOrderItemID = d.SourceSalesOrderItemID }).ToListAsync(); return details; }
    private async Task<string> GenerateNo(DateTime date) { string prefix = "SR" + date.ToString("yyMMdd"); int seq = await _context.Trades.CountAsync(x => x.TradeTypeID == 5 && x.Date == date.Date) + 1; return prefix + seq.ToString("D3"); }

    public async Task<object> Save(SalesReturnModel model)
    {
        try
        {
            model.Details ??= new(); model.ReplacementDetails ??= new(); var user = _http.HttpContext?.User?.Identity?.Name; Trade trade; string composedNote = model.Note; if (model.IsLinked && model.LinkedSalesOrderID.HasValue) { if (string.IsNullOrEmpty(composedNote)) composedNote = ""; if (!composedNote.Contains("SO:")) composedNote = $"SO:{model.LinkedSalesOrderID}|" + composedNote; }
            if (model.ID == 0) { trade = new Trade { Date = model.Date, No = await GenerateNo(model.Date), TradeTypeID = 5, StatusID = 1, CustomerID = model.CustomerID, Note = composedNote, Amount = 0, CreatedAt = DateTime.Now, CreatedBy = user }; await _context.Trades.AddAsync(trade); await _context.SaveChangesAsync(); } else { trade = await _context.Trades.FindAsync(model.ID) ?? throw new Exception("Sales Return not found"); trade.Date = model.Date; trade.CustomerID = model.CustomerID; trade.Note = composedNote; trade.UpdatedAt = DateTime.Now; trade.UpdatedBy = user; await _context.SaveChangesAsync(); }
            int tradeID = trade.ID; var keepIds = model.Details.Where(x => x.ID > 0).Select(x => x.ID).Concat(model.ReplacementDetails.Where(r => r.ID > 0).Select(r => r.ID)).ToHashSet(); var existing = await _context.SalesReturnItems.Where(i => i.TradeID == tradeID).ToListAsync(); var toRemove = existing.Where(e => !keepIds.Contains(e.ID)).ToList(); if (toRemove.Any()) { foreach (var rem in toRemove) { var prod = await _context.Products.FindAsync(rem.ProductID); if (prod != null) { if (!rem.IsReplacement) prod.StockQuantity -= rem.Quantity; else prod.StockQuantity += rem.Quantity; _context.Products.Update(prod); } } _context.SalesReturnItems.RemoveRange(toRemove); await _context.SaveChangesAsync(); }
            Dictionary<int, int> remainingMap = new(); if (model.IsLinked && model.LinkedSalesOrderID.HasValue) { var soItemsMapSrc = await _context.SalesOrderItems.Where(x => x.TradeID == model.LinkedSalesOrderID).ToListAsync(); foreach (var si in soItemsMapSrc) { int sold = si.Quantity; int refunded = (si.QtyRefunded ?? 0); int exchanged = (si.QtyExchanged ?? 0); remainingMap[si.ID] = sold - (refunded + exchanged); } }
            foreach (var d in model.Details)
            {
                if (d.Quantity <= 0) return new { success = false, result = "Qty must > 0" }; SalesReturnItem entity; var unitPrice = d.UnitPrice; if (model.IsLinked && d.SourceSalesOrderItemID.HasValue) { if (!remainingMap.ContainsKey(d.SourceSalesOrderItemID.Value)) return new { success = false, result = "Linked SO item not found" }; int remaining = remainingMap[d.SourceSalesOrderItemID.Value]; if (d.Quantity > remaining) return new { success = false, result = $"Return qty exceeds remaining for item {d.ProductID}. Remaining: {remaining}" }; remainingMap[d.SourceSalesOrderItemID.Value] -= d.Quantity; var soItem = await _context.SalesOrderItems.FindAsync(d.SourceSalesOrderItemID.Value); if (soItem != null) { var prodPrice = await _context.Products.Where(p => p.ID == soItem.ProductID).Select(p => p.UnitPrice).FirstOrDefaultAsync(); if (prodPrice > 0) unitPrice = prodPrice; } }
                if (d.ID == 0) { entity = new SalesReturnItem { TradeID = tradeID, ProductID = d.ProductID, Quantity = d.Quantity, IsReplacement = false, ReturnType = model.ReturnType, UnitPrice = unitPrice, RefundAmount = d.RefundAmount, SourceSalesOrderItemID = d.SourceSalesOrderItemID }; await _context.SalesReturnItems.AddAsync(entity); var prod = await _context.Products.FindAsync(d.ProductID); if (prod != null && (model.ReturnType == "Refund" || (model.ReturnType == "Exchange" && model.ReturnOriginalToStock))) { prod.StockQuantity += d.Quantity; _context.Products.Update(prod); } } else { entity = await _context.SalesReturnItems.FindAsync(d.ID); if (entity == null) return new { success = false, result = "Detail not found" }; var prod = await _context.Products.FindAsync(d.ProductID); if (prod != null && (model.ReturnType == "Refund" || (model.ReturnType == "Exchange" && model.ReturnOriginalToStock))) { int diff = d.Quantity - entity.Quantity; prod.StockQuantity += diff; _context.Products.Update(prod); } entity.ProductID = d.ProductID; entity.Quantity = d.Quantity; entity.UnitPrice = unitPrice; entity.RefundAmount = d.RefundAmount; entity.ReturnType = model.ReturnType; entity.SourceSalesOrderItemID = d.SourceSalesOrderItemID; _context.SalesReturnItems.Update(entity); }
            }
            if (model.ReturnType == "Exchange") { foreach (var r in model.ReplacementDetails) { if (r.Quantity <= 0) return new { success = false, result = "Replacement qty must > 0" }; if (model.IsLinked && r.ExchangeSourceItemID == null) return new { success = false, result = "ExchangeSourceItemID required for replacement" }; SalesReturnItem entity; var unitPrice = r.UnitPrice; if (r.ID == 0) { entity = new SalesReturnItem { TradeID = tradeID, ProductID = r.ProductID, Quantity = r.Quantity, IsReplacement = true, ExchangeSourceItemID = r.ExchangeSourceItemID, ReturnType = model.ReturnType, UnitPrice = unitPrice, RefundAmount = r.RefundAmount, SourceSalesOrderItemID = r.SourceSalesOrderItemID }; await _context.SalesReturnItems.AddAsync(entity); var prod = await _context.Products.FindAsync(r.ProductID); if (prod != null) { prod.StockQuantity -= r.Quantity; _context.Products.Update(prod); } } else { entity = await _context.SalesReturnItems.FindAsync(r.ID); if (entity == null) return new { success = false, result = "Replacement detail not found" }; var prod = await _context.Products.FindAsync(r.ProductID); if (prod != null) { int diff = r.Quantity - entity.Quantity; prod.StockQuantity -= diff; _context.Products.Update(prod); } entity.ProductID = r.ProductID; entity.Quantity = r.Quantity; entity.UnitPrice = unitPrice; entity.ExchangeSourceItemID = r.ExchangeSourceItemID; entity.RefundAmount = r.RefundAmount; entity.ReturnType = model.ReturnType; entity.SourceSalesOrderItemID = r.SourceSalesOrderItemID; _context.SalesReturnItems.Update(entity); } } }
            await _context.SaveChangesAsync();
            if (model.IsLinked && model.LinkedSalesOrderID.HasValue)
            {
                var soItems = await _context.SalesOrderItems.Where(x => x.TradeID == model.LinkedSalesOrderID).ToListAsync(); if (model.ReturnType == "Refund") { foreach (var d in model.Details.Where(x => x.SourceSalesOrderItemID.HasValue)) { var soItem = soItems.FirstOrDefault(x => x.ID == d.SourceSalesOrderItemID.Value); if (soItem != null) { soItem.QtyRefunded = (soItem.QtyRefunded ?? 0) + d.Quantity; _context.SalesOrderItems.Update(soItem); } } } else if (model.ReturnType == "Exchange") { foreach (var d in model.Details.Where(x => x.SourceSalesOrderItemID.HasValue)) { var soItem = soItems.FirstOrDefault(x => x.ID == d.SourceSalesOrderItemID.Value); if (soItem != null) { soItem.QtyExchanged = (soItem.QtyExchanged ?? 0) + d.Quantity; _context.SalesOrderItems.Update(soItem); } } }
                await _context.SaveChangesAsync();
                // Status decision strictly by selected ReturnType to avoid misclassification
                short newStatus; bool? isFullQtyRefunded = null;
                if (model.ReturnType == "Exchange")
                {
                    // Use exchange coverage only
                    bool allExchangeFull = soItems.All(x => (x.QtyExchanged ?? 0) >= x.Quantity);
                    bool anyExchange = soItems.Any(x => (x.QtyExchanged ?? 0) > 0);
                    newStatus = anyExchange ? (short)(allExchangeFull ? SalesOrderStatus.Exchange : SalesOrderStatus.PartialExchange) : (short)SalesOrderStatus.Paid;
                }
                else
                { // Refund path
                    bool allRefundFull = soItems.All(x => (x.QtyRefunded ?? 0) >= x.Quantity);
                    bool anyRefund = soItems.Any(x => (x.QtyRefunded ?? 0) > 0);
                    newStatus = anyRefund ? (short)(allRefundFull ? SalesOrderStatus.Refund : SalesOrderStatus.PartialRefund) : (short)SalesOrderStatus.Paid;
                    if (anyRefund) { isFullQtyRefunded = allRefundFull ? true : soItems.Any(x => (x.QtyRefunded ?? 0) >= x.Quantity); }
                }
                var soHeader = await _context.Trades.FindAsync(model.LinkedSalesOrderID.Value); if (soHeader != null) { soHeader.StatusID = newStatus; soHeader.TotalQtySold = soItems.Sum(x => x.Quantity); soHeader.TotalQtyRefunded = soItems.Sum(x => (x.QtyRefunded ?? 0)); soHeader.IsFullQtyRefunded = isFullQtyRefunded; _context.Trades.Update(soHeader); await _context.SaveChangesAsync(); }
            }
            decimal returnedTotal = model.Details.Sum(x => x.Subtotal); decimal replacementTotal = model.ReplacementDetails.Sum(x => x.Subtotal); decimal net = replacementTotal - returnedTotal; model.RefundAmount = net; trade.Amount = returnedTotal; await _context.SaveChangesAsync(); return new { success = true, id = trade.ID, no = trade.No, netDifference = net };
        }
        catch (Exception ex) { return new { success = false, result = ex.Message }; }
    }

    public async Task<object> Delete(int id) { try { var trade = await _context.Trades.FindAsync(id); if (trade == null) return new { success = false, result = "Not found" }; var details = await _context.SalesReturnItems.Where(i => i.TradeID == id).ToListAsync(); foreach (var d in details) { var prod = await _context.Products.FindAsync(d.ProductID); if (prod != null) { if (!d.IsReplacement) prod.StockQuantity -= d.Quantity; else prod.StockQuantity += d.Quantity; _context.Products.Update(prod); } } _context.SalesReturnItems.RemoveRange(details); _context.Trades.Remove(trade); await _context.SaveChangesAsync(); return new { success = true }; } catch (Exception ex) { return new { success = false, result = ex.Message }; } }
    public async Task<object> DeleteItem(int id) { try { var item = await _context.SalesReturnItems.FindAsync(id); if (item == null) return new { success = false, result = "Item not found" }; var prod = await _context.Products.FindAsync(item.ProductID); if (prod != null) { if (!item.IsReplacement) prod.StockQuantity -= item.Quantity; else prod.StockQuantity += item.Quantity; _context.Products.Update(prod); } _context.SalesReturnItems.Remove(item); await _context.SaveChangesAsync(); return new { success = true }; } catch (Exception ex) { return new { success = false, result = ex.Message }; } }
}
