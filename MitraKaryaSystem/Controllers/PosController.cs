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
        public PosController(IPosService svc) { _svc = svc; }

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
    }
}
