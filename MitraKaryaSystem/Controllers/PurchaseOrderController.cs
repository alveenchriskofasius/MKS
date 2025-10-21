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
        private readonly ISupplierService _supplierService;
        public PurchaseOrderController(IPurchaseOrderService service, ISupplierService supplierService)
        {
            _service = service;
            _supplierService = supplierService;
        }
        public IActionResult Index() => View(); // renamed from Index1 so /PurchaseOrder maps correctly
        public async Task<IActionResult> FillForm(int id)
        {
            var model = await _service.FillForm(id);
            // provide supplier list so partial can render select server-side
            var suppliers = await _supplierService.GetSupplierList();
            ViewBag.SupplierList = suppliers;
            return PartialView("_Form", model);
        }
        [HttpPost]
        public async Task<JsonResult> Save(PurchaseOrderModel model) => Json(await _service.Save(model));
        public async Task<JsonResult> FillGrid() => Json(await _service.GetSearchList());
        public async Task<JsonResult> GetDetailListById(int id) => Json(await _service.GetDetailListById(id));
        public async Task<object> DeleteItem(int id) => Json(await _service.DeleteItem(id));
        public async Task<object> Delete(int id) => Json(await _service.Delete(id));
        public async Task<JsonResult> ListBySupplier(int supplierId) => Json(await _service.GetListBySupplier(supplierId));
        public async Task<JsonResult> Get(int id)
        {
            var po = await _service.FillForm(id);
            if (po == null) return Json(null);
            string supplierName = string.Empty;
            if (po.SupplierID.HasValue && po.SupplierID.Value > 0)
            {
                try
                {
                    var sup = await _supplierService.FillFormSupplier(po.SupplierID.Value);
                    supplierName = sup?.SupplierName ?? string.Empty;
                }
                catch { supplierName = string.Empty; }
            }

            return Json(new { id = po.ID, supplierID = po.SupplierID, supplierName = supplierName, amount = po.Amount, date = po.Date.ToString("yyyy-MM-dd") });
        }
    }
}
