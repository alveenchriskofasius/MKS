using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    [HasPermission("Unit")]
    public class UnitController : Controller
    {
        private readonly IUnitService _service;
        public UnitController(IUnitService service) => _service = service;
        public IActionResult Index() => View();
        public async Task<JsonResult> GetList() => Json(await _service.GetUnitList());
        [HttpPost]
        public async Task<IActionResult> FillForm(int id) => PartialView("_UnitModal", await _service.FillFormUnit(id));
        [HttpPost]
        public async Task<JsonResult> Save(UnitModel model) => Json(await _service.SaveUnit(model));
        [HttpPost]
        public async Task<JsonResult> Delete(int id) => Json(await _service.DeleteUnit(id));
    }
}
