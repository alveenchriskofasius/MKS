using API.Models;

namespace API.Services.Interfaces;

public interface IProfitLossService
{
    Task<ProfitLossResult> GetReport(DateTime? from, DateTime? to);
}
