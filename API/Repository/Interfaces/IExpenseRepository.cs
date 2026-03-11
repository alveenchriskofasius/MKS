using API.Models;

namespace API.Repository.Interfaces;

public interface IExpenseRepository
{
    Task<IEnumerable<ExpenseListItem>> GetList(DateTime? from, DateTime? to, string category);
    Task<ExpenseModel> Get(int id);
    Task<object> Save(ExpenseModel model, string userName);
    Task<object> Delete(int id);
    Task<ExpenseSummary> GetSummary();
}
