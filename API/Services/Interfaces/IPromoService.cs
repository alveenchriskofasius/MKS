using API.Models;

namespace API.Services.Interfaces;

public interface IPromoService
{
    Task<IEnumerable<PromoListItem>> GetList();
    Task<PromoModel> Get(int id);
    Task<object> Save(PromoModel model);
    Task<object> Delete(int id);
    Task<object> ApplyPromo(int id);
    Task<object> DeactivatePromo(int id);
}
