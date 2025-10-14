using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;
using System.Security.Claims;

namespace API.Services;
public class DeliveryOrderService : IDeliveryOrderService
{
    private readonly IDeliveryOrderRepository _repo; private readonly IHttpContextAccessor _http; public DeliveryOrderService(IDeliveryOrderRepository r, IHttpContextAccessor http) { _repo = r; _http = http; }
    private string UserName => _http.HttpContext?.User?.Identity?.Name;
    private int? UserId => int.TryParse(_http.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    public Task<object> CreateFromSalesOrder(int salesOrderID) => _repo.CreateFromSalesOrder(salesOrderID, UserName);
    public Task<DeliveryOrderModel> Get(int id) => _repo.Get(id);
    public Task<object> List(short? statusID = null, int? driverUserID = null) => _repo.List(statusID, driverUserID);
    public Task<object> AssignDriver(int id, int driverUserID) => _repo.AssignDriver(id, driverUserID, UserName);
    public Task<object> UpdateStatus(int id, short newStatus) => _repo.UpdateStatus(id, newStatus, UserName);
}
