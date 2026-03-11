using API.Context.Table;
using API.Models;
using API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Services;

public class CustomerStatementService : ICustomerStatementService
{
    private readonly MKSTableContext _ctx;
    public CustomerStatementService(MKSTableContext ctx) => _ctx = ctx;

    public async Task<CustomerStatementResult> GetStatement(int customerId, DateTime? from, DateTime? to)
    {
        var customer = await _ctx.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.ID == customerId);
        if (customer == null)
            return new CustomerStatementResult { CustomerName = "Not found" };

        var dateFrom = from ?? DateTime.MinValue;
        var dateTo = (to ?? DateTime.MaxValue).Date.AddDays(1);

        var lines = new List<StatementLine>();

        // Sales Orders / POS invoices for this customer
        var trades = await _ctx.Trades.AsNoTracking()
            .Where(t => t.CustomerID == customerId && t.TradeTypeID == 2 && t.StatusID >= 2
                        && t.Date >= dateFrom && t.Date < dateTo)
            .OrderBy(t => t.Date).ThenBy(t => t.ID)
            .ToListAsync();

        foreach (var t in trades)
        {
            var desc = t.Note != null && t.Note.StartsWith("POS") ? "POS Sale" : "Sales Order";
            lines.Add(new StatementLine
            {
                Date = t.Date,
                No = t.No,
                Type = "Invoice",
                Description = desc,
                Debit = t.Amount,
                Credit = 0
            });
        }

        // Payment In for this customer
        var payments = await _ctx.PaymentIns.AsNoTracking()
            .Where(p => p.CustomerID == customerId && p.StatusID == 2
                        && p.Date >= dateFrom && p.Date < dateTo)
            .OrderBy(p => p.Date).ThenBy(p => p.ID)
            .ToListAsync();

        foreach (var p in payments)
        {
            lines.Add(new StatementLine
            {
                Date = p.Date,
                No = p.No,
                Type = "Payment",
                Description = $"Payment ({p.Method ?? "-"}) — {p.Type ?? ""}",
                Debit = 0,
                Credit = p.Amount
            });
        }

        // Customer Deposits (these use SupplierID field but represent deposits)
        var deposits = await _ctx.CustomerDeposits.AsNoTracking()
            .Where(d => d.SupplierID == customerId)
            .ToListAsync();
        decimal totalDeposit = deposits.Sum(d => d.Amount);

        // Sort all lines chronologically
        lines = lines.OrderBy(l => l.Date).ThenByDescending(l => l.Type == "Invoice" ? 0 : 1).ToList();

        // Compute running balance
        decimal balance = 0;
        foreach (var line in lines)
        {
            balance += line.Debit - line.Credit;
            line.Balance = balance;
        }

        return new CustomerStatementResult
        {
            CustomerId = customerId,
            CustomerName = customer.Name,
            TotalInvoiced = lines.Sum(l => l.Debit),
            TotalPaid = lines.Sum(l => l.Credit),
            TotalDeposit = totalDeposit,
            OutstandingBalance = balance,
            Lines = lines
        };
    }
}
