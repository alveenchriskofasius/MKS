using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Delivery Order")]
public class DeliveryOrderController : Controller
{
    private readonly IDeliveryOrderService _svc; public DeliveryOrderController(IDeliveryOrderService s) { _svc = s; }
    public IActionResult Index() => View();
    [HttpPost] public async Task<JsonResult> CreateFromSO(int soId) => Json(await _svc.CreateFromSalesOrder(soId));
    [HttpGet] public async Task<JsonResult> Get(int id) => Json(await _svc.Get(id));
    [HttpGet] public async Task<JsonResult> List(short? statusID) => Json(await _svc.List(statusID));
    [HttpPost] public async Task<JsonResult> AssignDriver(int id, int driverUserID) => Json(await _svc.AssignDriver(id, driverUserID));
    [HttpPost] public async Task<JsonResult> UpdateStatus(int id, short newStatus) => Json(await _svc.UpdateStatus(id, newStatus));
}
