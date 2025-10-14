using API.Context.SP;
using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class SalesInvoiceRepository : ISalesInvoiceRepository
{
    private readonly MKSTableContext _ctx;
    private readonly MKSSPContextProcedures _sp;
    private readonly IHttpContextAccessor _http;

    private enum InvoiceStatus { Draft = 1, Issued = 2, PartiallyPaid = 3, Paid = 4, Canceled = 9 }

    public SalesInvoiceRepository(MKSTableContext ctx, MKSSPContextProcedures sp, IHttpContextAccessor http)
    {
        _ctx = ctx; _sp = sp; _http = http;
    }

    private async Task<string> GenerateSINoAsync(DateTime date)
    {
        // Try via SP first
        try
        {
            var gen = await _sp.uspGenerateNoAsync("SI", date);
            var cand = gen.FirstOrDefault()?.NewPONumber;
            if (!string.IsNullOrWhiteSpace(cand))
            {
                var exists = await _ctx.Trades.AnyAsync(t => t.No == cand);
                if (!exists) return cand;
            }
        }
        catch { }
        // Fallback: SIyyMMddNN (NN = 2 digits rolling number)
        var datePart = date.ToString("yyMMdd");
        var prefix = $"SI{datePart}";
        var lastNo = await _ctx.Trades.AsNoTracking()
            .Where(t => t.TradeTypeID == 3 && t.No.StartsWith(prefix))
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

    public async Task<SalesInvoiceModel> CreateFromSO(int salesOrderId)
    {
        var so = await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == salesOrderId);
        if (so == null) return null;

        // Prevent duplicates: if an invoice already exists for this SO, return it
        var existing = await _ctx.Trades.FirstOrDefaultAsync(t => t.TradeTypeID == 3 && t.Note == $"SO:{so.ID}");
        if (existing != null)
        {
            // Sync invoice PaidAmount/Status with SO's current paid amount
            var soPaid = so.PaidAmount ?? 0m;
            var invPaid = Math.Min(soPaid, existing.Amount);
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

            return new SalesInvoiceModel
            {
                ID = existing.ID,
                No = existing.No,
                Date = existing.Date,
                CustomerID = existing.CustomerID,
                StatusID = existing.StatusID,
                Amount = existing.Amount,
                PaidAmount = existing.PaidAmount ?? 0m,
                Note = existing.Note,
                SalesOrderID = so.ID
            };
        }

        var no = await GenerateSINoAsync(DateTime.Now.Date);
        // Double-check uniqueness in rare races
        int guard = 0;
        while (await _ctx.Trades.AnyAsync(t => t.No == no) && guard < 3)
        {
            no = await GenerateSINoAsync(DateTime.Now.Date);
            guard++;
        }

        // Initialize invoice paid/status from SO status/paid
        var soPaidAmount = so.PaidAmount ?? 0m;
        var initInvPaid = Math.Min(soPaidAmount, so.Amount);
        short initInvStatus = (short)InvoiceStatus.Draft;
        if (initInvPaid >= so.Amount) initInvStatus = (short)InvoiceStatus.Paid;
        else if (initInvPaid > 0) initInvStatus = (short)InvoiceStatus.PartiallyPaid;

        var inv = new Trade
        {
            No = no,
            Date = DateTime.Now.Date,
            CustomerID = so.CustomerID,
            Amount = so.Amount,
            PaidAmount = initInvPaid,
            StatusID = initInvStatus,
            TradeTypeID = 3,
            CreatedBy = _http.HttpContext?.User?.Identity?.Name,
            CreatedAt = DateTime.Now,
            Note = $"SO:{so.ID}"
        };
        _ctx.Trades.Add(inv);
        await _ctx.SaveChangesAsync();
        return new SalesInvoiceModel { ID = inv.ID, No = inv.No, Date = inv.Date, CustomerID = inv.CustomerID, StatusID = inv.StatusID, Amount = inv.Amount, PaidAmount = inv.PaidAmount ?? 0m, Note = inv.Note, SalesOrderID = so.ID };
    }

    public async Task<SalesInvoiceModel> Get(int id)
    {
        var t = await _ctx.Trades.AsNoTracking().FirstOrDefaultAsync(x => x.ID == id && x.TradeTypeID == 3);
        if (t == null) return null;
        return new SalesInvoiceModel { ID = t.ID, No = t.No, Date = t.Date, CustomerID = t.CustomerID, StatusID = t.StatusID, Amount = t.Amount, PaidAmount = t.PaidAmount ?? 0m, Note = t.Note };
    }

    public async Task<IEnumerable<SalesInvoiceListItem>> List(int? customerId, DateTime? from, DateTime? to, short? statusId)
    {
        var q = _ctx.Trades.AsNoTracking().Where(t => t.TradeTypeID == 3);
        if (customerId.HasValue) q = q.Where(t => t.CustomerID == customerId);
        if (from.HasValue) q = q.Where(t => t.Date >= from);
        if (to.HasValue) q = q.Where(t => t.Date <= to);
        if (statusId.HasValue) q = q.Where(t => t.StatusID == statusId);
        var list = await q
            .OrderByDescending(t => t.Date)
            .Select(t => new SalesInvoiceListItem
            {
                ID = t.ID,
                No = t.No,
                Date = t.Date,
                CustomerID = t.CustomerID,
                CustomerName = _ctx.Customers.Where(c => c.ID == t.CustomerID).Select(c => c.Name).FirstOrDefault() ?? "-",
                Amount = t.Amount,
                PaidAmount = t.PaidAmount ?? 0m,
                StatusID = t.StatusID
            })
            .ToListAsync();
        return list;
    }

    public async Task<object> Issue(int id)
    {
        var t = await _ctx.Trades.FirstOrDefaultAsync(x => x.ID == id && x.TradeTypeID == 3);
        if (t == null) return new { success = false, result = "Invoice not found" };
        t.StatusID = (short)InvoiceStatus.Issued;
        t.UpdatedAt = DateTime.Now; t.UpdatedBy = _http.HttpContext?.User?.Identity?.Name;
        await _ctx.SaveChangesAsync();
        return new { success = true };
    }

    public async Task<object> Cancel(int id)
    {
        var t = await _ctx.Trades.FirstOrDefaultAsync(x => x.ID == id && x.TradeTypeID == 3);
        if (t == null) return new { success = false, result = "Invoice not found" };
        if ((t.PaidAmount ?? 0m) > 0) return new { success = false, result = "Cannot cancel paid invoice" };
        t.StatusID = (short)InvoiceStatus.Canceled;
        t.UpdatedAt = DateTime.Now; t.UpdatedBy = _http.HttpContext?.User?.Identity?.Name;
        await _ctx.SaveChangesAsync();
        return new { success = true };
    }

    public async Task<object> SetAmount(int id, decimal amount)
    {
        var t = await _ctx.Trades.FirstOrDefaultAsync(x => x.ID == id && x.TradeTypeID == 3);
        if (t == null) return new { success = false, result = "Invoice not found" };
        if ((t.PaidAmount ?? 0m) > amount) return new { success = false, result = "Amount cannot be less than already paid" };
        t.Amount = amount;
        // Re-evaluate status when amount changes
        var paid = t.PaidAmount ?? 0m;
        if (paid >= t.Amount) t.StatusID = (short)InvoiceStatus.Paid;
        else if (paid > 0) t.StatusID = (short)InvoiceStatus.PartiallyPaid;
        else t.StatusID = (short)InvoiceStatus.Draft;
        t.UpdatedAt = DateTime.Now; t.UpdatedBy = _http.HttpContext?.User?.Identity?.Name;
        await _ctx.SaveChangesAsync();
        return new { success = true };
    }

    public async Task<object> ExistsForSO(int salesOrderId)
    {
        var exists = await _ctx.Trades.AnyAsync(t => t.TradeTypeID == 3 && t.Note == $"SO:{salesOrderId}");
        return new { success = true, exists };
    }
}
