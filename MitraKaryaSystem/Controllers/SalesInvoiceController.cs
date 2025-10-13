using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MitraKaryaSystem.Controllers;

[Authorize(Roles = "Admin,Kasir")]
public class SalesInvoiceController : Controller
{
    private readonly ISalesInvoiceService _svc;
    public SalesInvoiceController(ISalesInvoiceService svc){ _svc = svc; }

    public IActionResult Index() => View();

    [HttpPost]
    public async Task<JsonResult> CreateFromSO(int soId) => Json(await _svc.CreateFromSO(soId));

    [HttpGet]
    public async Task<JsonResult> Get(int id) => Json(await _svc.Get(id));

    [HttpGet]
    public async Task<JsonResult> List(int? customerId, DateTime? from, DateTime? to, short? statusId) => Json(await _svc.List(customerId, from, to, statusId));

    [HttpPost]
    public async Task<JsonResult> Issue(int id) => Json(await _svc.Issue(id));

    [HttpPost]
    public async Task<JsonResult> Cancel(int id) => Json(await _svc.Cancel(id));

    [HttpPost]
    public async Task<JsonResult> SetAmount(int id, decimal amount) => Json(await _svc.SetAmount(id, amount));

    [HttpGet]
    public async Task<JsonResult> ExistsForSO(int soId) => Json(await _svc.ExistsForSO(soId));
}
