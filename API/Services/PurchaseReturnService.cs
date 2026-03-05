using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;
namespace API.Services;

public class PurchaseReturnService : IPurchaseReturnService
{
    private readonly IPurchaseReturnRepository _repo; public PurchaseReturnService(IPurchaseReturnRepository repo) { _repo = repo; }
    public Task<PurchaseReturnModel> FillForm(int id) => _repo.FillForm(id); public Task<object> GetSearchList() => _repo.GetSearchList(); public Task<object> GetDetailList(int id) => _repo.GetDetailList(id); public Task<object> Save(PurchaseReturnModel model) => _repo.Save(model); public Task<object> Delete(int id) => _repo.Delete(id); public Task<object> DeleteItem(int id) => _repo.DeleteItem(id);
    public Task<object> ChangeStatus(int id, short statusId, string? reason) => _repo.ChangeStatus(id, statusId, reason);
}
