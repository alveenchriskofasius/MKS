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
            Note = t.Note,
            Amount = t.Amount,
            StatusID = t.StatusID,
            Details = details.Select(d => new PurchaseReturnDetailModel { ID = d.ID, ProductID = d.ProductID, ProductName = _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.Name).FirstOrDefault(), Quantity = d.Quantity, UnitPrice = _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.UnitPrice).FirstOrDefault() }).ToList()
        };
    }

    public async Task<object> GetSearchList() { var list = await _context.Trades.Where(t => t.TradeTypeID == 6).OrderByDescending(t => t.ID).Select(t => new { id = t.ID, no = t.No, date = t.Date.ToString("yyyy-MM-dd"), amount = t.Amount, statusID = t.StatusID, supplier = _context.Customers.Where(c => c.ID == t.CustomerID).Select(c => c.Name).FirstOrDefault() ?? "-" }).ToListAsync(); return list; }
    public async Task<object> GetDetailList(int id) { var details = await _context.PurchaseReturnItems.Where(i => i.TradeID == id).Select(d => new { id = d.ID, productID = d.ProductID, product = _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.Name).FirstOrDefault(), quantity = d.Quantity, unitPrice = _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.UnitPrice).FirstOrDefault(), subTotal = d.Quantity * _context.Products.Where(p => p.ID == d.ProductID).Select(p => p.UnitPrice).FirstOrDefault() }).ToListAsync(); return details; }
    private async Task<string> GenerateNo(DateTime date) { string prefix = "PR" + date.ToString("yyMMdd"); int seq = await _context.Trades.CountAsync(x => x.TradeTypeID == 6 && x.Date == date.Date) + 1; return prefix + seq.ToString("D3"); }
    public async Task<object> Save(PurchaseReturnModel model)
    {
        try
        {
            model.Details ??= new();
            Trade trade;
            var user = GetCurrentUserName();
            if (model.ID == 0)
            {
                trade = new Trade { Date = model.Date, No = await GenerateNo(model.Date), TradeTypeID = 6, StatusID = 1, CustomerID = model.SupplierID, Note = model.Note, Amount = model.Details.Sum(d => d.Subtotal), CreatedAt = DateTime.Now, CreatedBy = user };
                await _context.Trades.AddAsync(trade);
                await SaveChangesAsync();
            }
            else
            {
                trade = await _context.Trades.FindAsync(model.ID) ?? throw new Exception("Purchase Return not found");
                trade.Date = model.Date;
                trade.CustomerID = model.SupplierID;
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
                if (d.ID == 0)
                {
                    var item = new PurchaseReturnItem { TradeID = tradeID, ProductID = d.ProductID, Quantity = d.Quantity };
                    await _context.PurchaseReturnItems.AddAsync(item);
                }
                else
                {
                    var item = await _context.PurchaseReturnItems.FindAsync(d.ID);
                    if (item == null) return new { success = false, result = "Detail not found" };
                    item.ProductID = d.ProductID; item.Quantity = d.Quantity; _context.PurchaseReturnItems.Update(item);
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
