using API.Context.Table;
using API.Models;
using API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Services;

public class CustomerAgingService : ICustomerAgingService
{
    private readonly MKSTableContext _ctx;
    public CustomerAgingService(MKSTableContext ctx) => _ctx = ctx;

    public async Task<CustomerAgingResult> GetAging(DateTime? asOfDate)
    {
        var today = (asOfDate ?? DateTime.Today).Date;

        // All receivable trades: Sales Orders / POS with outstanding balance
        var trades = await _ctx.Trades.AsNoTracking()
            .Where(t => t.TradeTypeID == 2
                        && t.Amount > (t.PaidAmount ?? 0m)
                        && t.CustomerID != null)
            .Select(t => new
            {
                t.ID,
                t.Date,
                t.No,
                t.CustomerID,
                Outstanding = t.Amount - (t.PaidAmount ?? 0m)
            })
            .ToListAsync();

        // Customer lookup
        var customerIds = trades.Select(t => t.CustomerID.Value).Distinct().ToList();
        var customers = await _ctx.Customers.AsNoTracking()
            .Where(c => customerIds.Contains(c.ID) && !c.IsSupplier)
            .ToDictionaryAsync(c => c.ID, c => c.Name);

        // Group by customer and bucket by age
        var grouped = trades
            .Where(t => customers.ContainsKey(t.CustomerID.Value))
            .GroupBy(t => t.CustomerID.Value)
            .Select(g =>
            {
                var row = new CustomerAgingRow
                {
                    CustomerID = g.Key,
                    CustomerName = customers.GetValueOrDefault(g.Key, "-"),
                    InvoiceCount = g.Count(),
                    OldestInvoiceDate = g.Min(t => t.Date).ToString("yyyy-MM-dd")
                };

                foreach (var t in g)
                {
                    var age = (today - t.Date.Date).Days;
                    if (age <= 30) row.Current += t.Outstanding;
                    else if (age <= 60) row.Days31_60 += t.Outstanding;
                    else if (age <= 90) row.Days61_90 += t.Outstanding;
                    else row.Over90 += t.Outstanding;
                }

                row.Total = row.Current + row.Days31_60 + row.Days61_90 + row.Over90;
                return row;
            })
            .OrderByDescending(r => r.Total)
            .ToList();

        return new CustomerAgingResult
        {
            AsOfDate = today,
            TotalOutstanding = grouped.Sum(r => r.Total),
            TotalCurrent = grouped.Sum(r => r.Current),
            Total31_60 = grouped.Sum(r => r.Days31_60),
            Total61_90 = grouped.Sum(r => r.Days61_90),
            TotalOver90 = grouped.Sum(r => r.Over90),
            Rows = grouped
        };
    }
}
