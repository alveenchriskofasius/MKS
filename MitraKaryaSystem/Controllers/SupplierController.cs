using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    [HasPermission("Supplier")]
    public class SupplierController : Controller
    {
        private readonly ISupplierService _service;
        public SupplierController(ISupplierService service) => _service = service;
        public IActionResult Index() => View();
        public async Task<JsonResult> GetList() => Json(await _service.GetSupplierList());
        [HttpPost]
        public async Task<IActionResult> FillForm(int id) => PartialView("_SupplierModal", await _service.FillFormSupplier(id));
        [HttpPost]
        public async Task<JsonResult> Save(SupplierModel model)
        {
            try
            {
                await _service.SaveSupplier(model);
                return Json(new { success = true });
            }
            catch (Exception e)
            {
                return Json(new { success = false, error = e.Message });
            }
        }
        [HttpPost]
        public async Task<JsonResult> Delete(int id)
        {
            try
            {
                await _service.DeleteSupplier(id);
                return Json(new { success = true });
            }
            catch (Exception e)
            {
                return Json(new { success = false, error = e.Message });
            }
        }
    }
}
