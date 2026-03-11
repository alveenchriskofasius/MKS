using API.Models;

namespace API.Services.Interfaces;

public interface IDebtService
{
    Task<IEnumerable<DebtSummaryItem>> GetReceivables();
    Task<IEnumerable<DebtSummaryItem>> GetPayables();
}
