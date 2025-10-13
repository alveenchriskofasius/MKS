using API.Models;

namespace API.Services.Interfaces;

public interface ISalesInvoiceService
{
    Task<object> CreateFromSO(int salesOrderId);
    Task<SalesInvoiceModel> Get(int id);
    Task<IEnumerable<SalesInvoiceListItem>> List(int? customerId, DateTime? from, DateTime? to, short? statusId);
    Task<object> Issue(int id);
    Task<object> Cancel(int id);
    Task<object> SetAmount(int id, decimal amount);
    Task<object> ExistsForSO(int salesOrderId);
}
