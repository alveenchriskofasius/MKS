using API.Models;

namespace API.Services.Interfaces;

public interface ICustomerStatementService
{
    Task<CustomerStatementResult> GetStatement(int customerId, DateTime? from, DateTime? to);
}
