using API.Models;

namespace API.Repository.Interfaces
{
    public interface IMarketplaceOrderRepository
    {
        Task<object> PlaceOrder(MarketplaceCheckoutModel model);
        Task<List<MarketplaceOrderSummary>> GetOrdersByCustomer(int customerId);
        Task<MarketplaceOrderSummary?> GetOrderDetail(int orderId, int customerId);
        Task<object> MarkOrderPaid(int orderId);
        Task<object> MarkOrderPaidByNo(string orderNo);
        Task<object> CancelOrder(int orderId, int customerId);
        Task<object> MarkPickedUp(int orderId);
    }
}
