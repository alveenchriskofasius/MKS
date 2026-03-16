
using API.Models;
using MitraKaryaSystem.Models;

namespace API.Repository.Interfaces
{
    public interface ISupplierRepository
    {
        Task<object> GetSupplierList();
        Task SaveSupplier(SupplierModel category);
        Task DeleteSupplier(int id);
        Task<SupplierModel> FillFormSupplier(int id);
        Task<object> GetSalesPersonsBySupplier(int supplierId);
        Task<object> GetAllSalesPersons();
        Task<object> SaveSalesPerson(SalesPersonModel model, string userName);
        Task<object> DeleteSalesPerson(int id);
    }
}
