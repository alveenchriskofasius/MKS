using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class DebtRepository : IDebtRepository
{
    private readonly MKSTableContext _ctx;

    public DebtRepository(MKSTableContext ctx) => _ctx = ctx;

    /// <summary>
    /// Receivables: Sales Orders (TradeTypeID=2) with outstanding balance (Amount > PaidAmount).
    /// </summary>
    public async Task<IEnumerable<DebtSummaryItem>> GetReceivables()
    {
        var list = await _ctx.Trades.AsNoTracking()
            .Where(t => t.TradeTypeID == 2 && t.Amount > (t.PaidAmount ?? 0m))
            .Join(_ctx.Customers.AsNoTracking(),
                  t => t.CustomerID, c => c.ID,
                  (t, c) => new { t, c })
            .OrderByDescending(x => x.t.Date)
            .Select(x => new DebtSummaryItem
            {
                TradeID = x.t.ID,
                No = x.t.No,
                Date = x.t.Date.ToString("yyyy-MM-dd"),
                Type = "Receivable",
                CustomerID = x.t.CustomerID,
                CustomerName = x.c.Name ?? "-",
                Amount = x.t.Amount,
                PaidAmount = x.t.PaidAmount ?? 0m,
                Outstanding = x.t.Amount - (x.t.PaidAmount ?? 0m),
                StatusID = x.t.StatusID
            })
            .ToListAsync();
        return list;
    }

    /// <summary>
    /// Payables: Purchase Orders (TradeTypeID=4) with outstanding balance (Amount > PaidAmount).
    /// </summary>
    public async Task<IEnumerable<DebtSummaryItem>> GetPayables()
    {
        var list = await _ctx.Trades.AsNoTracking()
            .Where(t => t.TradeTypeID == 4 && t.Amount > (t.PaidAmount ?? 0m))
            .GroupJoin(_ctx.Customers.AsNoTracking(),
                       t => t.CustomerID, c => c.ID,
                       (t, cg) => new { t, cg })
            .SelectMany(x => x.cg.DefaultIfEmpty(), (x, c) => new { x.t, c })
            .OrderByDescending(x => x.t.Date)
            .Select(x => new DebtSummaryItem
            {
                TradeID = x.t.ID,
                No = x.t.No,
                Date = x.t.Date.ToString("yyyy-MM-dd"),
                Type = "Payable",
                CustomerID = x.t.CustomerID,
                CustomerName = x.c != null ? x.c.Name : "-",
                Amount = x.t.Amount,
                PaidAmount = x.t.PaidAmount ?? 0m,
                Outstanding = x.t.Amount - (x.t.PaidAmount ?? 0m),
                StatusID = x.t.StatusID
            })
            .ToListAsync();
        return list;
    }
}
