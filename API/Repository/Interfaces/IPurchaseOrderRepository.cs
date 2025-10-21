using API.Models;

namespace API.Repository.Interfaces
{
    public interface IPurchaseOrderRepository
    {
        Task<PurchaseOrderModel> FillForm(int id);
        Task<object> GetSearchList();
        Task<object> GetDetailListById(int id);
        Task<object> Save(PurchaseOrderModel model);
        Task<object> Delete(int id);
        Task<object> DeleteItem(int id);
        // New: get purchase orders by supplier
        Task<object> GetListBySupplier(int supplierId);
    }
}
