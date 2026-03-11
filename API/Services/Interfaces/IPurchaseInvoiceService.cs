using API.Models;

namespace API.Services.Interfaces;

public interface IPurchaseInvoiceService
{
    Task<object> CreateFromPO(int purchaseOrderId);
    Task<PurchaseInvoiceModel> Get(int id);
    Task<IEnumerable<PurchaseInvoiceListItem>> List(int? supplierId, DateTime? from, DateTime? to, short? statusId);
    Task<object> Issue(int id);
    Task<object> Cancel(int id);
    Task<object> SetAmount(int id, decimal amount);
    Task<object> ExistsForPO(int purchaseOrderId);
}
