using API.Models;

namespace API.Services.Interfaces;

public interface IPurchaseReturnService
{
    Task<PurchaseReturnModel> FillForm(int id);
    Task<object> GetSearchList();
    Task<object> GetDetailList(int id);
    Task<object> Save(PurchaseReturnModel model);
    Task<object> Delete(int id);
    Task<object> DeleteItem(int id);
    Task<object> ChangeStatus(int id, short statusId, string? reason);
}
