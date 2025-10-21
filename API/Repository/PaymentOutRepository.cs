using API.Context.SP;
using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class PaymentOutRepository : IPaymentOutRepository
{
    private readonly MKSTableContext _ctx;
    private readonly MKSSPContextProcedures _sp;
    private readonly IHttpContextAccessor _http;

    public PaymentOutRepository(MKSTableContext ctx, MKSSPContextProcedures sp, IHttpContextAccessor http)
    {
        _ctx = ctx; _sp = sp; _http = http;
    }

    public async Task<(bool success, string message, int id)> Create(PaymentOutCreateRequest req)
    {
        // Basic validation
        if (req.Amount <= 0) return (false, "Amount must be > 0", 0);
        if (req.SupplierID == null) return (false, "Supplier is required", 0);

        if (!string.IsNullOrWhiteSpace(req.Method) && req.Method.Equals("Transfer", StringComparison.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(req.ReferenceNo))
            return (false, "ReferenceNo is required for transfer method", 0);

        using var tx = await _ctx.Database.BeginTransactionAsync();
        try
        {
            var username = _http.HttpContext?.User?.Identity?.Name ?? "system";
            var now = DateTime.Now;

            // Normalize incoming type to a known canonical form
            var incomingType = (req.Type ?? string.Empty).Trim();
            if (!string.IsNullOrEmpty(incomingType)) incomingType = incomingType.Substring(0, 1).ToUpper() + incomingType.Substring(1).ToLower();

            // If PurchaseOrderID provided, validate PO and remaining
            decimal creditedAmount = req.Amount;
            Trade? po = null;
            if (req.PurchaseOrderID is int poId)
            {
                po = await _ctx.Trades.FirstOrDefaultAsync(t => t.ID == poId);
                if (po == null) return (false, "Purchase Order not found", 0);
                var paid = po.PaidAmount ?? 0m;
                var remaining = po.Amount - paid;
                if (remaining <= 0) return (false, "Purchase Order already fully paid", 0);

                if (!string.IsNullOrWhiteSpace(incomingType) && incomingType.Equals("Full", StringComparison.OrdinalIgnoreCase))
                {
                    creditedAmount = remaining;
                }
                if (creditedAmount > remaining)
                {
                    return (false, "Amount exceeds remaining balance", 0);
                }
            }

            // Prevent accidental double-submit: if identical payment was created by same user within last 5 seconds, return existing
            var possibleDup = await _ctx.PaymentOuts.AsNoTracking()
                .Where(p => p.SupplierID == req.SupplierID
                            && p.PurchaseOrderID == req.PurchaseOrderID
                            && p.Amount == creditedAmount
                            && p.Date == req.Date
                            && p.CreatedBy == username
                            && p.CreatedAt != null
                            && EF.Functions.DateDiffSecond(p.CreatedAt.Value, now) <= 5)
                .OrderByDescending(p => p.CreatedAt)
                .FirstOrDefaultAsync();

            if (possibleDup != null)
            {
                // treat as success but avoid inserting duplicate
                return (true, "Duplicate detected - returning existing payment", possibleDup.ID);
            }

            // If Deposit type, store into CustomerDeposit table (create if not exists)
            if (!string.IsNullOrWhiteSpace(incomingType) && incomingType.Equals("Deposit", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var deposit = await _ctx.CustomerDeposits.FirstOrDefaultAsync(d => d.SupplierID == req.SupplierID);
                    if (deposit == null)
                    {
                        deposit = new CustomerDeposit { SupplierID = req.SupplierID!.Value, Amount = creditedAmount, CreatedAt = now, CreatedBy = username };
                        await _ctx.CustomerDeposits.AddAsync(deposit);
                    }
                    else
                    {
                        deposit.Amount += creditedAmount;
                        deposit.UpdatedAt = now; deposit.UpdatedBy = username;
                        _ctx.CustomerDeposits.Update(deposit);
                    }
                    await _ctx.SaveChangesAsync();
                }
                catch
                {
                    // If CustomerDeposit entity/table not present, ignore and continue (safe fallback)
                }

                // If this is a deposit for a PurchaseOrder, try to find an existing POT (Deposit) for that PO and accumulate into it
                if (req.PurchaseOrderID is int existingPoId)
                {
                    // Use SELECT ... WITH (UPDLOCK, ROWLOCK) to acquire a pessimistic update lock and prevent concurrent inserts
                    var sql = "SELECT * FROM dbo.PaymentOut WITH (UPDLOCK, ROWLOCK) WHERE PurchaseOrderID = {0} AND LOWER([Type]) = 'deposit'";
                    var existingPot = await _ctx.PaymentOuts.FromSqlRaw(sql, existingPoId).FirstOrDefaultAsync();

                    if (existingPot != null)
                    {
                        // accumulate amount
                        existingPot.Amount += creditedAmount;
                        existingPot.UpdatedAt = now;
                        existingPot.UpdatedBy = username;
                        // keep method/reference if provided
                        if (!string.IsNullOrWhiteSpace(req.Method)) existingPot.Method = req.Method;
                        if (!string.IsNullOrWhiteSpace(req.ReferenceNo)) existingPot.ReferenceNo = req.ReferenceNo;
                        // if submit requested, set status to submitted
                        if (req.Submit) existingPot.StatusID = 2;

                        _ctx.PaymentOuts.Update(existingPot);

                        // Also update PO paid amount/status if submitting
                        if (po != null && req.Submit)
                        {
                            var newPaid = (po.PaidAmount ?? 0m) + creditedAmount;
                            po.PaidAmount = newPaid;
                            if (newPaid >= po.Amount)
                                po.StatusID = 3; // Paid
                            else
                                po.StatusID = 2; // PartialPaid
                            _ctx.Trades.Update(po);
                        }

                        await _ctx.SaveChangesAsync();
                        await tx.CommitAsync();
                        return (true, null, existingPot.ID);
                    }
                }
            }

            // Generate payment no via stored procedure (fallback to timestamp-based if SP fails)
            string no;
            try
            {
                var gen = await _sp.uspGenerateNoAsync("POT", req.Date);
                no = gen.FirstOrDefault()?.NewPONumber ?? $"POT-{DateTime.Now:yyyyMMddHHmmssfff}";
            }
            catch
            {
                no = $"POT-{DateTime.Now:yyyyMMddHHmmssfff}";
            }

            var entity = new PaymentOut
            {
                No = no,
                Date = req.Date,
                SupplierID = req.SupplierID,
                PurchaseOrderID = req.PurchaseOrderID,
                Method = req.Method,
                Type = incomingType, // store normalized type
                Amount = creditedAmount,
                Note = req.Note,
                ReferenceNo = req.ReferenceNo,
                StatusID = (short)(req.Submit ? 2 : 1), // 2=Submitted, 1=Draft
                CreatedAt = now,
                CreatedBy = username,
                UpdatedAt = now,
                UpdatedBy = username
            };

            _ctx.PaymentOuts.Add(entity);

            if (po != null && req.Submit)
            {
                var newPaid = (po.PaidAmount ?? 0m) + creditedAmount;
                po.PaidAmount = newPaid;
                // set PO status using PartialPaid/ Paid mapping: use 3=Paid,2=PartialPaid,1=Draft
                if (newPaid >= po.Amount)
                    po.StatusID = 3; // Paid
                else
                    po.StatusID = 2; // PartialPaid
                _ctx.Trades.Update(po);
            }

            await _ctx.SaveChangesAsync();
            await tx.CommitAsync();
            return (true, null, entity.ID);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            return (false, ex.Message, 0);
        }
    }

    public async Task<decimal> GetDepositBalance(int supplierId)
    {
        var d = await _ctx.CustomerDeposits.AsNoTracking().FirstOrDefaultAsync(x => x.SupplierID == supplierId);
        return d?.Amount ?? 0m;
    }

    public async Task<IEnumerable<PaymentOutDto>> List(int? supplierId = null, DateTime? from = null, DateTime? to = null, short? statusId = null, int? purchaseOrderId = null)
    {
        var q = _ctx.PaymentOuts.AsNoTracking().AsQueryable();
        if (supplierId is not null) q = q.Where(x => x.SupplierID == supplierId);
        if (purchaseOrderId is not null) q = q.Where(x => x.PurchaseOrderID == purchaseOrderId);
        if (from is not null) q = q.Where(x => x.Date >= from);
        if (to is not null) q = q.Where(x => x.Date <= to);
        if (statusId is not null) q = q.Where(x => x.StatusID == statusId);

        return await q.OrderByDescending(x => x.Date).Select(p => new PaymentOutDto
        {
            ID = p.ID,
            No = p.No,
            Date = p.Date,
            SupplierID = p.SupplierID,
            PurchaseOrderID = p.PurchaseOrderID,
            Method = p.Method,
            Type = p.Type,
            Amount = p.Amount,
            Note = p.Note,
            StatusID = p.StatusID,
            ReferenceNo = p.ReferenceNo
        }).ToListAsync();
    }
}
