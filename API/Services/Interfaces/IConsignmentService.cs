using API.Models;

namespace API.Services.Interfaces;

public interface IConsignmentService
{
    Task<IEnumerable<ConsignmentListItem>> GetList();
    Task<ConsignmentModel> Get(int id);
    Task<object> Save(ConsignmentModel model);
    Task<object> Delete(int id);
    Task<object> AddItem(ConsignmentItemModel item);
    Task<object> RemoveItem(int itemId);
    Task<object> RecordSale(RecordSaleModel model);
    Task<object> RecordReturn(RecordReturnModel model);
    Task<object> Settle(int id);
    Task<object> GetItems(int consignmentId);
}
