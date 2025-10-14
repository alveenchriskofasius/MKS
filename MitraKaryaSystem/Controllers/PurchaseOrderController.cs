using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [HasPermission("Purchase Order")]
    public class PurchaseOrderController : Controller
    {
        private readonly IPurchaseOrderService _service;
        public PurchaseOrderController(IPurchaseOrderService service) => _service = service;
        public IActionResult Index() => View(); // renamed from Index1 so /PurchaseOrder maps correctly
        public async Task<IActionResult> FillForm(int id) => PartialView("_Form", await _service.FillForm(id));
        [HttpPost]
        public async Task<JsonResult> Save(PurchaseOrderModel model) => Json(await _service.Save(model));
        public async Task<JsonResult> FillGrid() => Json(await _service.GetSearchList());
        public async Task<JsonResult> GetDetailListById(int id) => Json(await _service.GetDetailListById(id));
        public async Task<object> DeleteItem(int id) => Json(await _service.DeleteItem(id));
        public async Task<object> Delete(int id) => Json(await _service.Delete(id));
    }
}
