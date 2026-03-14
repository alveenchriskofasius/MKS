using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    [HasPermission("Point of Sale")]
    public class PosController : Controller
    {
        private readonly IPosService _svc;
        private readonly ICustomerService _customerService;

        public PosController(IPosService svc, ICustomerService customerService)
        {
            _svc = svc;
            _customerService = customerService;
        }

        public IActionResult Index()
        {
            ViewData["Title"] = "Point of Sale";
            return View();
        }

        [HttpPost]
        public async Task<JsonResult> Save([FromBody] PosSaleRequest req)
        {
            return Json(await _svc.Save(req));
        }

        [HttpGet]
        public async Task<JsonResult> GetHistory()
        {
            return Json(await _svc.GetHistory());
        }

        [HttpGet]
        public async Task<JsonResult> GetHistoryDetail(int id)
        {
            return Json(await _svc.GetHistoryDetail(id));
        }

        /// <summary>
        /// Returns customer list for POS dropdown.
        /// Accessible with "Point of Sale" permission only (no "Customer" permission needed).
        /// </summary>
        [HttpGet]
        public async Task<JsonResult> GetCustomerList()
        {
            return Json(await _customerService.GetList());
        }
    }
}
