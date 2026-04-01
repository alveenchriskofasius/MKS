using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services
{
    public class MarketplaceOrderService : IMarketplaceOrderService
    {
        private readonly IMarketplaceOrderRepository _repository;

        public MarketplaceOrderService(IMarketplaceOrderRepository repository)
        {
            _repository = repository;
        }

        public async Task<object> PlaceOrder(MarketplaceCheckoutModel model)
        {
            return await _repository.PlaceOrder(model);
        }

        public async Task<List<MarketplaceOrderSummary>> GetOrdersByCustomer(int customerId)
        {
            return await _repository.GetOrdersByCustomer(customerId);
        }

        public async Task<MarketplaceOrderSummary?> GetOrderDetail(int orderId, int customerId)
        {
            return await _repository.GetOrderDetail(orderId, customerId);
        }

        public async Task<object> MarkOrderPaid(int orderId)
        {
            return await _repository.MarkOrderPaid(orderId);
        }

        public async Task<object> MarkOrderPaidByNo(string orderNo)
        {
            return await _repository.MarkOrderPaidByNo(orderNo);
        }

        public async Task<object> CancelOrder(int orderId, int customerId)
        {
            return await _repository.CancelOrder(orderId, customerId);
        }

        public async Task<object> MarkPickedUp(int orderId)
        {
            return await _repository.MarkPickedUp(orderId);
        }
    }
}
