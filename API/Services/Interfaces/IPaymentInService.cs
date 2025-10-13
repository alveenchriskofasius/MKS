using API.Models;

namespace API.Services.Interfaces;

public interface IPaymentInService
{
    Task<object> Create(PaymentInCreateRequest req);
    Task<PaymentInDto> Get(int id);
    Task<IEnumerable<PaymentInDto>> List(int? customerId, DateTime? from, DateTime? to, short? statusId, int? salesOrderId, int? salesInvoiceId);
    Task<object> UpdateStatus(int id, short statusId);
    Task<object> Delete(int id);
}
