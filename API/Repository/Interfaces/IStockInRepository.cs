using API.Context.SP;
using MitraKaryaSystem.Models;

namespace API.Repository.Interfaces
{
    public interface IStockInRepository
    {
        Task<StockInModel> FillForm(int id);
        Task<StockInDetailModel> FillFormDetail(int id);
        Task<object> ScanBarcode(string barcode);
        Task<object> Save(StockInModel purchaseOrderModel);
        Task<object> GetStockInList();
        Task<List<uspGetDetailListByIdResult>> GetDetailListById(int id);
        Task<object> DeleteProductById(int id);
        Task<object> DeleteById(int id);
        Task<object> Submit(int id);
        Task<object> Verify(int id);
        Task<object> CreateFromPurchaseOrder(int poId);
        Task<object> GetApprovedPurchaseOrders();
    }
}
