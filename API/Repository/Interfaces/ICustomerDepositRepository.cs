using API.Models;

namespace API.Repository.Interfaces;

public interface ICustomerDepositRepository
{
    Task<IEnumerable<CustomerDepositModel>> GetList();
    Task<CustomerDepositModel> Get(int id);
    Task<object> Adjust(int supplierId, decimal amount);
}
