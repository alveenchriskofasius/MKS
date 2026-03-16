using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class DeliveryOrderRepository : IDeliveryOrderRepository
{
    private readonly MKSTableContext _ctx; private readonly IHttpContextAccessor _http;
    private enum DeliveryOrderStatus { Pending = 1, Assigned = 2, OutForDelivery = 3, Delivered = 4, Canceled = 5 }
    private enum TradeStatus { Draft = 1, Paid = 2, Debt = 3, PartialRefund = 4, Refund = 5, Exchange = 6, PartialExchange = 7, Completed = 8 }
    public DeliveryOrderRepository(MKSTableContext ctx, IHttpContextAccessor http) { _ctx = ctx; _http = http; }

    private async Task<string> GenerateNo(DateTime date) { string prefix = "DO" + date.ToString("yyMMdd"); int seq = await _ctx.DeliveryOrders.CountAsync(d => d.CreatedAt.Date == date.Date) + 1; return prefix + seq.ToString("D3"); }

    public async Task<object> CreateFromSalesOrder(int salesOrderID, string userName)
    {
        var so = await _ctx.Trades.FindAsync(salesOrderID);
        if (so == null) return new { success = false, result = "Sales Order not found" };
        if (await _ctx.DeliveryOrders.AnyAsync(d => d.SalesOrderID == salesOrderID)) return new { success = false, result = "Delivery Order already exists" };
        var soItems = await _ctx.SalesOrderItems.Where(i => i.TradeID == salesOrderID).ToListAsync();
        if (!soItems.Any()) return new { success = false, result = "Sales Order has no items" };
        var doEntity = new DeliveryOrder { No = await GenerateNo(DateTime.Now), SalesOrderID = salesOrderID, StatusID = (short)DeliveryOrderStatus.Pending, CreatedAt = DateTime.Now, CreatedBy = userName, DeliveryAddress = so.Note }; // simplistic address reuse
        await _ctx.DeliveryOrders.AddAsync(doEntity); await _ctx.SaveChangesAsync();
        foreach (var i in soItems) { await _ctx.DeliveryOrderItems.AddAsync(new DeliveryOrderItem { DeliveryOrderID = doEntity.ID, SalesOrderItemID = i.ID, ProductID = i.ProductID ?? 0, Quantity = i.Quantity, CreatedAt = DateTime.Now, CreatedBy = userName }); }
        await _ctx.SaveChangesAsync();
        return new { success = true, id = doEntity.ID, no = doEntity.No };
    }

    public async Task<object> Get(int id)
    {
        var d = await _ctx.DeliveryOrders
            .Include(x => x.SalesOrder)
            .Include(x => x.DriverUser)
            .FirstOrDefaultAsync(x => x.ID == id);
        if (d == null) return new DeliveryOrderModel();
        var items = await _ctx.DeliveryOrderItems.Where(x => x.DeliveryOrderID == id).ToListAsync();
        var productIds = items.Select(i => i.ProductID).Distinct().ToList();
        var productNames = await _ctx.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.ID))
            .Select(p => new { p.ID, p.Name })
            .ToDictionaryAsync(p => p.ID, p => p.Name);
        return new
        {
            id = d.ID,
            no = d.No,
            salesOrderID = d.SalesOrderID,
            salesOrderNo = d.SalesOrder?.No,
            statusID = d.StatusID,
            driverUserID = d.DriverUserID,
            driverName = d.DriverUser?.Name,
            deliveryAddress = d.DeliveryAddress,
            assignedAt = d.AssignedAt,
            deliveredAt = d.DeliveredAt,
            items = items.Select(i => new
            {
                id = i.ID,
                deliveryOrderID = i.DeliveryOrderID,
                salesOrderItemID = i.SalesOrderItemID,
                productID = i.ProductID,
                productName = productNames.TryGetValue(i.ProductID, out var name) ? name : null,
                quantity = i.Quantity
            }).ToList()
        };
    }

    public async Task<object> List(short? statusID = null, int? driverUserID = null)
    {
        var q = _ctx.DeliveryOrders.AsQueryable();
        if (statusID.HasValue) q = q.Where(d => d.StatusID == statusID.Value);
        if (driverUserID.HasValue) q = q.Where(d => d.DriverUserID == driverUserID.Value);
        // include related SalesOrder and DriverUser to be able to return readable names/nos
        var list = await q
            .OrderByDescending(d => d.ID)
            .Select(d => new
            {
                d.ID,
                d.No,
                d.SalesOrderID,
                SalesOrderNo = d.SalesOrder != null ? d.SalesOrder.No : null,
                d.StatusID,
                d.DriverUserID,
                DriverName = d.DriverUser != null ? d.DriverUser.Name : null,
                d.DeliveryAddress
            })
            .ToListAsync();
        return list;
    }

    public async Task<object> AssignDriver(int id, int driverUserID, string userName)
    {
        var d = await _ctx.DeliveryOrders.FindAsync(id); if (d == null) return new { success = false, result = "Delivery Order not found" };
        if (d.StatusID != (short)DeliveryOrderStatus.Pending) return new { success = false, result = "Only pending DO can assign driver" };
        d.DriverUserID = driverUserID; d.StatusID = (short)DeliveryOrderStatus.Assigned; d.AssignedAt = DateTime.Now; d.UpdatedAt = DateTime.Now; d.UpdatedBy = userName; _ctx.DeliveryOrders.Update(d); await _ctx.SaveChangesAsync();
        return new { success = true };
    }

    public async Task<object> UpdateStatus(int id, short newStatus, string userName)
    {
        var d = await _ctx.DeliveryOrders.FindAsync(id); if (d == null) return new { success = false, result = "Delivery Order not found" };
        var current = (DeliveryOrderStatus)d.StatusID; var target = (DeliveryOrderStatus)newStatus;
        bool valid = (current, target) switch
        {
            (DeliveryOrderStatus.Pending, DeliveryOrderStatus.Assigned) => d.DriverUserID != null,
            (DeliveryOrderStatus.Assigned, DeliveryOrderStatus.OutForDelivery) => true,
            (DeliveryOrderStatus.OutForDelivery, DeliveryOrderStatus.Delivered) => true,
            _ => false
        };
        if (!valid) return new { success = false, result = "Invalid status transition" };
        d.StatusID = (short)target; d.UpdatedAt = DateTime.Now; d.UpdatedBy = userName; if (target == DeliveryOrderStatus.Delivered) d.DeliveredAt = DateTime.Now; _ctx.DeliveryOrders.Update(d); await _ctx.SaveChangesAsync();
        // Auto-complete Sales Order when delivered (only if not in a return status)
        if (target == DeliveryOrderStatus.Delivered)
        {
            var so = await _ctx.Trades.FindAsync(d.SalesOrderID);
            if (so != null)
            {
                var returnStatuses = new HashSet<short> { (short)TradeStatus.PartialRefund, (short)TradeStatus.Refund, (short)TradeStatus.Exchange, (short)TradeStatus.PartialExchange };
                if (!returnStatuses.Contains(so.StatusID ?? 0))
                {
                    so.StatusID = (short)TradeStatus.Completed;
                }
                so.IsLocked = true;
                _ctx.Trades.Update(so);
                await _ctx.SaveChangesAsync();
            }
        }
        return new { success = true };
    }
}
