using API.Context.Table;
using API.Models;
using API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Services;

public class NotificationService : INotificationService
{
    private readonly MKSTableContext _ctx;
    private const int LowStockThresholdDefault = 5;

    public NotificationService(MKSTableContext ctx) => _ctx = ctx;

    public async Task<IEnumerable<AlertItem>> GetAlerts()
    {
        var alerts = new List<AlertItem>();
        var now = DateTime.Now;

        // 1. Low Stock alerts
        var lowStockProducts = await _ctx.Products.AsNoTracking()
            .Where(p => p.StockQuantity <= (p.LowStockThreshold ?? LowStockThresholdDefault))
            .OrderBy(p => p.StockQuantity)
            .Take(50)
            .ToListAsync();

        foreach (var p in lowStockProducts)
        {
            var severity = p.StockQuantity <= 0 ? "danger" : "warning";
            alerts.Add(new AlertItem
            {
                Type = "LowStock",
                Severity = severity,
                Title = p.StockQuantity <= 0 ? "Out of Stock" : "Low Stock",
                Message = $"{p.Name} — stock: {p.StockQuantity}",
                Link = "/Notification",
                Date = now,
                Data = new { productId = p.ID, stock = p.StockQuantity, threshold = p.LowStockThreshold ?? LowStockThresholdDefault }
            });
        }

        // 2. Overdue debts (Trade with StatusID=3 i.e. Debt, older than 30 days)
        var thirtyDaysAgo = now.AddDays(-30);
        var overdueTrades = await (
            from t in _ctx.Trades.AsNoTracking()
            where t.StatusID == 3 && t.Date < thirtyDaysAgo && t.TradeTypeID == 2
            join c in _ctx.Customers.AsNoTracking() on t.CustomerID equals c.ID into cg
            from cust in cg.DefaultIfEmpty()
            orderby t.Date
            select new { t.ID, t.No, t.Date, t.Amount, PaidAmount = t.PaidAmount ?? 0m, CustomerName = cust != null ? cust.Name : "Umum" }
        ).Take(50).ToListAsync();

        foreach (var d in overdueTrades)
        {
            var outstanding = d.Amount - d.PaidAmount;
            var daysOverdue = (int)(now - d.Date).TotalDays;
            alerts.Add(new AlertItem
            {
                Type = "OverdueDebt",
                Severity = daysOverdue > 60 ? "danger" : "warning",
                Title = "Overdue Debt",
                Message = $"{d.No} — {d.CustomerName} — Rp {outstanding:N0} ({daysOverdue} days)",
                Link = "/Debt",
                Date = d.Date,
                Data = new { tradeId = d.ID, no = d.No, outstanding, daysOverdue }
            });
        }

        // 3. Pending PO Approvals (Trade with TradeTypeID=4, StatusID=1)
        var pendingPOs = await (
            from t in _ctx.Trades.AsNoTracking()
            where t.TradeTypeID == 4 && t.StatusID == 1
            orderby t.CreatedAt descending
            select new { t.ID, t.No, t.Date, t.Amount, t.CreatedBy }
        ).Take(20).ToListAsync();

        foreach (var po in pendingPOs)
        {
            alerts.Add(new AlertItem
            {
                Type = "PendingApproval",
                Severity = "info",
                Title = "Pending PO Approval",
                Message = $"{po.No} — Rp {po.Amount:N0} by {po.CreatedBy}",
                Link = "/PurchaseOrder",
                Date = po.Date,
                Data = new { tradeId = po.ID, no = po.No }
            });
        }

        // 4. Expiring Consignments (StatusID=1 active, within 7 days or overdue)
        var sevenDaysFromNow = now.AddDays(7);
        var consignments = await _ctx.Consignments.AsNoTracking()
            .Where(c => c.StatusID == 1)
            .OrderBy(c => c.Date)
            .Take(20)
            .ToListAsync();

        foreach (var c in consignments.Where(c => c.Date.AddDays(30) <= sevenDaysFromNow))
        {
            var expiryDate = c.Date.AddDays(30);
            var isOverdue = expiryDate < now;
            alerts.Add(new AlertItem
            {
                Type = "ExpiringConsignment",
                Severity = isOverdue ? "danger" : "warning",
                Title = isOverdue ? "Overdue Consignment" : "Expiring Consignment",
                Message = $"{c.No} — {(isOverdue ? "overdue" : $"expires {expiryDate:dd MMM yyyy}")}",
                Link = "/Consignment",
                Date = c.Date,
                Data = new { consignmentId = c.ID, no = c.No }
            });
        }

        return alerts.OrderByDescending(a => a.Severity == "danger" ? 2 : a.Severity == "warning" ? 1 : 0)
                     .ThenByDescending(a => a.Date);
    }

    public async Task<int> GetCount()
    {
        var now = DateTime.Now;
        int count = 0;

        count += await _ctx.Products.AsNoTracking()
            .CountAsync(p => p.StockQuantity <= (p.LowStockThreshold ?? LowStockThresholdDefault));

        var thirtyDaysAgo = now.AddDays(-30);
        count += await _ctx.Trades.AsNoTracking()
            .CountAsync(t => t.StatusID == 3 && t.Date < thirtyDaysAgo && t.TradeTypeID == 2);

        count += await _ctx.Trades.AsNoTracking()
            .CountAsync(t => t.TradeTypeID == 4 && t.StatusID == 1);

        var sevenDaysFromNow = now.AddDays(7);
        var cutoff = sevenDaysFromNow.AddDays(-30);
        count += await _ctx.Consignments.AsNoTracking()
            .CountAsync(c => c.StatusID == 1 && c.Date.AddDays(30) <= sevenDaysFromNow);

        return count;
    }
}
