using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    [HasPermission("Marketplace Order")]
    public class MarketplaceOrderController : Controller
    {
        private readonly ISalesOrderService _salesOrderService;
        private readonly IMarketplaceOrderService _marketplaceOrderService;
        private readonly IDeliveryOrderService _deliveryOrderService;

        public MarketplaceOrderController(
            ISalesOrderService salesOrderService,
            IMarketplaceOrderService marketplaceOrderService,
            IDeliveryOrderService deliveryOrderService)
        {
            _salesOrderService = salesOrderService;
            _marketplaceOrderService = marketplaceOrderService;
            _deliveryOrderService = deliveryOrderService;
        }

        public IActionResult Index() => View();

        [HttpGet]
        public async Task<JsonResult> FillGrid()
        {
            // Only marketplace orders (TradeTypeID = 4)
            return Json(await _salesOrderService.GetSearchList(4));
        }

        [HttpGet]
        public async Task<JsonResult> GetDetail(int id)
        {
            return Json(await _salesOrderService.GetSalesOrderDetailById(id));
        }

        [HttpPost]
        public async Task<JsonResult> MarkPaid(int id)
        {
            return Json(await _marketplaceOrderService.MarkOrderPaid(id));
        }

        [HttpPost]
        public async Task<JsonResult> Cancel(int id)
        {
            // Backoffice cancel — pass customerId=0 to bypass customer ownership check
            return Json(await _marketplaceOrderService.CancelOrder(id, 0));
        }

        [HttpPost]
        public async Task<JsonResult> MarkPickedUp(int id)
        {
            return Json(await _marketplaceOrderService.MarkPickedUp(id));
        }

        [HttpPost]
        public async Task<JsonResult> CreateDeliveryOrder(int id)
        {
            return Json(await _deliveryOrderService.CreateFromSalesOrder(id));
        }

        [HttpPost]
        public async Task<JsonResult> AssignDriver(int deliveryOrderId, int driverUserId)
        {
            return Json(await _deliveryOrderService.AssignDriver(deliveryOrderId, driverUserId));
        }
    }
}
