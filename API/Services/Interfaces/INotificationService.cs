using API.Models;

namespace API.Services.Interfaces;

public interface INotificationService
{
    Task<IEnumerable<AlertItem>> GetAlerts();
    Task<int> GetCount();
}
