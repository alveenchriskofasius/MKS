using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;
namespace API.Services;
public class SalesReturnService : ISalesReturnService
{
    private readonly ISalesReturnRepository _repo; public SalesReturnService(ISalesReturnRepository repo) { _repo = repo; }
    public Task<SalesReturnModel> FillForm(int id) => _repo.FillForm(id); public Task<object> GetSearchList() => _repo.GetSearchList(); public Task<object> GetDetailList(int id) => _repo.GetDetailList(id); public Task<object> Save(SalesReturnModel model) => _repo.Save(model); public Task<object> Delete(int id) => _repo.Delete(id); public Task<object> DeleteItem(int id) => _repo.DeleteItem(id);
}
