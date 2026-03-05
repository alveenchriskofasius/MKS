using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
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
    }
}
