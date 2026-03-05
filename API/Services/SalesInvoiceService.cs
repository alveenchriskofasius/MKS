using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services
{
    public class SalesInvoiceService : ISalesInvoiceService
    {
        private readonly ISalesInvoiceRepository _repo;

        public SalesInvoiceService(
            ISalesInvoiceRepository repo)
        {
            _repo = repo;
        }

        public async Task<object> CreateFromSO(int salesOrderId)
        {
            var model = await _repo.CreateFromSO(salesOrderId);
            return model == null
                ? new { success = false, result = "Sales Order not found" }
                : new { success = true, id = model.ID, no = model.No };
        }

        public Task<SalesInvoiceModel> Get(int id)
        {
            return _repo.Get(id);
        }

        public Task<IEnumerable<SalesInvoiceListItem>> List(int? customerId, DateTime? from, DateTime? to, short? statusId)
        {
            return _repo.List(customerId, from, to, statusId);
        }

        public Task<object> Issue(int id)
        {
            return _repo.Issue(id);
        }

        public Task<object> Cancel(int id)
        {
            return _repo.Cancel(id);
        }

        public Task<object> SetAmount(int id, decimal amount)
        {
            return _repo.SetAmount(id, amount);
        }

        public Task<object> ExistsForSO(int salesOrderId)
        {
            return _repo.ExistsForSO(salesOrderId);
        }
    }
}
