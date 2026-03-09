using API.Models;

namespace API.Services.Interfaces
{
    public interface IPosService
    {
        Task<object> Save(PosSaleRequest req);
        Task<object> GetHistory();
        Task<object> GetHistoryDetail(int id);
    }
}
