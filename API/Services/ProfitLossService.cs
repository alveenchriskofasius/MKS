using API.Context.Table;
using API.Models;
using API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Services;

public class ProfitLossService : IProfitLossService
{
    private readonly MKSTableContext _ctx;
    public ProfitLossService(MKSTableContext ctx) => _ctx = ctx;

    public async Task<ProfitLossResult> GetReport(DateTime? from, DateTime? to)
    {
        var dateFrom = from ?? new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1);
        var dateTo = (to ?? DateTime.Now).Date.AddDays(1);

        // Revenue: Sales Orders (TradeTypeID=2) that are Paid/Debt (StatusID >= 2)
        var salesTrades = await _ctx.Trades.AsNoTracking()
            .Where(t => t.TradeTypeID == 2 && t.StatusID >= 2 && t.Date >= dateFrom && t.Date < dateTo)
            .ToListAsync();

        decimal posSales = salesTrades.Where(t => t.Note != null && t.Note.StartsWith("POS")).Sum(t => t.Amount);
        decimal soSales = salesTrades.Where(t => t.Note == null || !t.Note.StartsWith("POS")).Sum(t => t.Amount);
        decimal totalRevenue = posSales + soSales;

        var revenueLines = new List<ProfitLossLine>();
        if (posSales > 0) revenueLines.Add(new ProfitLossLine { Category = "POS Sales", Amount = posSales });
        if (soSales > 0) revenueLines.Add(new ProfitLossLine { Category = "Sales Orders", Amount = soSales });

        // COGS: Purchase Orders (TradeTypeID=4) that are approved/completed
        var purchaseTrades = await _ctx.Trades.AsNoTracking()
            .Where(t => t.TradeTypeID == 4 && t.StatusID >= 2 && t.Date >= dateFrom && t.Date < dateTo)
            .ToListAsync();
        decimal totalCogs = purchaseTrades.Sum(t => t.Amount);

        // Expenses
        var expenses = await _ctx.Expenses.AsNoTracking()
            .Where(e => e.Date >= dateFrom && e.Date < dateTo)
            .ToListAsync();

        var expenseLines = expenses
            .GroupBy(e => e.Category)
            .Select(g => new ProfitLossLine { Category = g.Key, Amount = g.Sum(x => x.Amount) })
            .OrderByDescending(l => l.Amount)
            .ToList();
        decimal totalExpenses = expenses.Sum(e => e.Amount);

        return new ProfitLossResult
        {
            Revenue = totalRevenue,
            COGS = totalCogs,
            GrossProfit = totalRevenue - totalCogs,
            Expenses = totalExpenses,
            NetProfit = totalRevenue - totalCogs - totalExpenses,
            RevenueLines = revenueLines,
            ExpenseLines = expenseLines
        };
    }
}
