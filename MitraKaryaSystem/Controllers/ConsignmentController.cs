using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Consignment")]
public class ConsignmentController : Controller
{
    private readonly IConsignmentService _svc;
    private readonly ISupplierService _supplierService;

    public ConsignmentController(IConsignmentService svc, ISupplierService supplierService)
    {
        _svc = svc;
        _supplierService = supplierService;
    }

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> GetList() => Json(await _svc.GetList());

    [HttpGet]
    public async Task<JsonResult> Get(int id) => Json(await _svc.Get(id));

    [HttpGet]
    public async Task<JsonResult> GetItems(int id) => Json(await _svc.GetItems(id));

    [HttpGet]
    public async Task<JsonResult> GetSuppliers() => Json(await _supplierService.GetSupplierList());

    [HttpGet]
    public async Task<JsonResult> GetSalesPersons(int supplierId)
        => Json(await _supplierService.GetSalesPersonsBySupplier(supplierId));

    [HttpGet]
    public async Task<JsonResult> GetAllSalesPersons()
        => Json(await _supplierService.GetAllSalesPersons());

    [HttpPost]
    public async Task<JsonResult> Save(ConsignmentModel model) => Json(await _svc.Save(model));

    [HttpPost]
    public async Task<JsonResult> Delete(int id) => Json(await _svc.Delete(id));

    [HttpPost]
    public async Task<JsonResult> AddItem(ConsignmentItemModel item) => Json(await _svc.AddItem(item));

    [HttpPost]
    public async Task<JsonResult> RemoveItem(int itemId) => Json(await _svc.RemoveItem(itemId));

    [HttpPost]
    public async Task<JsonResult> RecordSale(RecordSaleModel model) => Json(await _svc.RecordSale(model));

    [HttpPost]
    public async Task<JsonResult> RecordReturn(RecordReturnModel model) => Json(await _svc.RecordReturn(model));

    [HttpPost]
    public async Task<JsonResult> Settle(int id) => Json(await _svc.Settle(id));
}
