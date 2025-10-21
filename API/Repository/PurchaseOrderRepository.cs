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
        private enum TradeStatus { Draft = 1, PartialPaid = 2, Paid = 3 }
        private static readonly HashSet<short> LockedStatuses = new HashSet<short> { (short)TradeStatus.PartialPaid, (short)TradeStatus.Paid };
        public PurchaseOrderRepository(MKSTableContext context, MKSSPContextProcedures procedure, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _procedure = procedure;
            _httpContextAccessor = httpContextAccessor;
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
        public async Task<object> GetDetailListById(int id) => await _procedure.uspGetPurchaseOrderItemListAsync(id);

        public async Task<object> Save(PurchaseOrderModel model)
        {
            try
            {
                model.PurchaseOrderDetails ??= new List<PurchaseOrderDetailModel>();
                Trade tradeEntity;
                bool isNew = model.ID == 0;

                if (isNew)
                {
                    var gen = await _procedure.uspGenerateNoAsync("PO", model.Date);
                    var no = gen.FirstOrDefault()?.NewPONumber ?? string.Empty;
                    tradeEntity = new Trade
                    {
                        No = no,
                        Amount = model.PurchaseOrderDetails.Sum(x => x.Subtotal),
                        CustomerID = model.SupplierID,
                        CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name,
                        Date = model.Date,
                        // initially Draft
                        StatusID = (short)TradeStatus.Draft,
                        TradeTypeID = 4,
                        CreatedAt = DateTime.Now,
                        Note = model.Note
                    };
                    await _context.Trades.AddAsync(tradeEntity);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    tradeEntity = await _context.Trades.FindAsync(model.ID) ?? throw new Exception("Purchase Order not found");

                    // Prevent modification when PO already partially/fully paid
                    if (tradeEntity.StatusID.HasValue && LockedStatuses.Contains(tradeEntity.StatusID.Value))
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
                    // set status based on paid vs amount
                    if (tradeEntity.PaidAmount >= tradeEntity.Amount)
                        tradeEntity.StatusID = (short)TradeStatus.Paid;
                    else if (tradeEntity.PaidAmount > 0)
                        tradeEntity.StatusID = (short)TradeStatus.PartialPaid;
                    else
                        tradeEntity.StatusID = (short)TradeStatus.Draft;

                    // if fully paid, mark locked
                    if (tradeEntity.StatusID == (short)TradeStatus.Paid)
                    {
                        tradeEntity.IsLocked = true;
                    }

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

                // prevent delete when partially/fully paid
                if (trade.StatusID.HasValue && LockedStatuses.Contains(trade.StatusID.Value))
                {
                    return new { success = false, result = "Cannot delete Purchase Order that has payments." };
                }

                var details = await _context.PurchaseOrderItems.Where(x => x.TradeID == id).ToListAsync();
                if (details.Any()) _context.PurchaseOrderItems.RemoveRange(details);
                _context.Trades.Remove(trade);
                await _context.SaveChangesAsync();
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
                if (trade != null && trade.StatusID.HasValue && LockedStatuses.Contains(trade.StatusID.Value))
                {
                    return new { success = false, result = "Cannot delete item from Purchase Order that has payments." };
                }

                _context.PurchaseOrderItems.Remove(detail);
                await _context.SaveChangesAsync();
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
