using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.Controllers
{
    [Authorize(AuthenticationSchemes = "MarketplaceAuth")]
    public class NotificationController : Controller
    {
        private readonly IMarketplaceOrderService _orderService;

        public NotificationController(IMarketplaceOrderService orderService)
        {
            _orderService = orderService;
        }

        public IActionResult Index() => View();

        [HttpGet]
        public async Task<JsonResult> GetNotifications()
        {
            var customerId = GetCustomerId();
            var orders = await _orderService.GetOrdersByCustomer(customerId);

            var notifications = new List<object>();
            foreach (var o in orders.OrderByDescending(x => x.Date))
            {
                string icon, message, badgeClass;
                if (o.IsCancelled)
                {
                    icon = "bi-x-circle-fill";
                    badgeClass = "text-secondary";
                    message = "Pesanan " + o.OrderNo + " telah dibatalkan.";
                }
                else if (o.IsPaid)
                {
                    icon = "bi-check-circle-fill";
                    badgeClass = "text-success";
                    message = "Pembayaran pesanan " + o.OrderNo + " berhasil.";
                }
                else
                {
                    icon = "bi-clock-fill";
                    badgeClass = "text-warning";
                    message = "Pesanan " + o.OrderNo + " menunggu pembayaran.";
                }

                notifications.Add(new
                {
                    orderId = o.OrderID,
                    orderNo = o.OrderNo,
                    message,
                    icon,
                    badgeClass,
                    date = o.Date,
                    isPaid = o.IsPaid,
                    isCancelled = o.IsCancelled
                });
            }

            return Json(notifications);
        }

        [HttpGet]
        public async Task<JsonResult> GetUnreadCount()
        {
            var customerId = GetCustomerId();
            var orders = await _orderService.GetOrdersByCustomer(customerId);
            // Count unpaid (pending action) orders as "unread"
            var count = orders.Count(o => !o.IsPaid && !o.IsCancelled);
            return Json(new { count });
        }

        private int GetCustomerId()
        {
            var claim = User.FindFirst("CustomerId")?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }
    }
}
