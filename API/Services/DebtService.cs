using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services;

public class DebtService : IDebtService
{
    private readonly IDebtRepository _repo;
    public DebtService(IDebtRepository repo) => _repo = repo;

    public Task<IEnumerable<DebtSummaryItem>> GetReceivables() => _repo.GetReceivables();
    public Task<IEnumerable<DebtSummaryItem>> GetPayables() => _repo.GetPayables();
}
