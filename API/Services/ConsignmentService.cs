using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services;

public class ConsignmentService : IConsignmentService
{
    private readonly IConsignmentRepository _repo;
    private readonly IHttpContextAccessor _http;

    public ConsignmentService(IConsignmentRepository repo, IHttpContextAccessor http)
    {
        _repo = repo;
        _http = http;
    }

    private string UserName => _http.HttpContext?.User?.Identity?.Name ?? "System";

    public Task<IEnumerable<ConsignmentListItem>> GetList() => _repo.GetList();
    public Task<ConsignmentModel> Get(int id) => _repo.Get(id);
    public Task<object> Save(ConsignmentModel model) => _repo.Save(model, UserName);
    public Task<object> Delete(int id) => _repo.Delete(id);
    public Task<object> AddItem(ConsignmentItemModel item) => _repo.AddItem(item, UserName);
    public Task<object> RemoveItem(int itemId) => _repo.RemoveItem(itemId);
    public Task<object> RecordSale(RecordSaleModel model) => _repo.RecordSale(model, UserName);
    public Task<object> RecordReturn(RecordReturnModel model) => _repo.RecordReturn(model, UserName);
    public Task<object> Settle(int id) => _repo.Settle(id, UserName);
    public Task<object> GetItems(int consignmentId) => _repo.GetItems(consignmentId);
}
