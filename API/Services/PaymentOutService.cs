using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services;

public class PaymentOutService : IPaymentOutService
{
    private readonly IPaymentOutRepository _repo;
    public PaymentOutService(IPaymentOutRepository repo) => _repo = repo;

    public Task<(bool success, string message, int id)> Create(PaymentOutCreateRequest req)
    {
        return _repo.Create(req);
    }

    public Task<IEnumerable<PaymentOutDto>> List(int? supplierId = null, DateTime? from = null, DateTime? to = null, short? statusId = null, int? purchaseOrderId = null)
    {
        return _repo.List(supplierId, from, to, statusId, purchaseOrderId);
    }
}
