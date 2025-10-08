using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services;

public class StockCountService : IStockCountService
{
    private readonly IStockCountRepository _repo;
    public StockCountService(IStockCountRepository repo) { _repo = repo; }
    public Task<object> AutoAdjust(int id) => _repo.AutoAdjust(id);
    public Task<object> Delete(int id) => _repo.Delete(id);
    public Task<object> DeleteItem(int id) => _repo.DeleteItem(id);
    public Task<object> GetDetailList(int id) => _repo.GetDetailList(id);
    public Task<object> GetSearchList() => _repo.GetSearchList();
    public Task<StockCountModel> FillForm(int id) => _repo.FillForm(id);
    public Task<object> Save(StockCountModel model) => _repo.Save(model);
}
