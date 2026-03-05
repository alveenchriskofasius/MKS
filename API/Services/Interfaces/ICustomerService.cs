using API.Context.Table;
using MitraKaryaSystem.Models;

namespace API.Services.Interfaces
{
    public interface ICustomerService
    {
        public Task<object> GetList();
        Task<List<Customer>> GetListModel();
        public Task<object> Save(CustomerModel customer);
        public Task<CustomerModel> FillForm(int id);
        public Task<object> Delete(int id);
        public Task<object> GetDepositBalance(int supplierId);
    }
}
