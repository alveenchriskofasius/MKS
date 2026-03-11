using API.Models;

namespace API.Services.Interfaces;

public interface ICustomerDepositService
{
    Task<IEnumerable<CustomerDepositModel>> GetList();
    Task<CustomerDepositModel> Get(int id);
    Task<object> Adjust(int supplierId, decimal amount);
}
