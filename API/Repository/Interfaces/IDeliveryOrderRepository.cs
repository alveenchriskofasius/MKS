using API.Models;
namespace API.Repository.Interfaces;
public interface IDeliveryOrderRepository
{
    Task<object> CreateFromSalesOrder(int salesOrderID, string userName);
    Task<DeliveryOrderModel> Get(int id);
    Task<object> List(short? statusID = null, int? driverUserID = null);
    Task<object> AssignDriver(int id, int driverUserID, string userName);
    Task<object> UpdateStatus(int id, short newStatus, string userName);
}
