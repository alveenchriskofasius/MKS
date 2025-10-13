using API.Models;

namespace API.Repository.Interfaces;

public interface IPaymentInRepository
{
    Task<(bool success, string message, int id, string no, decimal paidAmount, short paymentStatusId)> Create(PaymentInCreateRequest req);
    Task<PaymentInDto> Get(int id);
    Task<IEnumerable<PaymentInDto>> List(int? customerId, DateTime? from, DateTime? to, short? statusId, int? salesOrderId, int? salesInvoiceId);
    Task<(bool success, string message)> UpdateStatus(int id, short statusId);
    Task<(bool success, string message)> Delete(int id);
}
