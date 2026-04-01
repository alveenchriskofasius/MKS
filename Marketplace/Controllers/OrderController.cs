using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.Controllers
{
    [Authorize(AuthenticationSchemes = "MarketplaceAuth")]
    public class OrderController : Controller
    {
        private readonly IMarketplaceOrderService _orderService;

        public OrderController(IMarketplaceOrderService orderService)
        {
            _orderService = orderService;
        }

        public IActionResult Index() => View();

        public IActionResult Detail(int id)
        {
            ViewData["OrderId"] = id;
            return View();
        }

        [HttpGet]
        public async Task<JsonResult> GetMyOrders()
        {
            var customerId = GetCustomerId();
            var orders = await _orderService.GetOrdersByCustomer(customerId);
            return Json(orders);
        }

        [HttpGet]
        public async Task<JsonResult> GetOrderDetail(int id)
        {
            var customerId = GetCustomerId();
            var order = await _orderService.GetOrderDetail(id, customerId);
            return Json(order);
        }

        [HttpPost]
        public async Task<JsonResult> CancelOrder(int orderId)
        {
            var customerId = GetCustomerId();
            var result = await _orderService.CancelOrder(orderId, customerId);
            return Json(result);
        }

        private int GetCustomerId()
        {
            var claim = User.FindFirst("CustomerId")?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }
    }
}
