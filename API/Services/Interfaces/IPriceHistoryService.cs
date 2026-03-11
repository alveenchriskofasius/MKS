using API.Models;

namespace API.Services.Interfaces;

public interface IPriceHistoryService
{
    Task<IEnumerable<PriceListItem>> GetPriceList();
    Task<IEnumerable<PriceHistoryItem>> GetHistory(int? productId, DateTime? from, DateTime? to);
    Task LogPriceChange(int productId, decimal oldPrice, decimal newPrice, string source, string note, string user);
}
