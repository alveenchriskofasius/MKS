using API.Models;
namespace API.Services.Interfaces;

public interface IDeliveryOrderService
{
    Task<object> CreateFromSalesOrder(int salesOrderID);
    Task<DeliveryOrderModel> Get(int id);
    Task<object> List(short? statusID = null, int? driverUserID = null);
    Task<object> AssignDriver(int id, int driverUserID);
    Task<object> UpdateStatus(int id, short newStatus);
}
