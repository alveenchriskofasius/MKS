using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;
using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;

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
        private readonly INotificationService _notificationService;

        public HomeController(ILogger<HomeController> logger,
                              ISalesOrderService salesOrderService,
                              IProductService productService,
                              IDeliveryOrderService deliveryOrderService,
                              IPurchaseOrderService purchaseOrderService,
                              INotificationService notificationService)
        {
            _logger = logger;
            _salesOrderService = salesOrderService;
            _productService = productService;
            _deliveryOrderService = deliveryOrderService;
            _purchaseOrderService = purchaseOrderService;
            _notificationService = notificationService;
        }

        public IActionResult Index() => View();

        [AllowAnonymous]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public new IActionResult NotFound() => View("~/Views/Shared/NotFound.cshtml");

        [HttpGet]
        public JsonResult WhoAmI()
        {
            var claims = User.Claims.Select(c => new { c.Type, c.Value }).ToList();
            return Json(new { user = User.Identity?.Name, isAuthenticated = User.Identity?.IsAuthenticated, claims });
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }

        #region Role Helpers
        private bool IsDriver()
        {
            var user = HttpContext.User;
            if (user == null) return false;
            return user.Claims.Any(c => string.Equals(c.Type, ClaimTypes.Role, StringComparison.OrdinalIgnoreCase) && string.Equals(c.Value, "Driver", StringComparison.OrdinalIgnoreCase))
                || user.Claims.Any(c => string.Equals(c.Type, "Permission", StringComparison.OrdinalIgnoreCase) && string.Equals(c.Value, "Driver", StringComparison.OrdinalIgnoreCase));
        }

        private bool IsCashier()
        {
            var user = HttpContext.User;
            if (user == null) return false;
            return user.Claims.Any(c => string.Equals(c.Type, ClaimTypes.Role, StringComparison.OrdinalIgnoreCase) && string.Equals(c.Value, "Kasir", StringComparison.OrdinalIgnoreCase));
        }

        private bool IsAdmin() => !IsDriver() && !IsCashier();
        #endregion

        #region Dashboard Endpoints

        /// <summary>
        /// Sales today. Admin sees all, Kasir sees only their own. Driver denied.
        /// </summary>
        [HttpGet]
        public async Task<JsonResult> SalesToday()
        {
            if (IsDriver()) return Json(new { success = false, result = "Access denied" });
            try
            {
                var list = await _salesOrderService.GetSearchList();
                var todayStr = DateTime.Now.ToString("yyyy-MM-dd");
                var userName = User?.Identity?.Name;
                var personalFilter = IsCashier();
                decimal sum = 0m;

                var jsonEl = JsonSerializer.SerializeToElement(list);
                var filtered = new List<JsonElement>();

                if (jsonEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in jsonEl.EnumerateArray())
                    {
                        if (!item.TryGetProperty("date", out var dp) || dp.GetString() != todayStr)
                            continue;
                        if (personalFilter && item.TryGetProperty("createdBy", out var cb) &&
                            !string.Equals(cb.GetString(), userName, StringComparison.OrdinalIgnoreCase))
                            continue;
                        if (item.TryGetProperty("amount", out var ap))
                            sum += ap.GetDecimal();
                        filtered.Add(item);
                    }
                }

                return Json(new { success = true, total = sum, result = filtered });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SalesToday failed");
                return Json(new { success = false, result = ex.Message });
            }
        }

        /// <summary>Admin only.</summary>
        [HttpGet]
        public async Task<JsonResult> StockAlerts()
        {
            if (!IsAdmin()) return Json(new { success = false, result = "Access denied" });
            try
            {
                var list = await _productService.GetLowStockProductList(5);
                return Json(new { success = true, result = list });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "StockAlerts failed");
                return Json(new { success = false, result = ex.Message });
            }
        }

        /// <summary>
        /// Driver sees their assigned DOs. Admin sees all. Kasir denied.
        /// </summary>
        [HttpGet]
        public async Task<JsonResult> PendingDeliveryOrders()
        {
            if (IsCashier()) return Json(new { success = false, result = "Access denied" });
            try
            {
                int? driverId = null;
                if (IsDriver())
                {
                    if (int.TryParse(User?.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
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

        /// <summary>Admin only.</summary>
        [HttpGet]
        public async Task<JsonResult> PendingPurchaseOrders()
        {
            if (!IsAdmin()) return Json(new { success = false, result = "Access denied" });
            try
            {
                var list = await _purchaseOrderService.GetSearchList();
                int pending = 0;

                var jsonEl = JsonSerializer.SerializeToElement(list);
                if (jsonEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in jsonEl.EnumerateArray())
                    {
                        if (item.TryGetProperty("statusID", out var sidProp) &&
                            sidProp.TryGetInt16(out var sid) && sid == 2)
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

        [HttpGet]
        public async Task<JsonResult> AlertCount()
        {
            try
            {
                var count = await _notificationService.GetCount();
                return Json(new { success = true, count });
            }
            catch
            {
                return Json(new { success = true, count = 0 });
            }
        }
        #endregion
    }
}