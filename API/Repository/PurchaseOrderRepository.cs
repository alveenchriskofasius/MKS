using API.Context.SP;
using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository
{
    public class PurchaseOrderRepository : IPurchaseOrderRepository
    {
        private readonly MKSTableContext _context;
        private readonly MKSSPContextProcedures _procedure;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly API.Services.IAuditService? _audit;
        // PurchaseOrder status workflow
        private const short PO_Draft = 1;
        private const short PO_Submitted = 2;
        private const short PO_Approved = 3;
        private const short PO_Rejected = 4;

        private Task<bool> HasSubmittedPaymentsAsync(int tradeId)
        {
            // Submitted payment out uses StatusID == 2 (see PaymentOut module)
            return _context.PaymentOuts.AnyAsync(p => p.PurchaseOrderID == tradeId && p.StatusID == 2);
        }

        private static bool IsPOEditLocked(short? statusId)
        {
            var s = statusId ?? PO_Draft;
            return s == PO_Submitted || s == PO_Approved;
        }

        public PurchaseOrderRepository(MKSTableContext context, MKSSPContextProcedures procedure, IHttpContextAccessor httpContextAccessor, API.Services.IAuditService? audit = null)
        {
            _context = context;
            _procedure = procedure;
            _httpContextAccessor = httpContextAccessor;
            _audit = audit;
        }
        public async Task<PurchaseOrderModel> FillForm(int id)
        {
            var trade = await _context.Trades.FindAsync(id);
            if (trade == null) return new PurchaseOrderModel();
            return new PurchaseOrderModel
            {
                ID = trade.ID,
                Date = trade.Date,
                StatusID = trade.StatusID,
                No = trade.No,
                SupplierID = trade.CustomerID,
                Amount = trade.Amount,
                Note = trade.Note
            };
        }

        public async Task<object> ChangeStatus(int id, short statusId, string? reason)
        {
            try
            {
                var trade = await _context.Trades.FindAsync(id);
                if (trade == null) return new { success = false, result = "Purchase Order not found." };

                // If payments have been submitted, do not allow status changes
                if (await HasSubmittedPaymentsAsync(id))
                {
                    return new { success = false, result = "Purchase Order is locked and cannot change status after payments have been submitted." };
                }

                var current = trade.StatusID ?? PO_Draft;
                if (statusId == current) return new { success = true, statusID = current };

                bool allowed = (current, statusId) switch
                {
                    (PO_Draft, PO_Submitted) => true,
                    (PO_Submitted, PO_Approved) => true,
                    (PO_Submitted, PO_Rejected) => true,
                    // allow resubmit after rejection
                    (PO_Rejected, PO_Submitted) => true,
                    _ => false
                };

                if (!allowed)
                {
                    return new { success = false, result = $"Invalid status transition: {current} -> {statusId}" };
                }

                trade.StatusID = statusId;
                trade.UpdatedAt = DateTime.Now;
                trade.UpdatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name;
                if (!string.IsNullOrWhiteSpace(reason))
                {
                    // keep note short, do not overwrite if empty
                    trade.Note = reason;
                }

                _context.Trades.Update(trade);
                await _context.SaveChangesAsync();

                if (_audit != null)
                {
                    try
                    {
                        await _audit.WriteAsync("PurchaseOrder", "ChangeStatus", trade.ID.ToString(), new { trade.No, from = current, to = statusId, reason });
                    }
                    catch { }
                }

                return new { success = true, statusID = trade.StatusID };
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
        }
        public async Task<object> GetSearchList()
        {
            var q = from t in _context.Trades
                    where t.TradeTypeID == 4
                    join c in _context.Customers on t.CustomerID equals c.ID into cgroup
                    from cust in cgroup.DefaultIfEmpty()
                    join l in _context.Lookups.Where(x => x.Entity == "PurchaseOrderStatus") on t.StatusID equals (short?)l.Key into lgroup
                    from lp in lgroup.DefaultIfEmpty()
                    orderby t.ID descending
                    select new
                    {
                        id = t.ID,
                        no = t.No,
                        date = t.Date.ToString("yyyy-MM-dd"),
                        amount = t.Amount,
                        supplierName = cust != null ? cust.Name : "-",
                        createdBy = t.CreatedBy,
                        updatedBy = t.UpdatedBy,
                        statusID = t.StatusID,
                        status = lp != null ? lp.Name : null
                    };

            var list = await q.ToListAsync();
            return list;
        }
        public async Task<object> GetDetailListById(int id)
        {
            var spResult = await _procedure.uspGetPurchaseOrderItemListAsync(id);
            // Overlay PurchasePrice from Products table so PO shows buying price, not selling price
            var productIds = spResult.Where(x => x.ProductID.HasValue).Select(x => x.ProductID!.Value).Distinct().ToList();
            var priceMap = await _context.Products.AsNoTracking()
                .Where(p => productIds.Contains(p.ID))
                .Select(p => new { p.ID, p.PurchasePrice })
                .ToDictionaryAsync(x => x.ID, x => x.PurchasePrice);
            foreach (var item in spResult)
            {
                if (item.ProductID.HasValue && priceMap.TryGetValue(item.ProductID.Value, out var purchasePrice) && purchasePrice > 0)
                {
                    item.UnitPrice = purchasePrice;
                    item.SubTotal = purchasePrice * item.Quantity;
                }
            }
            return spResult;
        }

        public async Task<object> Save(PurchaseOrderModel model)
        {
            try
            {
                model.PurchaseOrderDetails ??= new List<PurchaseOrderDetailModel>();

                // Validate: SupplierID is required for Purchase Order
                if (model.SupplierID == null || model.SupplierID == 0)
                {
                    return (false, "Supplier is required", 0);
                }

                Trade tradeEntity;
                bool isNew = model.ID == 0;

                if (isNew)
                {
                    var gen = await _procedure.uspGenerateNoAsync("PO", model.Date);
                    var no = gen.FirstOrDefault()?.NewNumber ?? string.Empty;
                    tradeEntity = new Trade
                    {
                        No = no,
                        Amount = model.PurchaseOrderDetails.Sum(x => x.Subtotal),
                        CustomerID = model.SupplierID,
                        CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name,
                        Date = model.Date,
                        // initially Draft (Purchase Order workflow)
                        StatusID = PO_Draft,
                        TradeTypeID = 4,
                        CreatedAt = DateTime.Now,
                        Note = model.Note
                    };
                    await _context.Trades.AddAsync(tradeEntity);
                    await _context.SaveChangesAsync();

                    if (_audit != null)
                    {
                        try { await _audit.WriteAsync("PurchaseOrder", "Create", tradeEntity.ID.ToString(), new { tradeEntity.No, tradeEntity.Amount, tradeEntity.CustomerID }); } catch { }
                    }
                }
                else
                {
                    tradeEntity = await _context.Trades.FindAsync(model.ID) ?? throw new Exception("Purchase Order not found");

                    // block editing when submitted/approved (approval workflow)
                    if (IsPOEditLocked(tradeEntity.StatusID))
                    {
                        return new { success = false, result = "Purchase Order is submitted/approved and cannot be modified." };
                    }

                    // Prevent modification when PO already partially/fully paid
                    if (await HasSubmittedPaymentsAsync(tradeEntity.ID))
                    {
                        return new { success = false, result = "Purchase Order is locked and cannot be modified after payments have been submitted." };
                    }

                    tradeEntity.Amount = model.PurchaseOrderDetails.Sum(x => x.Subtotal);
                    tradeEntity.CustomerID = model.SupplierID;
                    tradeEntity.UpdatedAt = DateTime.Now;
                    tradeEntity.UpdatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name;
                    tradeEntity.Date = model.Date;
                    tradeEntity.Note = model.Note;
                    await _context.SaveChangesAsync();

                    if (_audit != null)
                    {
                        try { await _audit.WriteAsync("PurchaseOrder", "Update", tradeEntity.ID.ToString(), new { tradeEntity.No, tradeEntity.Amount, tradeEntity.CustomerID }); } catch { }
                    }
                }

                int tradeID = tradeEntity.ID;

                // When updating existing PO, remove deleted lines BEFORE adding/updating the current ones
                if (!isNew)
                {
                    var incomingIds = model.PurchaseOrderDetails.Where(x => x.ID > 0).Select(x => x.ID).ToHashSet();
                    var existingItems = await _context.PurchaseOrderItems.Where(x => x.TradeID == tradeID).ToListAsync();
                    var toDelete = existingItems.Where(x => !incomingIds.Contains(x.ID)).ToList();
                    if (toDelete.Any())
                    {
                        _context.PurchaseOrderItems.RemoveRange(toDelete);
                        await _context.SaveChangesAsync();
                    }
                }

                // Add / update current detail rows
                foreach (var d in model.PurchaseOrderDetails)
                {
                    var result = await SaveDetail(d, tradeID);
                    if (!result.success) return result; // early return on failure
                }

                // Recalculate paid amount from PaymentOuts (only count submitted payments)
                try
                {
                    var paid = await _context.PaymentOuts.Where(p => p.PurchaseOrderID == tradeID && p.StatusID == 2).Select(p => (decimal?)p.Amount).DefaultIfEmpty(0m).SumAsync();
                    tradeEntity.PaidAmount = paid;
                    // Keep PO workflow StatusID intact; only use IsLocked/PaidAmount for payment state.
                    if (tradeEntity.PaidAmount > 0)
                        tradeEntity.IsLocked = true;

                    _context.Trades.Update(tradeEntity);
                    await _context.SaveChangesAsync();
                }
                catch { /* ignore payment aggregation failures */ }

                return new { success = true, id = tradeEntity.ID, no = tradeEntity.No, statusID = tradeEntity.StatusID, amount = tradeEntity.Amount };
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
        }

        private async Task<(bool success, string result)> SaveDetail(PurchaseOrderDetailModel detail, int tradeID)
        {
            if (detail.ProductID == null || detail.ProductID == 0) return (false, "Product is required");
            if (detail.Quantity <= 0) return (false, "Quantity must be > 0");
            if (detail.ID == 0)
            {
                var entity = new PurchaseOrderItem
                {
                    TradeID = tradeID,
                    ProductID = detail.ProductID,
                    Quantity = detail.Quantity
                };
                await _context.PurchaseOrderItems.AddAsync(entity);
            }
            else
            {
                var entity = await _context.PurchaseOrderItems.FindAsync(detail.ID);
                if (entity == null) return (false, "Detail item not found");
                entity.ProductID = detail.ProductID;
                entity.Quantity = detail.Quantity;
                _context.PurchaseOrderItems.Update(entity);
            }
            await _context.SaveChangesAsync();
            return (true, string.Empty);
        }

        public async Task<object> Delete(int id)
        {
            try
            {
                var trade = await _context.Trades.FindAsync(id);
                if (trade == null) return new { success = false, result = "Purchase Order not found." };

                if (IsPOEditLocked(trade.StatusID))
                {
                    return new { success = false, result = "Purchase Order is submitted/approved and cannot be deleted." };
                }

                // prevent delete when partially/fully paid
                if (await HasSubmittedPaymentsAsync(id))
                {
                    return new { success = false, result = "Cannot delete Purchase Order that has payments." };
                }

                var details = await _context.PurchaseOrderItems.Where(x => x.TradeID == id).ToListAsync();
                if (details.Any()) _context.PurchaseOrderItems.RemoveRange(details);
                _context.Trades.Remove(trade);
                await _context.SaveChangesAsync();

                if (_audit != null)
                {
                    try { await _audit.WriteAsync("PurchaseOrder", "Delete", id.ToString(), new { trade.No }); } catch { }
                }
                return new { success = true };
            }
            catch (Exception e) { return new { success = false, result = e.Message }; }
        }
        public async Task<object> DeleteItem(int id)
        {
            try
            {
                var detail = await _context.PurchaseOrderItems.FindAsync(id);
                if (detail == null) return new { success = false, result = "Purchase Order item not found." };

                var trade = await _context.Trades.FindAsync(detail.TradeID);
                if (trade != null && IsPOEditLocked(trade.StatusID))
                {
                    return new { success = false, result = "Purchase Order is submitted/approved and cannot be modified." };
                }
                if (trade != null && await HasSubmittedPaymentsAsync(trade.ID))
                {
                    return new { success = false, result = "Cannot delete item from Purchase Order that has payments." };
                }

                _context.PurchaseOrderItems.Remove(detail);
                await _context.SaveChangesAsync();

                if (_audit != null)
                {
                    try { await _audit.WriteAsync("PurchaseOrder", "DeleteItem", detail.TradeID.ToString(), new { itemId = id, detail.ProductID, detail.Quantity }); } catch { }
                }
                return new { success = true };
            }
            catch (Exception e) { return new { success = false, result = e.Message }; }
        }

        // New: get purchase orders for a supplier
        public async Task<object> GetListBySupplier(int supplierId)
        {
            // return only purchase orders with outstanding amount > 0 (not fully paid) and not Closed (StatusID != 3)
            var list = await _context.Trades
                .Where(t => t.TradeTypeID == 4 && t.CustomerID == supplierId && (t.StatusID == null || t.StatusID != 3))
                .Select(t => new
                {
                    id = t.ID,
                    no = t.No,
                    date = t.Date.ToString("yyyy-MM-dd"),
                    amount = t.Amount,
                    // calculate paid using Sum on nullable decimal so EF can translate to SQL
                    paid = _context.PurchasePayments.Where(p => p.PurchaseOrderID == t.ID).Select(p => (decimal?)p.AmountPaid).Sum()
                })
                .ToListAsync();

            var filtered = list.Where(x => (x.amount - (x.paid ?? 0m)) > 0).Select(x => new { x.id, x.no, x.date, amount = x.amount, paid = x.paid, outstanding = x.amount - (x.paid ?? 0m) }).OrderByDescending(x => x.id).ToList();
            return filtered;
        }
    }
}
