using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;
using System.Diagnostics;
using System.Security.Claims;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;
        private readonly ISalesOrderService _salesOrderService;
        private readonly IProductService _productService;
        private readonly IDeliveryOrderService _deliveryOrderService;
        private readonly IPurchaseOrderService _purchaseOrderService;

        public HomeController(ILogger<HomeController> logger,
                              ISalesOrderService salesOrderService,
                              IProductService productService,
                              IDeliveryOrderService deliveryOrderService,
                              IPurchaseOrderService purchaseOrderService)
        {
            _logger = logger;
            _salesOrderService = salesOrderService;
            _productService = productService;
            _deliveryOrderService = deliveryOrderService;
            _purchaseOrderService = purchaseOrderService;
        }

        public IActionResult Index() => View();

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }

        private bool IsDriver()
        {
            var user = HttpContext.User;
            if (user == null) return false;
            // check Permission claim or Role claim
            if (user.Claims.Any(c => string.Equals(c.Type, ClaimTypes.Role, StringComparison.OrdinalIgnoreCase) && string.Equals(c.Value, "Driver", StringComparison.OrdinalIgnoreCase)))
                return true;
            if (user.Claims.Any(c => string.Equals(c.Type, "Permission", StringComparison.OrdinalIgnoreCase) && string.Equals(c.Value, "Driver", StringComparison.OrdinalIgnoreCase)))
                return true;
            return false;
        }

        [HttpGet]
        public async Task<JsonResult> SalesToday()
        {
            if (IsDriver()) return Json(new { success = false, result = "Access denied" });
            try
            {
                var list = await _salesOrderService.GetSearchList();
                // compute today's total on server so client only displays prepared value
                decimal sum = 0m;
                if (list is System.Collections.IEnumerable rows)
                {
                    foreach (var r in rows)
                    {
                        if (r == null) continue;
                        var t = r.GetType();
                        var dateProp = t.GetProperty("Date") ?? t.GetProperty("date");
                        var amountProp = t.GetProperty("Amount") ?? t.GetProperty("amount");
                        if (dateProp == null || amountProp == null) continue;
                        var dateVal = dateProp.GetValue(r);
                        if (dateVal == null) continue;
                        if (!DateTime.TryParse(dateVal.ToString(), out var dt)) continue;
                        if (dt.Date != DateTime.UtcNow.Date && dt.Date != DateTime.Now.Date) continue;
                        var amtVal = amountProp.GetValue(r);
                        if (amtVal == null) continue;
                        if (decimal.TryParse(amtVal.ToString(), out var amt)) sum += amt;
                    }
                }
                return Json(new { success = true, total = sum, result = list });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SalesToday failed");
                return Json(new { success = false, result = ex.Message });
            }
        }

        [HttpGet]
        public async Task<JsonResult> StockAlerts()
        {
            if (IsDriver()) return Json(new { success = false, result = "Access denied" });
            try
            {
                // ask service for only low stock products (threshold5)
                var list = await _productService.GetLowStockProductList(5);
                return Json(new { success = true, result = list });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "StockAlerts failed");
                return Json(new { success = false, result = ex.Message });
            }
        }

        [HttpGet]
        public async Task<JsonResult> PendingDeliveryOrders()
        {
            try
            {
                int? driverId = null;
                if (IsDriver())
                {
                    if (int.TryParse(HttpContext.User?.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
                        driverId = id;
                }

                var list = await _deliveryOrderService.List(1, driverId);
                return Json(new { success = true, result = list });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PendingDeliveryOrders failed");
                return Json(new { success = false, result = ex.Message });
            }
        }

        [HttpGet]
        public async Task<JsonResult> PendingPurchaseOrders()
        {
            if (IsDriver()) return Json(new { success = false, result = "Access denied" });
            try
            {
                var list = await _purchaseOrderService.GetSearchList();
                int pending = 0;
                if (list is System.Collections.IEnumerable rows)
                {
                    foreach (var r in rows)
                    {
                        if (r == null) continue;
                        var statusProp = r.GetType().GetProperty("statusID") ?? r.GetType().GetProperty("StatusID");
                        if (statusProp == null) continue;
                        var val = statusProp.GetValue(r);
                        if (val != null && short.TryParse(val.ToString(), out var sid) && sid == 2)
                            pending++;
                    }
                }
                return Json(new { success = true, count = pending, result = list });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PendingPurchaseOrders failed");
                return Json(new { success = false, result = ex.Message });
            }
        }
    }
}