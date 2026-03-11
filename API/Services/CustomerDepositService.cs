using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services;

public class CustomerDepositService : ICustomerDepositService
{
    private readonly ICustomerDepositRepository _repo;
    public CustomerDepositService(ICustomerDepositRepository repo) => _repo = repo;

    public Task<IEnumerable<CustomerDepositModel>> GetList() => _repo.GetList();
    public Task<CustomerDepositModel> Get(int id) => _repo.Get(id);
    public Task<object> Adjust(int supplierId, decimal amount) => _repo.Adjust(supplierId, amount);
}
