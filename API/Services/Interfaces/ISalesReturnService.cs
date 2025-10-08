using API.Models;

namespace API.Services.Interfaces;
public interface ISalesReturnService
{
    Task<SalesReturnModel> FillForm(int id);
    Task<object> GetSearchList();
    Task<object> GetDetailList(int id);
    Task<object> Save(SalesReturnModel model);
    Task<object> Delete(int id);
    Task<object> DeleteItem(int id);
}
