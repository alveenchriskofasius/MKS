using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class PurchaseReturnRepository : BaseRepository, IPurchaseReturnRepository
{
    private readonly API.Services.IStockLedgerService _stockLedger;
    private const short PR_Draft = 1;
    private const short PR_Submitted = 2;
    private const short PR_Approved = 3;
    private const short PR_Rejected = 4;

    public PurchaseReturnRepository(MKSTableContext ctx, IHttpContextAccessor http) : base(ctx, http) { }

    public PurchaseReturnRepository(MKSTableContext ctx, IHttpContextAccessor http, API.Services.IStockLedgerService stockLedger) : base(ctx, http)
    {
        _stockLedger = stockLedger;
    }

    public async Task<object> ChangeStatus(int id, short statusId, string? reason)
    {
        try
        {
            var trade = await _context.Trades.FindAsync(id);
            if (trade == null) return new { success = false, result = "Purchase Return not found." };

            var current = trade.StatusID ?? PR_Draft;
            if (statusId == current) return new { success = true, statusID = current };

            bool allowed = (current, statusId) switch
            {
                (PR_Draft, PR_Submitted) => true,
                (PR_Submitted, PR_Approved) => true,
                (PR_Submitted, PR_Rejected) => true,
                (PR_Rejected, PR_Submitted) => true,
                _ => false
            };

            if (!allowed)
                return new { success = false, result = $"Invalid status transition: {current} -> {statusId}" };

            trade.StatusID = statusId;
            trade.UpdatedAt = DateTime.Now;
            trade.UpdatedBy = GetCurrentUserName();
            if (!string.IsNullOrWhiteSpace(reason))
                trade.Note = reason;

            // Deduct stock only when transitioning to Approved
            if (statusId == PR_Approved)
            {
                var items = await _context.PurchaseReturnItems.Where(i => i.TradeID == id).ToListAsync();
                foreach (var item in items)
                {
                    var prod = await _context.Products.FindAsync(item.ProductID);
                    if (prod != null)
                    {
                        if (item.Quantity > prod.StockQuantity)
                            return new { success = false, result = $"Qty for {prod.Name} ({item.Quantity}) exceeds available stock ({prod.StockQuantity})." };
                        prod.StockQuantity -= item.Quantity;
                        _context.Products.Update(prod);
                        await WriteLedgerSafe(prod.ID, -item.Quantity, trade);
                    }
                }
            }

            _context.Trades.Update(trade);
            await SaveChangesAsync();

            return new { success = true, statusID = trade.StatusID };
        }
        catch (Exception e)
        {
            return CreateErrorResponse(e);
        }
    }

    public async Task<PurchaseReturnModel> FillForm(int id)
    {
        if (id == 0) return new PurchaseReturnModel();
        var t = await _context.Trades.FindAsync(id);
        if (t == null) return new PurchaseReturnModel();
        var details = await _context.PurchaseReturnItems.Where(i => i.TradeID == id).ToListAsync();
        return new PurchaseReturnModel
        {
            ID = t.ID,
            Date = t.Date,
            No = t.No,
            SupplierID = t.CustomerID ?? 0,
            PurchaseOrderID = t.PurchaseOrderID,
            Note = t.Note,
            Amount = t.Amount,
            StatusID = t.StatusID,
            Details = details.Select(d => new PurchaseReturnDetailModel
            {
                ID = d.ID,
                ProductID = d.ProductID,
                ProductName = _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.Name).FirstOrDefault(),
                VariantID = d.VariantID,
                Quantity = d.Quantity,
                UnitPrice = _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.UnitPrice).FirstOrDefault()
            }).ToList()
        };
    }

    public async Task<object> GetApprovedPOsForReturn()
    {
        // Return POs that are Approved (status 3) AND have at least one Verified Stock In (TradeTypeID=3, status>=3)
        var approvedPOIds = await _context.Trades
            .Where(t => t.TradeTypeID == 1 && t.StatusID == 3)
            .Select(t => t.ID)
            .ToListAsync();

        var poIdsWithVerifiedSI = await _context.Trades
            .Where(t => t.TradeTypeID == 3 && t.StatusID >= 3 && t.PurchaseOrderID != null && approvedPOIds.Contains(t.PurchaseOrderID.Value))
            .Select(t => t.PurchaseOrderID!.Value)
            .Distinct()
            .ToListAsync();

        var result = await _context.Trades
            .Where(t => poIdsWithVerifiedSI.Contains(t.ID))
            .OrderByDescending(t => t.ID)
            .Select(t => new
            {
                id = t.ID,
                no = t.No,
                date = t.Date.ToString("yyyy-MM-dd"),
                supplierName = _context.Customers.Where(c => c.ID == t.CustomerID).Select(c => c.Name).FirstOrDefault() ?? "-"
            })
            .ToListAsync();

        return result;
    }

    public async Task<object> GetPOItemsForReturn(int poId)
    {
        var items = await _context.PurchaseOrderItems
            .Where(i => i.TradeID == poId)
            .ToListAsync();
        var productIds = items.Select(i => i.ProductID ?? 0).Where(id => id > 0).Distinct().ToList();
        var products = await _context.Products
            .Where(p => productIds.Contains(p.ID))
            .ToDictionaryAsync(p => p.ID, p => new { p.Name, p.UnitPrice });
        var variantIds = items
            .Where(i => i.VariantID.HasValue && i.VariantID.Value > 0)
            .Select(i => i.VariantID!.Value)
            .Distinct()
            .ToList();
        var variants = variantIds.Count > 0
            ? await _context.ProductVariants
                .Where(v => variantIds.Contains(v.ID))
                .ToDictionaryAsync(v => v.ID, v => v.Name)
            : new Dictionary<int, string>();
        var result = items.Select(i =>
        {
            int pid = i.ProductID ?? 0;
            var prod = pid > 0 && products.ContainsKey(pid) ? products[pid] : null;
            int vid = i.VariantID ?? 0;
            return new
            {
                id = 0,
                productID = pid,
                product = prod?.Name ?? "-",
                variantID = vid,
                variantName = vid > 0 && variants.ContainsKey(vid) ? variants[vid] : "",
                quantity = i.Quantity,
                unitPrice = prod?.UnitPrice ?? 0m,
                subTotal = (prod?.UnitPrice ?? 0m) * i.Quantity
            };
        }).ToList();
        return result;
    }

    public async Task<object> GetSearchList() { var list = await _context.Trades.Where(t => t.TradeTypeID == 6).OrderByDescending(t => t.ID).Select(t => new { id = t.ID, no = t.No, date = t.Date.ToString("yyyy-MM-dd"), amount = t.Amount, statusID = t.StatusID, supplier = _context.Customers.Where(c => c.ID == t.CustomerID).Select(c => c.Name).FirstOrDefault() ?? "-" }).ToListAsync(); return list; }
    public async Task<object> GetDetailList(int id)
    {
        var details = await _context.PurchaseReturnItems.Where(i => i.TradeID == id).ToListAsync();
        var variantIds = details.Where(d => d.VariantID.HasValue && d.VariantID.Value > 0).Select(d => d.VariantID!.Value).Distinct().ToList();
        var variantMap = variantIds.Count > 0
            ? await _context.ProductVariants.Where(v => variantIds.Contains(v.ID)).ToDictionaryAsync(v => v.ID, v => v.Name)
            : new Dictionary<int, string>();
        return details.Select(d =>
        {
            int vid = d.VariantID ?? 0;
            return new
            {
                id = d.ID,
                productID = d.ProductID,
                product = _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.Name).FirstOrDefault(),
                variantID = vid,
                variantName = vid > 0 && variantMap.ContainsKey(vid) ? variantMap[vid] : "",
                quantity = d.Quantity,
                unitPrice = _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.UnitPrice).FirstOrDefault(),
                subTotal = d.Quantity * _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.UnitPrice).FirstOrDefault()
            };
        }).ToList();
    }
    private async Task<string> GenerateNo(DateTime date) { string prefix = "PR" + date.ToString("yyMMdd"); int seq = await _context.Trades.CountAsync(x => x.TradeTypeID == 6 && x.Date == date.Date) + 1; return prefix + seq.ToString("D3"); }
    public async Task<object> Save(PurchaseReturnModel model)
    {
        try
        {
            model.Details ??= new();

            // Validate PO is required and must be Approved with at least one Verified Stock In
            if (model.PurchaseOrderID == null || model.PurchaseOrderID == 0)
                return new { success = false, result = "Purchase Order is required. Please select an Approved PO with a verified Stock In." };

            var po = await _context.Trades.FindAsync(model.PurchaseOrderID.Value);
            if (po == null)
                return new { success = false, result = "Selected Purchase Order not found." };
            if ((po.StatusID ?? 1) != 3)
                return new { success = false, result = "Selected Purchase Order must have Approved status." };

            var hasVerifiedSI = await _context.Trades
                .AnyAsync(t => t.PurchaseOrderID == model.PurchaseOrderID && t.TradeTypeID == 3 && t.StatusID >= 3);
            if (!hasVerifiedSI)
                return new { success = false, result = "Selected Purchase Order does not have a Verified Stock In." };

            Trade trade;
            var user = GetCurrentUserName();
            if (model.ID == 0)
            {
                trade = new Trade { Date = model.Date, No = await GenerateNo(model.Date), TradeTypeID = 6, StatusID = 1, CustomerID = po.CustomerID, PurchaseOrderID = model.PurchaseOrderID, Note = model.Note, Amount = model.Details.Sum(d => d.Subtotal), CreatedAt = DateTime.Now, CreatedBy = user };
                await _context.Trades.AddAsync(trade);
                await SaveChangesAsync();
            }
            else
            {
                trade = await _context.Trades.FindAsync(model.ID) ?? throw new Exception("Purchase Return not found");
                trade.Date = model.Date;
                trade.CustomerID = po.CustomerID;
                trade.PurchaseOrderID = model.PurchaseOrderID;
                trade.Note = model.Note;
                trade.Amount = model.Details.Sum(d => d.Subtotal);
                trade.UpdatedAt = DateTime.Now;
                trade.UpdatedBy = user;
                await SaveChangesAsync();
            }

            int tradeID = trade.ID;
            var incomingIds = model.Details.Where(d => d.ID > 0).Select(d => d.ID).ToHashSet();
            var existing = await _context.PurchaseReturnItems.Where(i => i.TradeID == tradeID).ToListAsync();
            var del = existing.Where(x => !incomingIds.Contains(x.ID));
            if (del.Any()) { _context.PurchaseReturnItems.RemoveRange(del); await SaveChangesAsync(); }

            foreach (var d in model.Details)
            {
                if (d.Quantity <= 0) return new { success = false, result = "Qty must >0" };
                var prod = await _context.Products.FindAsync(d.ProductID);
                if (prod != null && d.Quantity > prod.StockQuantity)
                    return new { success = false, result = $"Qty for {prod.Name} ({d.Quantity}) exceeds available stock ({prod.StockQuantity})." };
                if (d.ID == 0)
                {
                    var item = new PurchaseReturnItem { TradeID = tradeID, ProductID = d.ProductID, Quantity = d.Quantity, VariantID = d.VariantID };
                    await _context.PurchaseReturnItems.AddAsync(item);
                }
                else
                {
                    var item = await _context.PurchaseReturnItems.FindAsync(d.ID);
                    if (item == null) return new { success = false, result = "Detail not found" };
                    item.ProductID = d.ProductID; item.Quantity = d.Quantity; item.VariantID = d.VariantID; _context.PurchaseReturnItems.Update(item);
                }
            }
            await SaveChangesAsync();
            return new { success = true, id = trade.ID, no = trade.No };
        }
        catch (Exception ex) { return CreateErrorResponse(ex); }
    }

    private async Task WriteLedgerSafe(int productId, int qtyChange, Trade? trade)
    {
        if (_stockLedger == null || qtyChange == 0) return;
        try
        {
            await _stockLedger.WriteAsync(productId, qtyChange, "PurchaseReturn", trade?.ID, trade?.No);
        }
        catch { }
    }
    public async Task<object> Delete(int id) { try { var trade = await _context.Trades.FindAsync(id); if (trade == null) return new { success = false, result = "Not found" }; var details = await _context.PurchaseReturnItems.Where(i => i.TradeID == id).ToListAsync(); if ((trade.StatusID ?? PR_Draft) >= PR_Approved) { foreach (var d in details) { var prod = await _context.Products.FindAsync(d.ProductID); if (prod != null) { prod.StockQuantity += d.Quantity; _context.Products.Update(prod); } } } _context.PurchaseReturnItems.RemoveRange(details); _context.Trades.Remove(trade); await SaveChangesAsync(); return new { success = true }; } catch (Exception ex) { return CreateErrorResponse(ex); } }
    public async Task<object> DeleteItem(int id) { try { var item = await _context.PurchaseReturnItems.FindAsync(id); if (item == null) return new { success = false, result = "Item not found" }; var trade = await _context.Trades.FirstOrDefaultAsync(t => t.ID == item.TradeID); if (trade != null && (trade.StatusID ?? PR_Draft) >= PR_Approved) { var prod = await _context.Products.FindAsync(item.ProductID); if (prod != null) { prod.StockQuantity += item.Quantity; _context.Products.Update(prod); } } _context.PurchaseReturnItems.Remove(item); await SaveChangesAsync(); return new { success = true }; } catch (Exception ex) { return CreateErrorResponse(ex); } }
}
