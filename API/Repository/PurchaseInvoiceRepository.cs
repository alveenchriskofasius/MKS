using API.Context.SP;
using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class PurchaseInvoiceRepository : IPurchaseInvoiceRepository
{
    private readonly MKSTableContext _ctx;
    private readonly MKSSPContextProcedures _sp;
    private readonly IHttpContextAccessor _http;

    private const short TradeTypePI = 6;
    private enum InvoiceStatus { Draft = 1, Issued = 2, PartiallyPaid = 3, Paid = 4, Canceled = 9 }

    public PurchaseInvoiceRepository(MKSTableContext ctx, MKSSPContextProcedures sp, IHttpContextAccessor http)
    {
        _ctx = ctx; _sp = sp; _http = http;
    }

    private async Task<string> GeneratePINoAsync(DateTime date)
    {
        try
        {
            var gen = await _sp.uspGenerateNoAsync("PI", date);
            var cand = gen.FirstOrDefault()?.NewNumber;
            if (!string.IsNullOrWhiteSpace(cand))
            {
                var exists = await _ctx.Trades.AnyAsync(t => t.No == cand);
                if (!exists) return cand;
            }
        }
        catch { }
        var datePart = date.ToString("yyMMdd");
        var prefix = $"PI{datePart}";
        var lastNo = await _ctx.Trades.AsNoTracking()
            .Where(t => t.TradeTypeID == TradeTypePI && t.No.StartsWith(prefix))
            .OrderByDescending(t => t.No)
            .Select(t => t.No)
            .FirstOrDefaultAsync();
        int next = 1;
        if (!string.IsNullOrEmpty(lastNo))
        {
            var suffix = lastNo.Substring(prefix.Length);
            if (int.TryParse(suffix, out var n)) next = n + 1;
        }
        return $"{prefix}{next:00}";
    }

    public async Task<PurchaseInvoiceModel> CreateFromPO(int purchaseOrderId)
    {
        var po = await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == purchaseOrderId && t.TradeTypeID == 4);
        if (po == null) return null;

        var poPaidAggregate = await _ctx.PaymentOuts
            .Where(p => p.PurchaseOrderID == po.ID && p.StatusID == 2)
            .SumAsync(p => (decimal?)p.Amount) ?? 0m;

        // Prevent duplicates
        var existing = await _ctx.Trades.FirstOrDefaultAsync(t => t.TradeTypeID == TradeTypePI && t.Note == $"PO:{po.ID}");
        if (existing != null)
        {
            var invPaid = Math.Min(poPaidAggregate, existing.Amount);
            short invStatus = (short)InvoiceStatus.Draft;
            if (invPaid >= existing.Amount) invStatus = (short)InvoiceStatus.Paid;
            else if (invPaid > 0) invStatus = (short)InvoiceStatus.PartiallyPaid;

            bool changed = (existing.PaidAmount ?? 0m) != invPaid || (existing.StatusID ?? 0) != invStatus;
            if (changed)
            {
                existing.PaidAmount = invPaid;
                existing.StatusID = invStatus;
                existing.UpdatedAt = DateTime.Now;
                existing.UpdatedBy = _http.HttpContext?.User?.Identity?.Name;
                await _ctx.SaveChangesAsync();
            }

            return new PurchaseInvoiceModel
            {
                ID = existing.ID,
                No = existing.No,
                Date = existing.Date,
                SupplierID = existing.CustomerID,
                StatusID = existing.StatusID,
                Amount = existing.Amount,
                PaidAmount = existing.PaidAmount ?? 0m,
                Note = existing.Note,
                PurchaseOrderID = po.ID
            };
        }

        var no = await GeneratePINoAsync(DateTime.Now.Date);
        int guard = 0;
        while (await _ctx.Trades.AnyAsync(t => t.No == no) && guard < 3)
        {
            no = await GeneratePINoAsync(DateTime.Now.Date);
            guard++;
        }

        var initPaid = Math.Min(poPaidAggregate, po.Amount);
        short initStatus = (short)InvoiceStatus.Draft;
        if (initPaid >= po.Amount) initStatus = (short)InvoiceStatus.Paid;
        else if (initPaid > 0) initStatus = (short)InvoiceStatus.PartiallyPaid;

        var inv = new Trade
        {
            No = no,
            Date = DateTime.Now.Date,
            CustomerID = po.CustomerID,
            Amount = po.Amount,
            PaidAmount = initPaid,
            StatusID = initStatus,
            TradeTypeID = TradeTypePI,
            PurchaseOrderID = po.ID,
            CreatedBy = _http.HttpContext?.User?.Identity?.Name,
            CreatedAt = DateTime.Now,
            Note = $"PO:{po.ID}"
        };
        _ctx.Trades.Add(inv);
        await _ctx.SaveChangesAsync();
        return new PurchaseInvoiceModel
        {
            ID = inv.ID,
            No = inv.No,
            Date = inv.Date,
            SupplierID = inv.CustomerID,
            StatusID = inv.StatusID,
            Amount = inv.Amount,
            PaidAmount = inv.PaidAmount ?? 0m,
            Note = inv.Note,
            PurchaseOrderID = po.ID
        };
    }

    public async Task<PurchaseInvoiceModel> Get(int id)
    {
        var t = await _ctx.Trades.AsNoTracking().FirstOrDefaultAsync(x => x.ID == id && x.TradeTypeID == TradeTypePI);
        if (t == null) return null;
        return new PurchaseInvoiceModel
        {
            ID = t.ID,
            No = t.No,
            Date = t.Date,
            SupplierID = t.CustomerID,
            StatusID = t.StatusID,
            Amount = t.Amount,
            PaidAmount = t.PaidAmount ?? 0m,
            Note = t.Note,
            PurchaseOrderID = t.PurchaseOrderID
        };
    }

    public async Task<IEnumerable<PurchaseInvoiceListItem>> List(int? supplierId, DateTime? from, DateTime? to, short? statusId)
    {
        var q = _ctx.Trades.AsNoTracking().Where(t => t.TradeTypeID == TradeTypePI);
        if (supplierId.HasValue) q = q.Where(t => t.CustomerID == supplierId);
        if (from.HasValue) q = q.Where(t => t.Date >= from);
        if (to.HasValue) q = q.Where(t => t.Date <= to);
        if (statusId.HasValue) q = q.Where(t => t.StatusID == statusId);
        var list = await q
            .OrderByDescending(t => t.Date)
            .Select(t => new PurchaseInvoiceListItem
            {
                ID = t.ID,
                No = t.No,
                Date = t.Date.ToString("yyyy-MM-dd"),
                SupplierID = t.CustomerID,
                SupplierName = _ctx.Customers.Where(c => c.ID == t.CustomerID).Select(c => c.Name).FirstOrDefault() ?? "-",
                Amount = t.Amount,
                PaidAmount = t.PaidAmount ?? 0m,
                StatusID = t.StatusID
            })
            .ToListAsync();
        return list;
    }

    public async Task<object> Issue(int id)
    {
        var t = await _ctx.Trades.FirstOrDefaultAsync(x => x.ID == id && x.TradeTypeID == TradeTypePI);
        if (t == null) return new { success = false, result = "Invoice not found" };
        t.StatusID = (short)InvoiceStatus.Issued;
        t.UpdatedAt = DateTime.Now; t.UpdatedBy = _http.HttpContext?.User?.Identity?.Name;
        await _ctx.SaveChangesAsync();
        return new { success = true };
    }

    public async Task<object> Cancel(int id)
    {
        var t = await _ctx.Trades.FirstOrDefaultAsync(x => x.ID == id && x.TradeTypeID == TradeTypePI);
        if (t == null) return new { success = false, result = "Invoice not found" };
        if ((t.PaidAmount ?? 0m) > 0) return new { success = false, result = "Cannot cancel paid invoice" };
        t.StatusID = (short)InvoiceStatus.Canceled;
        t.UpdatedAt = DateTime.Now; t.UpdatedBy = _http.HttpContext?.User?.Identity?.Name;
        await _ctx.SaveChangesAsync();
        return new { success = true };
    }

    public async Task<object> SetAmount(int id, decimal amount)
    {
        var t = await _ctx.Trades.FirstOrDefaultAsync(x => x.ID == id && x.TradeTypeID == TradeTypePI);
        if (t == null) return new { success = false, result = "Invoice not found" };
        if ((t.PaidAmount ?? 0m) > amount) return new { success = false, result = "Amount cannot be less than already paid" };
        t.Amount = amount;
        var paid = t.PaidAmount ?? 0m;
        if (paid >= t.Amount) t.StatusID = (short)InvoiceStatus.Paid;
        else if (paid > 0) t.StatusID = (short)InvoiceStatus.PartiallyPaid;
        else t.StatusID = (short)InvoiceStatus.Draft;
        t.UpdatedAt = DateTime.Now; t.UpdatedBy = _http.HttpContext?.User?.Identity?.Name;
        await _ctx.SaveChangesAsync();
        return new { success = true };
    }

    public async Task<object> ExistsForPO(int purchaseOrderId)
    {
        var exists = await _ctx.Trades.AnyAsync(t => t.TradeTypeID == TradeTypePI && t.Note == $"PO:{purchaseOrderId}");
        return new { success = true, exists };
    }
}
