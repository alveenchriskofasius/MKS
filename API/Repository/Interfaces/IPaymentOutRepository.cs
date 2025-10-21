using API.Models;

namespace API.Repository.Interfaces
{
    public interface IPaymentOutRepository
    {
        Task<(bool success, string message, int id)> Create(PaymentOutCreateRequest req);
        Task<decimal> GetDepositBalance(int supplierId);
        Task<IEnumerable<PaymentOutDto>> List(int? supplierId = null, DateTime? from = null, DateTime? to = null, short? statusId = null, int? purchaseOrderId = null);
    }
}
