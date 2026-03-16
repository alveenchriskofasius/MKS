using API.Models;

namespace API.Services.Interfaces;

public interface ICustomerAgingService
{
    Task<CustomerAgingResult> GetAging(DateTime? asOfDate);
}
