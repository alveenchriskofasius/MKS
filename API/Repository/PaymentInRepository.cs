using API.Context.SP;
using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class PaymentInRepository : IPaymentInRepository
{
    private readonly MKSTableContext _ctx;
    private readonly MKSSPContextProcedures _sp;
    private readonly IHttpContextAccessor _http;

    private enum TradeStatus
    {
        Draft = 1,
        Paid = 2,
        Debt = 3,
        PartialRefund = 4,
        Refund = 5,
        Exchange = 6,
        PartialExchange = 7,
        Completed = 8
    }

    // Use TradeTypeID=3 as Sales Invoice by convention

    public PaymentInRepository(MKSTableContext ctx, MKSSPContextProcedures sp, IHttpContextAccessor http)
    {
        _ctx = ctx; _sp = sp; _http = http;
    }

    public async Task<(bool success, string message, int id, string no, decimal paidAmount, short paymentStatusId)> Create(PaymentInCreateRequest req)
    {
        if (req.Amount <= 0) return (false, "Amount must be > 0", 0, null, 0, 0);
        if (req.SalesOrderID is null && req.SalesInvoiceID is null) return (false, "Either SalesOrderID or SalesInvoiceID is required", 0, null, 0, 0);

        using var tx = await _ctx.Database.BeginTransactionAsync();
        try
        {
            var now = DateTime.Now;
            var username = _http.HttpContext?.User?.Identity?.Name ?? "system";

            Trade targetTrade = null; // could be SO or Invoice trade (TradeTypeID=3)
            Trade linkedInvoice = null; // when paying SO, propagate to invoice if exists
            Trade linkedSalesOrder = null; // when paying Invoice, propagate to SO if exists
            int? soIdFromInvoiceNote = null;
            if (req.SalesInvoiceID is int invId)
            {
                targetTrade = await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == invId);
                if (targetTrade == null) return (false, "Invoice not found", 0, null, 0, 0);
                // Try to derive SO id from invoice note pattern "SO:{id}"
                var note = targetTrade.Note ?? string.Empty;
                if (note.StartsWith("SO:", StringComparison.OrdinalIgnoreCase))
                {
                    var tail = note.Substring(3);
                    if (int.TryParse(tail, out var parsedSo)) soIdFromInvoiceNote = parsedSo;
                }
                // If invoice already fully paid, block further payments until status changes (e.g., due to return)
                if ((targetTrade.StatusID ?? 0) == 4)
                {
                    return (false, "Invoice already fully paid", 0, null, targetTrade.PaidAmount ?? 0m, targetTrade.StatusID ?? 0);
                }
                var paid = targetTrade.PaidAmount ?? 0m;
                var amount = targetTrade.Amount;
                var remaining = amount - paid;
                if (remaining <= 0) return (false, "Invoice already fully paid", 0, null, paid, targetTrade.StatusID ?? 0);
                if (req.Type?.Equals("Full", StringComparison.OrdinalIgnoreCase) == true)
                {
                    req.Amount = remaining;
                }
                if (req.Amount > remaining)
                {
                    return (false, "Amount exceeds remaining invoice balance", 0, null, 0, 0);
                }

                // If invoice is linked to a Sales Order, load it for propagation later
                if (soIdFromInvoiceNote is int soFromInv)
                {
                    linkedSalesOrder = await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == soFromInv);
                }
            }
            else if (req.SalesOrderID is int soId)
            {
                targetTrade = await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == soId);
                if (targetTrade == null) return (false, "Sales Order not found", 0, null, 0, 0);
                // If SO already Paid, block further payments until status changes by Return
                if ((targetTrade.StatusID ?? 0) == (short)TradeStatus.Paid)
                {
                    return (false, "Sales Order already fully paid", 0, null, targetTrade.PaidAmount ?? 0m, targetTrade.StatusID ?? 0);
                }
                var paid = targetTrade.PaidAmount ?? 0m;
                var remaining = targetTrade.Amount - paid;
                if (remaining <= 0) return (false, "Sales Order already fully paid", 0, null, paid, targetTrade.StatusID ?? 0);
                if (req.Type?.Equals("Full", StringComparison.OrdinalIgnoreCase) == true)
                {
                    req.Amount = remaining;
                }
                if (req.Amount > remaining)
                {
                    return (false, "Amount exceeds remaining balance", 0, null, 0, 0);
                }
                // Try find linked invoice and attach payments to it as well
                linkedInvoice = await _ctx.Trades.FirstOrDefaultAsync(t => t.TradeTypeID == 3 && t.Note == $"SO:{soId}");
            }

            // Normalize customer: 0 means Umum/no customer -> store as NULL to satisfy FK
            int? normalizedCustomerId = req.CustomerID ?? targetTrade?.CustomerID;
            if (normalizedCustomerId.HasValue && normalizedCustomerId.Value == 0)
            {
                normalizedCustomerId = null;
            }

            var gen = await _sp.uspGenerateNoAsync("RCPT", req.Date);
            var no = gen.FirstOrDefault()?.NewPONumber ?? $"RCPT-{req.Date:yyyyMMddHHmmss}";

            var entity = new PaymentIn
            {
                No = no,
                Date = req.Date,
                CustomerID = normalizedCustomerId,
                // ensure both SO and Invoice linkage are kept when we can infer them
                SalesOrderID = req.SalesOrderID ?? soIdFromInvoiceNote,
                SalesInvoiceID = req.SalesInvoiceID,
                Method = req.Method,
                Type = req.Type,
                Amount = req.Amount,
                Note = req.Note,
                StatusID = (short)(req.Submit ? 2 : 1),
                CreatedBy = username,
                CreatedAt = now,
                UpdatedBy = username,
                UpdatedAt = now
            };

            // If paying SO and invoice exists, link this payment to invoice as well
            if (entity.SalesInvoiceID == null && linkedInvoice != null)
            {
                entity.SalesInvoiceID = linkedInvoice.ID;
            }

            _ctx.PaymentIns.Add(entity);

            short paymentStatusId = targetTrade?.StatusID ?? 0;
            decimal paidAmount = targetTrade?.PaidAmount ?? 0m;

            if (targetTrade != null && req.Submit)
            {
                var newPaid = (targetTrade.PaidAmount ?? 0m) + req.Amount;
                targetTrade.PaidAmount = newPaid;
                paidAmount = newPaid;

                if (targetTrade.TradeTypeID == 3)
                {
                    // Invoice: use 4=Paid, 3=PartiallyPaid, 1=Draft
                    if (newPaid >= targetTrade.Amount)
                        targetTrade.StatusID = 4;
                    else if (newPaid > 0 && newPaid < targetTrade.Amount)
                        targetTrade.StatusID = 3;
                    else
                        targetTrade.StatusID = 1;
                }
                else
                {
                    // SO: use 2=Paid, 3=Debt, 1=Draft
                    if (newPaid >= targetTrade.Amount)
                        targetTrade.StatusID = (short)TradeStatus.Paid;
                    else if (newPaid > 0 && newPaid < targetTrade.Amount)
                        targetTrade.StatusID = (short)TradeStatus.Debt;
                    else
                        targetTrade.StatusID = (short)TradeStatus.Draft;
                }

                paymentStatusId = targetTrade.StatusID ?? 0;
                _ctx.Trades.Update(targetTrade);

                // Propagate to linked invoice when paying SO
                if (linkedInvoice != null)
                {
                    var invNewPaid = (linkedInvoice.PaidAmount ?? 0m) + req.Amount;
                    linkedInvoice.PaidAmount = invNewPaid;
                    if (invNewPaid >= linkedInvoice.Amount)
                        linkedInvoice.StatusID = 4; // Paid
                    else if (invNewPaid > 0 && invNewPaid < linkedInvoice.Amount)
                        linkedInvoice.StatusID = 3; // Partially Paid
                    else
                        linkedInvoice.StatusID = 1; // Draft
                    _ctx.Trades.Update(linkedInvoice);
                }

                // Propagate to linked SO when paying Invoice
                if (linkedSalesOrder != null)
                {
                    // Only apply up to the remaining amount on SO to prevent overpay state
                    var soPaid = linkedSalesOrder.PaidAmount ?? 0m;
                    var soRemaining = linkedSalesOrder.Amount - soPaid;
                    var creditToSo = Math.Min(soRemaining, req.Amount);
                    var soNewPaid = soPaid + creditToSo;
                    linkedSalesOrder.PaidAmount = soNewPaid;
                    if (soNewPaid >= linkedSalesOrder.Amount)
                        linkedSalesOrder.StatusID = (short)TradeStatus.Paid;
                    else if (soNewPaid > 0 && soNewPaid < linkedSalesOrder.Amount)
                        linkedSalesOrder.StatusID = (short)TradeStatus.Debt;
                    else
                        linkedSalesOrder.StatusID = (short)TradeStatus.Draft;
                    _ctx.Trades.Update(linkedSalesOrder);
                }
            }

            await _ctx.SaveChangesAsync();
            await tx.CommitAsync();

            return (true, null, entity.ID, entity.No, paidAmount, paymentStatusId);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            return (false, ex.Message, 0, null, 0, 0);
        }
    }

    public async Task<PaymentInDto> Get(int id)
    {
        return await _ctx.PaymentIns.AsNoTracking()
            .Where(p => p.ID == id)
            .Select(p => new PaymentInDto
            {
                ID = p.ID,
                No = p.No,
                Date = p.Date,
                CustomerID = p.CustomerID,
                SalesOrderID = p.SalesOrderID,
                Method = p.Method,
                Type = p.Type,
                Amount = p.Amount,
                Note = p.Note,
                StatusID = p.StatusID
            }).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<PaymentInDto>> List(int? customerId, DateTime? from, DateTime? to, short? statusId, int? salesOrderId, int? salesInvoiceId)
    {
        var q = _ctx.PaymentIns.AsNoTracking().AsQueryable();

        // When filtering by invoice, include SO payments linked to the same SO (derived from invoice note)
        if (salesInvoiceId is int invId)
        {
            var inv = await _ctx.Trades.AsNoTracking().FirstOrDefaultAsync(t => t.ID == invId);
            int? soIdFromNote = null;
            var note = inv?.Note ?? string.Empty;
            if (note.StartsWith("SO:", StringComparison.OrdinalIgnoreCase))
            {
                var tail = note.Substring(3);
                if (int.TryParse(tail, out var parsed)) soIdFromNote = parsed;
            }
            q = q.Where(x => x.SalesInvoiceID == invId || (soIdFromNote != null && x.SalesOrderID == soIdFromNote));
        }
        else if (salesOrderId is int soId)
        {
            // When filtering by SO, include payments that were created against its linked invoice (if any)
            var inv = await _ctx.Trades.AsNoTracking().FirstOrDefaultAsync(t => t.TradeTypeID == 3 && t.Note == $"SO:{soId}");
            int? linkedInvId = inv?.ID;
            q = q.Where(x => x.SalesOrderID == soId || (linkedInvId != null && x.SalesInvoiceID == linkedInvId));
        }

        if (customerId is not null) q = q.Where(x => x.CustomerID == customerId);
        if (from is not null) q = q.Where(x => x.Date >= from);
        if (to is not null) q = q.Where(x => x.Date <= to);
        if (statusId is not null) q = q.Where(x => x.StatusID == statusId);

        return await q.OrderByDescending(x => x.Date)
            .Select(p => new PaymentInDto
            {
                ID = p.ID,
                No = p.No,
                Date = p.Date,
                CustomerID = p.CustomerID,
                SalesOrderID = p.SalesOrderID,
                Method = p.Method,
                Type = p.Type,
                Amount = p.Amount,
                Note = p.Note,
                StatusID = p.StatusID
            }).ToListAsync();
    }

    public async Task<(bool success, string message)> UpdateStatus(int id, short statusId)
    {
        var p = await _ctx.PaymentIns.FirstOrDefaultAsync(x => x.ID == id);
        if (p == null) return (false, "Payment not found");
        if (p.StatusID == 2) return (false, "Already submitted");
        p.StatusID = statusId;
        p.UpdatedAt = DateTime.Now;
        p.UpdatedBy = _http.HttpContext?.User?.Identity?.Name ?? "system";
        await _ctx.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool success, string message)> Delete(int id)
    {
        var p = await _ctx.PaymentIns.FirstOrDefaultAsync(x => x.ID == id);
        if (p == null) return (false, "Payment not found");
        if (p.StatusID == 2) return (false, "Cannot delete submitted payment");
        _ctx.PaymentIns.Remove(p);
        await _ctx.SaveChangesAsync();
        return (true, null);
    }
}
