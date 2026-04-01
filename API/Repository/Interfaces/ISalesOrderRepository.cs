using API.Models;

namespace API.Repository.Interfaces
{
    public interface ISalesOrderRepository
    {
        Task<object> Save(SalesOrderModel salesOrder);
        Task<SalesOrderModel> FillForm(int id);
        Task<object> GetSalesOrderDetailById(int id);
        Task<object> DeleteProductById(int id);
        Task<object> GetSearchList(short? tradeTypeFilter = null);
        Task<object> Delete(int id);
        Task<List<SalesOrderDetailModel>> GetSalesOrderDetailModelById(int id);
    }
}
