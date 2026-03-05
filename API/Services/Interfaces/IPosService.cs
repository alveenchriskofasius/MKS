using API.Models;

namespace API.Services.Interfaces
{
    public interface IPosService
    {
        Task<object> Save(PosSaleRequest req);
    }
}
