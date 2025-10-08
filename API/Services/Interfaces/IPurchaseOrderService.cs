using API.Models;

namespace API.Services.Interfaces
{
    public interface IPurchaseOrderService
    {
        Task<PurchaseOrderModel> FillForm(int id);
        Task<object> GetSearchList();
        Task<object> GetDetailListById(int id);
        Task<object> Save(PurchaseOrderModel model);
        Task<object> Delete(int id);
        Task<object> DeleteItem(int id);
    }
}
