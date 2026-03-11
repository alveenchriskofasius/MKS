using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services;

public class PurchaseInvoiceService : IPurchaseInvoiceService
{
    private readonly IPurchaseInvoiceRepository _repo;

    public PurchaseInvoiceService(IPurchaseInvoiceRepository repo) => _repo = repo;

    public async Task<object> CreateFromPO(int purchaseOrderId)
    {
        var model = await _repo.CreateFromPO(purchaseOrderId);
        return model == null
            ? new { success = false, result = "Purchase Order not found" }
            : new { success = true, id = model.ID, no = model.No };
    }

    public Task<PurchaseInvoiceModel> Get(int id) => _repo.Get(id);

    public Task<IEnumerable<PurchaseInvoiceListItem>> List(int? supplierId, DateTime? from, DateTime? to, short? statusId)
        => _repo.List(supplierId, from, to, statusId);

    public Task<object> Issue(int id) => _repo.Issue(id);

    public Task<object> Cancel(int id) => _repo.Cancel(id);

    public Task<object> SetAmount(int id, decimal amount) => _repo.SetAmount(id, amount);

    public Task<object> ExistsForPO(int purchaseOrderId) => _repo.ExistsForPO(purchaseOrderId);
}
