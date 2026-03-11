using API.Models;

namespace API.Repository.Interfaces;

public interface IDebtRepository
{
    Task<IEnumerable<DebtSummaryItem>> GetReceivables();
    Task<IEnumerable<DebtSummaryItem>> GetPayables();
}
