using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    [HasPermission("Payment Out")]
    public class PaymentOutController : Controller
    {
        private readonly IPaymentOutService _service;
        private readonly ISupplierService _supplierService;
        public PaymentOutController(IPaymentOutService service, ISupplierService supplierService) { _service = service; _supplierService = supplierService; }

        public IActionResult Index()
        {
            return View();
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Kasir")]
        public async Task<IActionResult> Create([FromBody] PaymentOutCreateRequest req)
        {
            var result = await _service.Create(req);
            return Json(new { success = result.success, message = result.message, id = result.id });
        }

        [HttpGet]
        public async Task<IActionResult> GetDepositBalance(int supplierId)
        {
            var svc = _service as API.Services.PaymentOutService;
            if (svc == null) return Json(0);
            var repo = typeof(API.Services.PaymentOutService).GetField("_repo", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)?.GetValue(svc) as API.Repository.Interfaces.IPaymentOutRepository;
            if (repo == null) return Json(0);
            var bal = await repo.GetDepositBalance(supplierId);
            return Json(bal);
        }

        [HttpGet]
        public async Task<IActionResult> List(int? supplierId, DateTime? from, DateTime? to, short? statusId, int? purchaseOrderId)
        {
            var list = await _service.List(supplierId, from, to, statusId, purchaseOrderId);
            return Json(list);
        }

        [HttpGet]
        public async Task<IActionResult> RelatedByPO(int purchaseOrderId)
        {
            var list = await _service.List(null, null, null, null, purchaseOrderId);
            return Json(list);
        }

        // New: expose supplier list for PaymentOut UI (users with Payment Out permission can access)
        [HttpGet]
        public async Task<IActionResult> GetSupplierList()
        {
            var list = await _supplierService.GetSupplierList();
            return Json(list);
        }
    }
}
