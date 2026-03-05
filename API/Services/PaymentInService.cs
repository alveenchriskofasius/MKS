using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services
{
    public class PaymentInService : IPaymentInService
    {
        private readonly IPaymentInRepository _repo;

        public PaymentInService(
            IPaymentInRepository repo)
        {
            _repo = repo;
        }

        public async Task<object> Create(PaymentInCreateRequest req)
        {
            var r = await _repo.Create(req);
            return new { success = r.success, result = r.message, id = r.id, no = r.no, paidAmount = r.paidAmount, paymentStatusID = r.paymentStatusId };
        }

        public Task<PaymentInDto> Get(int id)
        {
            return _repo.Get(id);
        }

        public Task<IEnumerable<PaymentInDto>> List(int? customerId, DateTime? from, DateTime? to, short? statusId, int? salesOrderId, int? salesInvoiceId)
        {
            return _repo.List(customerId, from, to, statusId, salesOrderId, salesInvoiceId);
        }

        public async Task<object> UpdateStatus(int id, short statusId)
        {
            var r = await _repo.UpdateStatus(id, statusId);
            return new { success = r.success, result = r.message };
        }

        public async Task<object> Delete(int id)
        {
            var r = await _repo.Delete(id);
            return new { success = r.success, result = r.message };
        }
    }
}
