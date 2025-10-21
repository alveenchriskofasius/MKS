using API.Models;

namespace API.Services.Interfaces
{
    public interface IPaymentOutService
    {
        Task<(bool success, string message, int id)> Create(PaymentOutCreateRequest req);
        Task<IEnumerable<PaymentOutDto>> List(int? supplierId = null, DateTime? from = null, DateTime? to = null, short? statusId = null, int? purchaseOrderId = null);
    }
}
