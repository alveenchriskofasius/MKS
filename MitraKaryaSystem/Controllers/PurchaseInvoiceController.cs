using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Purchase Invoice")]
public class PurchaseInvoiceController : Controller
{
    private readonly IPurchaseInvoiceService _svc;
    public PurchaseInvoiceController(IPurchaseInvoiceService svc) => _svc = svc;

    public IActionResult Index() => View();

    [HttpPost]
    public async Task<JsonResult> CreateFromPO(int poId) => Json(await _svc.CreateFromPO(poId));

    [HttpGet]
    public async Task<JsonResult> Get(int id) => Json(await _svc.Get(id));

    [HttpGet]
    public async Task<JsonResult> List(int? supplierId, DateTime? from, DateTime? to, short? statusId)
        => Json(await _svc.List(supplierId, from, to, statusId));

    [HttpPost]
    public async Task<JsonResult> Issue(int id) => Json(await _svc.Issue(id));

    [HttpPost]
    public async Task<JsonResult> Cancel(int id) => Json(await _svc.Cancel(id));

    [HttpPost]
    public async Task<JsonResult> SetAmount(int id, decimal amount) => Json(await _svc.SetAmount(id, amount));

    [HttpGet]
    public async Task<JsonResult> ExistsForPO(int poId) => Json(await _svc.ExistsForPO(poId));
}
