using API.Context.Table;
using MitraKaryaSystem.Models;

namespace API.Repository.Interfaces
{
    public interface ICustomerRepository
    {
        public Task<object> GetList();
        Task<List<Customer>> GetListModel();
        public Task<object> Save(CustomerModel user);
        public Task<CustomerModel> FillForm(int id);
        public Task<object> Delete(int id);
        public Task<object> GetDepositBalance(int supplierId);
    }
}
