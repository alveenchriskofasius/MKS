using API.Models;
using API.Services.Interfaces;
using Marketplace.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace Marketplace.Controllers
{
    [Authorize(AuthenticationSchemes = "MarketplaceAuth")]
    public class CheckoutController : Controller
    {
        private readonly IMarketplaceOrderService _orderService;
        private readonly IMidtransService _midtransService;
        private readonly IMarketplaceAuthService _authService;
        private const string CartSessionKey = "MarketplaceCart";

        public CheckoutController(
            IMarketplaceOrderService orderService,
            IMidtransService midtransService,
            IMarketplaceAuthService authService)
        {
            _orderService = orderService;
            _midtransService = midtransService;
            _authService = authService;
        }

        public IActionResult Index() => View();

        [HttpPost]
        public async Task<JsonResult> PlaceOrder(
            string? note,
            string? paymentMethod,
            string? deliveryMethod)
        {
            var customerId = GetCustomerId();
            if (customerId == 0)
                return Json(new { success = false, message = "Silakan login terlebih dahulu." });

            var cart = GetCart();
            if (cart.Count == 0)
                return Json(new { success = false, message = "Keranjang kosong." });

            var model = new MarketplaceCheckoutModel
            {
                CustomerID = customerId,
                Note = note,
                PaymentMethod = paymentMethod ?? "qris",
                DeliveryMethod = deliveryMethod ?? "pickup",
                Items = cart.Select(c => new MarketplaceCheckoutItem
                {
                    ProductID = c.ProductID,
                    ProductName = c.ProductName,
                    Quantity = c.Quantity,
                    UnitPrice = c.UnitPrice,
                    VariantID = c.VariantID,
                    VariantName = c.VariantName
                }).ToList()
            };

            var result = await _orderService.PlaceOrder(model);

            // Clear cart on success
            var successProp = result.GetType().GetProperty("success");
            if (successProp != null && successProp.GetValue(result) is true)
            {
                HttpContext.Session.Remove(CartSessionKey);
                // Also clear saved cart in DB
                await _authService.SaveCart(customerId, "[]");
            }

            return Json(result);
        }

        [HttpPost]
        public async Task<JsonResult> GenerateQris(int orderId)
        {
            var customerId = GetCustomerId();
            var order = await _orderService.GetOrderDetail(orderId, customerId);
            if (order == null)
                return Json(new { success = false, message = "Order tidak ditemukan." });

            if (order.IsPaid)
                return Json(new { success = false, message = "Order sudah dibayar." });

            var midtransOrderId = $"MKT-{order.OrderNo}-{DateTime.Now:yyMMddHHmmss}";
            var result = await _midtransService.CreateQris(midtransOrderId, order.Amount, $"Order {order.OrderNo}");

            if (!result.Success)
                return Json(new { success = false, message = result.ErrorMessage });

            return Json(new
            {
                success = true,
                orderId = result.OrderId,
                qrCodeUrl = result.QrCodeUrl,
                amount = order.Amount
            });
        }

        [HttpPost]
        public async Task<JsonResult> GenerateVA(int orderId, string bank)
        {
            var customerId = GetCustomerId();
            var order = await _orderService.GetOrderDetail(orderId, customerId);
            if (order == null)
                return Json(new { success = false, message = "Order tidak ditemukan." });

            if (order.IsPaid)
                return Json(new { success = false, message = "Order sudah dibayar." });

            var midtransOrderId = $"MKT-{order.OrderNo}-{DateTime.Now:yyMMddHHmmss}";
            var result = await _midtransService.CreateVA(midtransOrderId, order.Amount, bank ?? "bca", $"Order {order.OrderNo}");

            if (!result.Success)
                return Json(new { success = false, message = result.ErrorMessage });

            return Json(new
            {
                success = true,
                midtransOrderId = result.OrderId,
                bankName = result.Bank,
                vaNumber = result.VANumber,
                amount = order.Amount
            });
        }

        [HttpGet]
        public async Task<JsonResult> CheckPaymentStatus(string midtransOrderId, int orderId)
        {
            var result = await _midtransService.CheckStatus(midtransOrderId);

            // If Midtrans confirms settlement, mark order as paid (fallback for webhook)
            if (result.Success && result.TransactionStatus == "settlement")
            {
                await _orderService.MarkOrderPaid(orderId);
            }

            return Json(new
            {
                success = result.Success,
                status = result.TransactionStatus,
                paymentType = result.PaymentType
            });
        }

        private int GetCustomerId()
        {
            var claim = User.FindFirst("CustomerId")?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }

        private List<CartItem> GetCart()
        {
            var json = HttpContext.Session.GetString(CartSessionKey);
            if (string.IsNullOrEmpty(json)) return new List<CartItem>();
            return JsonSerializer.Deserialize<List<CartItem>>(json) ?? new List<CartItem>();
        }
    }
}
