using API.Models;

namespace API.Services.Interfaces;

public interface IStockCountService
{
    Task<StockCountModel> FillForm(int id);
    Task<object> GetSearchList();
    Task<object> GetDetailList(int id);
    Task<object> Save(StockCountModel model);
    Task<object> Delete(int id);
    Task<object> DeleteItem(int id);
    Task<object> AutoAdjust(int id);
}
