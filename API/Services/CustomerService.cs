using API.Context.Table;
using API.Repository.Interfaces;
using API.Services.Interfaces;
using MitraKaryaSystem.Models;

namespace API.Services
{
    public class CustomerService : ICustomerService
    {
        private readonly ICustomerRepository _repository;

        public CustomerService(ICustomerRepository repository)
        {
            _repository = repository;
        }
        public async Task<object> GetList()
        {
            return await _repository.GetList();
        }
        public async Task<object> Save(CustomerModel customer)
        {
            return await _repository.Save(customer);
        }
        public async Task<CustomerModel> FillForm(int id)
        {
            return await _repository.FillForm(id);
        }
        public async Task<object> Delete(int id)
        {
            return await _repository.Delete(id);
        }

        public async Task<List<Customer>> GetListModel()
        {
            return await _repository.GetListModel();
        }

        public async Task<object> GetDepositBalance(int supplierId)
        {
            return await _repository.GetDepositBalance(supplierId);
        }
    }
}
