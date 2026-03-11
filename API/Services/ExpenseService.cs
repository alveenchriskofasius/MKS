using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services;

public class ExpenseService : IExpenseService
{
    private readonly IExpenseRepository _repo;
    private readonly IHttpContextAccessor _http;

    public ExpenseService(IExpenseRepository repo, IHttpContextAccessor http)
    {
        _repo = repo;
        _http = http;
    }

    private string UserName => _http.HttpContext?.User?.Identity?.Name ?? "System";

    public Task<IEnumerable<ExpenseListItem>> GetList(DateTime? from, DateTime? to, string category)
        => _repo.GetList(from, to, category);

    public Task<ExpenseModel> Get(int id) => _repo.Get(id);

    public Task<object> Save(ExpenseModel model) => _repo.Save(model, UserName);

    public Task<object> Delete(int id) => _repo.Delete(id);

    public Task<ExpenseSummary> GetSummary() => _repo.GetSummary();
}
