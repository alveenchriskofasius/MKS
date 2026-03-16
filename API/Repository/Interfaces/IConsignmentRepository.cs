using API.Models;

namespace API.Repository.Interfaces;

public interface IConsignmentRepository
{
    Task<IEnumerable<ConsignmentListItem>> GetList();
    Task<ConsignmentModel> Get(int id);
    Task<object> Save(ConsignmentModel model, string userName);
    Task<object> Delete(int id);
    Task<object> AddItem(ConsignmentItemModel item, string userName);
    Task<object> RemoveItem(int itemId);
    Task<object> RecordSale(RecordSaleModel model, string userName);
    Task<object> RecordReturn(RecordReturnModel model, string userName);
    Task<object> Settle(int id, string userName);
    Task<object> GetItems(int consignmentId);
    Task AutoDeductConsignmentSales(Dictionary<int, int> productQtyMap, string userName);
    Task AutoReverseConsignmentSales(Dictionary<int, int> productQtyMap, string userName);
}
