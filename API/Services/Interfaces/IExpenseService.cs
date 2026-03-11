using API.Models;

namespace API.Services.Interfaces;

public interface IExpenseService
{
    Task<IEnumerable<ExpenseListItem>> GetList(DateTime? from, DateTime? to, string category);
    Task<ExpenseModel> Get(int id);
    Task<object> Save(ExpenseModel model);
    Task<object> Delete(int id);
    Task<ExpenseSummary> GetSummary();
}
