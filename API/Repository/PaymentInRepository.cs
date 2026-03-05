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

    // Use TradeTypeID=3 as Sales Invoice by convention

    public PaymentInRepository(MKSTableContext ctx, MKSSPContextProcedures sp, IHttpContextAccessor http)
    {
        _ctx = ctx; _sp = sp; _http = http;
    }

    private async Task<int?> ResolveSalesOrderIdFromInvoiceAsync(int invoiceId)
    {
        // Prefer explicit linkage via PaymentIn records
        var soId = await _ctx.PaymentIns.AsNoTracking()
            .Where(p => p.SalesInvoiceID == invoiceId && p.SalesOrderID != null)
            .OrderBy(p => p.Date)
            .Select(p => p.SalesOrderID)
            .FirstOrDefaultAsync();
        if (soId != null) return soId;

        // Fallback to legacy Note pattern
        var inv = await _ctx.Trades.AsNoTracking().FirstOrDefaultAsync(t => t.ID == invoiceId);
        var note = inv?.Note ?? string.Empty;
        if (note.StartsWith("SO:", StringComparison.OrdinalIgnoreCase) && int.TryParse(note.Substring(3), out var parsed))
            return parsed;
        return null;
    }

    private async Task<Trade> ResolveInvoiceFromSalesOrderAsync(int salesOrderId)
    {
        // Prefer explicit linkage via PaymentIn records
        var invId = await _ctx.PaymentIns.AsNoTracking()
            .Where(p => p.SalesOrderID == salesOrderId && p.SalesInvoiceID != null)
            .OrderByDescending(p => p.Date)
            .Select(p => p.SalesInvoiceID)
            .FirstOrDefaultAsync();
        if (invId != null)
        {
            return await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == invId);
        }

        // Fallback to legacy Note pattern
        return await _ctx.Trades.FirstOrDefaultAsync(t => t.TradeTypeID == 3 && t.Note == $"SO:{salesOrderId}");
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
            int? soIdFromInvoicePI = null;
            decimal change = 0m; // kembalian jika bayar > sisa yang harus dibayar (untuk SO)
            if (req.SalesInvoiceID is int invId)
            {
                targetTrade = await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == invId);
                if (targetTrade == null) return (false, "Invoice not found", 0, null, 0, 0);

                // Prefer explicit linkage
                soIdFromInvoicePI = await ResolveSalesOrderIdFromInvoiceAsync(invId);

                var paid = targetTrade.PaidAmount ?? 0m;
                var amount = targetTrade.Amount;
                var remaining = amount - paid;
                if (((targetTrade.StatusID ?? 0) == (short)SalesInvoiceStatus.Paid && paid >= amount) || (amount > 0 && remaining <= 0))
                {
                    return (false, "Invoice already fully paid", 0, null, paid, targetTrade.StatusID ?? 0);
                }
                if (req.Type?.Equals("Full", StringComparison.OrdinalIgnoreCase) == true && amount > 0)
                {
                    req.Amount = remaining;
                }
                if (amount > 0 && req.Amount > remaining)
                {
                    return (false, "Amount exceeds remaining invoice balance", 0, null, 0, 0);
                }

                if (soIdFromInvoicePI is int soFromInv)
                {
                    linkedSalesOrder = await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == soFromInv);
                }
            }
            else if (req.SalesOrderID is int soId)
            {
                targetTrade = await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == soId);
                if (targetTrade == null) return (false, "Sales Order not found", 0, null, 0, 0);
                var paid = targetTrade.PaidAmount ?? 0m;
                var amount = targetTrade.Amount;
                var remaining = amount - paid;
                if (((targetTrade.StatusID ?? 0) == (short)SalesOrderStatus.Paid && paid >= amount) || (amount > 0 && remaining <= 0))
                {
                    return (false, "Sales Order already fully paid", 0, null, paid, targetTrade.StatusID ?? 0);
                }
                if (req.Type?.Equals("Full", StringComparison.OrdinalIgnoreCase) == true && amount > 0)
                {
                    req.Amount = remaining;
                }

                var tendered = req.Amount;
                var appliedAmount = tendered;
                if (amount > 0 && tendered > remaining)
                {
                    change = tendered - remaining;
                    appliedAmount = remaining;
                }

                if (amount > 0)
                {
                    if (appliedAmount >= remaining)
                        req.Type = "Full";
                    else
                        req.Type = "DP";
                }

                req.Amount = appliedAmount;

                // Prefer explicit linkage
                linkedInvoice = await ResolveInvoiceFromSalesOrderAsync(soId);
            }

            // Normalize customer: 0 => NULL
            int? normalizedCustomerId = req.CustomerID ?? targetTrade?.CustomerID;
            if (normalizedCustomerId.HasValue && normalizedCustomerId.Value == 0)
            {
                normalizedCustomerId = null;
            }

            var gen = await _sp.uspGenerateNoAsync("RCPT", req.Date);
            var no = gen.FirstOrDefault()?.NewNumber ?? $"RCPT-{req.Date:yyyyMMddHHmmss}";

            var entity = new PaymentIn
            {
                No = no,
                Date = req.Date,
                CustomerID = normalizedCustomerId,
                SalesOrderID = req.SalesOrderID ?? soIdFromInvoicePI,
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
                    if (newPaid >= targetTrade.Amount)
                        targetTrade.StatusID = (short)SalesInvoiceStatus.Paid;
                    else if (newPaid > 0 && newPaid < targetTrade.Amount)
                        targetTrade.StatusID = (short)SalesInvoiceStatus.PartiallyPaid;
                    else
                        targetTrade.StatusID = (short)SalesInvoiceStatus.Draft;
                }
                else
                {
                    if (targetTrade.Amount <= 0)
                    {
                        targetTrade.StatusID = (short)SalesOrderStatus.Draft;
                    }
                    else if (newPaid >= targetTrade.Amount)
                        targetTrade.StatusID = (short)SalesOrderStatus.Paid;
                    else if (newPaid > 0 && newPaid < targetTrade.Amount)
                        targetTrade.StatusID = (short)SalesOrderStatus.Debt;
                    else
                        targetTrade.StatusID = (short)SalesOrderStatus.Draft;
                }

                paymentStatusId = targetTrade.StatusID ?? 0;
                _ctx.Trades.Update(targetTrade);

                if (linkedInvoice != null)
                {
                    var invNewPaid = (linkedInvoice.PaidAmount ?? 0m) + req.Amount;
                    linkedInvoice.PaidAmount = invNewPaid;
                    if (invNewPaid >= linkedInvoice.Amount)
                        linkedInvoice.StatusID = (short)SalesInvoiceStatus.Paid;
                    else if (invNewPaid > 0 && invNewPaid < linkedInvoice.Amount)
                        linkedInvoice.StatusID = (short)SalesInvoiceStatus.PartiallyPaid;
                    else
                        linkedInvoice.StatusID = (short)SalesInvoiceStatus.Draft;
                    _ctx.Trades.Update(linkedInvoice);
                }

                if (linkedSalesOrder != null)
                {
                    var soPaid = linkedSalesOrder.PaidAmount ?? 0m;
                    var soRemaining = linkedSalesOrder.Amount - soPaid;
                    var creditToSo = Math.Min(soRemaining, req.Amount);
                    var soNewPaid = soPaid + creditToSo;
                    linkedSalesOrder.PaidAmount = soNewPaid;
                    if (linkedSalesOrder.Amount <= 0)
                    {
                        linkedSalesOrder.StatusID = (short)SalesOrderStatus.Draft;
                    }
                    else if (soNewPaid >= linkedSalesOrder.Amount)
                        linkedSalesOrder.StatusID = (short)SalesOrderStatus.Paid;
                    else if (soNewPaid > 0 && soNewPaid < linkedSalesOrder.Amount)
                        linkedSalesOrder.StatusID = (short)SalesOrderStatus.Debt;
                    else
                        linkedSalesOrder.StatusID = (short)SalesOrderStatus.Draft;
                    _ctx.Trades.Update(linkedSalesOrder);
                }
            }

            await _ctx.SaveChangesAsync();
            await tx.CommitAsync();

            var successMessage = change > 0 ? $"Kembalian: {change:N2}" : null;
            return (true, successMessage, entity.ID, entity.No, paidAmount, paymentStatusId);
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
                SalesInvoiceID = p.SalesInvoiceID,
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

        if (salesInvoiceId is int invId)
        {
            var soIdFromPi = await _ctx.PaymentIns.AsNoTracking()
                .Where(p => p.SalesInvoiceID == invId && p.SalesOrderID != null)
                .Select(p => p.SalesOrderID)
                .FirstOrDefaultAsync();
            q = q.Where(x => x.SalesInvoiceID == invId || (soIdFromPi != null && x.SalesOrderID == soIdFromPi));
        }
        else if (salesOrderId is int soId)
        {
            var linkedInvId = await _ctx.PaymentIns.AsNoTracking()
                .Where(p => p.SalesOrderID == soId && p.SalesInvoiceID != null)
                .Select(p => p.SalesInvoiceID)
                .FirstOrDefaultAsync();
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
                SalesInvoiceID = p.SalesInvoiceID,
                Method = p.Method,
                Type = p.Type,
                Amount = p.Amount,
                Note = p.Note,
                StatusID = p.StatusID
            }).ToListAsync();
    }

    public async Task<(bool success, string message)> UpdateStatus(int id, short statusId)
    {
        if (statusId != 1 && statusId != 2) return (false, "Unsupported status change");

        using var tx = await _ctx.Database.BeginTransactionAsync();
        try
        {
            var p = await _ctx.PaymentIns.FirstOrDefaultAsync(x => x.ID == id);
            if (p == null) return (false, "Payment not found");

            var username = _http.HttpContext?.User?.Identity?.Name ?? "system";

            Trade targetTrade = null;
            Trade linkedInvoice = null;
            Trade linkedSalesOrder = null;

            if (p.SalesInvoiceID is int invId)
            {
                targetTrade = await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == invId);
                var soFromPi = await ResolveSalesOrderIdFromInvoiceAsync(invId);
                if (soFromPi is int soId)
                {
                    linkedSalesOrder = await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == soId);
                }
            }
            else if (p.SalesOrderID is int soId)
            {
                targetTrade = await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == soId);
                linkedInvoice = await ResolveInvoiceFromSalesOrderAsync(soId);
            }

            if (targetTrade == null)
            {
                return (false, "Linked trade not found");
            }

            var sign = statusId == 2 ? 1m : -1m;

            if (statusId == 2 && p.StatusID == 2)
            {
                return (false, "Already submitted");
            }
            if (statusId == 1 && p.StatusID == 1)
            {
                return (false, "Already draft");
            }

            var newPaid = (targetTrade.PaidAmount ?? 0m) + (sign * p.Amount);
            if (newPaid < 0)
            {
                return (false, "Reversal would make paid amount negative");
            }
            if (statusId == 2 && targetTrade.TradeTypeID == 3)
            {
                var remaining = (targetTrade.Amount) - (targetTrade.PaidAmount ?? 0m);
                if (p.Amount > remaining)
                {
                    return (false, "Amount exceeds remaining invoice balance");
                }
            }

            targetTrade.PaidAmount = newPaid;

            if (targetTrade.TradeTypeID == 3)
            {
                if (targetTrade.Amount <= 0)
                    targetTrade.StatusID = (short)SalesInvoiceStatus.Draft;
                else if (newPaid >= targetTrade.Amount)
                    targetTrade.StatusID = (short)SalesInvoiceStatus.Paid;
                else if (newPaid > 0 && newPaid < targetTrade.Amount)
                    targetTrade.StatusID = (short)SalesInvoiceStatus.PartiallyPaid;
                else
                    targetTrade.StatusID = (short)SalesInvoiceStatus.Draft;
            }
            else
            {
                if (targetTrade.Amount <= 0)
                    targetTrade.StatusID = (short)SalesOrderStatus.Draft;
                else if (newPaid >= targetTrade.Amount)
                    targetTrade.StatusID = (short)SalesOrderStatus.Paid;
                else if (newPaid > 0 && newPaid < targetTrade.Amount)
                    targetTrade.StatusID = (short)SalesOrderStatus.Debt;
                else
                    targetTrade.StatusID = (short)SalesOrderStatus.Draft;
            }
            _ctx.Trades.Update(targetTrade);

            if (linkedInvoice != null)
            {
                var invNewPaid = (linkedInvoice.PaidAmount ?? 0m) + (sign * p.Amount);
                if (invNewPaid < 0) return (false, "Reversal would make invoice paid amount negative");
                linkedInvoice.PaidAmount = invNewPaid;
                if (linkedInvoice.Amount <= 0)
                    linkedInvoice.StatusID = (short)SalesInvoiceStatus.Draft;
                else if (invNewPaid >= linkedInvoice.Amount)
                    linkedInvoice.StatusID = (short)SalesInvoiceStatus.Paid;
                else if (invNewPaid > 0 && invNewPaid < linkedInvoice.Amount)
                    linkedInvoice.StatusID = (short)SalesInvoiceStatus.PartiallyPaid;
                else
                    linkedInvoice.StatusID = (short)SalesInvoiceStatus.Draft;
                _ctx.Trades.Update(linkedInvoice);
            }

            if (linkedSalesOrder != null)
            {
                var soNewPaid = (linkedSalesOrder.PaidAmount ?? 0m) + (sign * p.Amount);
                if (soNewPaid < 0) return (false, "Reversal would make sales order paid amount negative");
                linkedSalesOrder.PaidAmount = soNewPaid;
                if (linkedSalesOrder.Amount <= 0)
                    linkedSalesOrder.StatusID = (short)SalesOrderStatus.Draft;
                else if (soNewPaid >= linkedSalesOrder.Amount)
                    linkedSalesOrder.StatusID = (short)SalesOrderStatus.Paid;
                else if (soNewPaid > 0 && soNewPaid < linkedSalesOrder.Amount)
                    linkedSalesOrder.StatusID = (short)SalesOrderStatus.Debt;
                else
                    linkedSalesOrder.StatusID = (short)SalesOrderStatus.Draft;
                _ctx.Trades.Update(linkedSalesOrder);
            }

            p.StatusID = statusId;
            p.UpdatedAt = DateTime.Now;
            p.UpdatedBy = username;
            _ctx.PaymentIns.Update(p);

            await _ctx.SaveChangesAsync();
            await tx.CommitAsync();
            return (true, null);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            return (false, ex.Message);
        }
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
