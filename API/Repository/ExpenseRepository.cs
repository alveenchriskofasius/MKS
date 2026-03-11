using API.Context.SP;
using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class ExpenseRepository : IExpenseRepository
{
    private readonly MKSTableContext _ctx;
    private readonly MKSSPContextProcedures _procedure;

    public ExpenseRepository(MKSTableContext ctx, MKSSPContextProcedures procedure)
    {
        _ctx = ctx;
        _procedure = procedure;
    }

    public async Task<IEnumerable<ExpenseListItem>> GetList(DateTime? from, DateTime? to, string category)
    {
        var q = _ctx.Expenses.AsNoTracking().AsQueryable();
        if (from.HasValue) q = q.Where(e => e.Date >= from.Value.Date);
        if (to.HasValue) q = q.Where(e => e.Date <= to.Value.Date.AddDays(1));
        if (!string.IsNullOrWhiteSpace(category) && category != "All")
            q = q.Where(e => e.Category == category);

        return await q.OrderByDescending(e => e.Date)
            .Select(e => new ExpenseListItem
            {
                ID = e.ID,
                No = e.No,
                Date = e.Date.ToString("yyyy-MM-dd"),
                Category = e.Category,
                Description = e.Description,
                Amount = e.Amount,
                CreatedBy = e.CreatedBy
            }).ToListAsync();
    }

    public async Task<ExpenseModel> Get(int id)
    {
        var e = await _ctx.Expenses.FindAsync(id);
        if (e == null) return new ExpenseModel();
        return new ExpenseModel
        {
            ID = e.ID,
            Date = e.Date,
            No = e.No,
            Category = e.Category,
            Description = e.Description,
            Amount = e.Amount
        };
    }

    public async Task<object> Save(ExpenseModel model, string userName)
    {
        try
        {
            if (model.ID == 0)
            {
                var noResult = await _procedure.uspGenerateNoAsync("EXP", model.Date);
                var no = noResult.FirstOrDefault()?.NewNumber ?? $"EXP{model.Date:yyMMddHHmmss}";
                var entity = new Expense
                {
                    Date = model.Date,
                    No = no,
                    Category = model.Category,
                    Description = model.Description,
                    Amount = model.Amount,
                    CreatedBy = userName,
                    CreatedAt = DateTime.Now
                };
                await _ctx.Expenses.AddAsync(entity);
                await _ctx.SaveChangesAsync();
                return new { success = true, id = entity.ID };
            }
            else
            {
                var entity = await _ctx.Expenses.FindAsync(model.ID);
                if (entity == null) return new { success = false, error = "Expense not found." };
                entity.Date = model.Date;
                entity.Category = model.Category;
                entity.Description = model.Description;
                entity.Amount = model.Amount;
                entity.UpdatedBy = userName;
                entity.UpdatedAt = DateTime.Now;
                _ctx.Expenses.Update(entity);
                await _ctx.SaveChangesAsync();
                return new { success = true, id = entity.ID };
            }
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.InnerException?.Message ?? ex.Message };
        }
    }

    public async Task<object> Delete(int id)
    {
        try
        {
            var entity = await _ctx.Expenses.FindAsync(id);
            if (entity == null) return new { success = false, error = "Not found." };
            _ctx.Expenses.Remove(entity);
            await _ctx.SaveChangesAsync();
            return new { success = true };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.InnerException?.Message ?? ex.Message };
        }
    }

    public async Task<ExpenseSummary> GetSummary()
    {
        var now = DateTime.Now;
        var firstOfMonth = new DateTime(now.Year, now.Month, 1);
        var firstOfLastMonth = firstOfMonth.AddMonths(-1);

        var thisMonth = await _ctx.Expenses.AsNoTracking()
            .Where(e => e.Date >= firstOfMonth)
            .SumAsync(e => (decimal?)e.Amount) ?? 0;

        var lastMonth = await _ctx.Expenses.AsNoTracking()
            .Where(e => e.Date >= firstOfLastMonth && e.Date < firstOfMonth)
            .SumAsync(e => (decimal?)e.Amount) ?? 0;

        var byCategory = await _ctx.Expenses.AsNoTracking()
            .Where(e => e.Date >= firstOfMonth)
            .GroupBy(e => e.Category)
            .Select(g => new ExpenseCategorySummary
            {
                Category = g.Key,
                Total = g.Sum(x => x.Amount),
                Count = g.Count()
            }).ToListAsync();

        return new ExpenseSummary
        {
            TotalThisMonth = thisMonth,
            TotalLastMonth = lastMonth,
            ByCategory = byCategory
        };
    }
}
