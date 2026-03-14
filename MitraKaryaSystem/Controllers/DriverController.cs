using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;
using System.Security.Claims;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Driver")] // menu Driver (fase 1)
public class DriverController : Controller
{
    private readonly IDeliveryOrderService _svc;
    private readonly IHttpContextAccessor _http;
    public DriverController(IDeliveryOrderService svc, IHttpContextAccessor http)
    {
        _svc = svc; _http = http;
    }

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> MyTasks(short? statusID)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int? userId = int.TryParse(userIdStr, out var id) ? id : null;
        var res = await _svc.List(statusID, userId);
        return Json(res);
    }

    [HttpGet]
    public async Task<JsonResult> Get(int id) => Json(await _svc.Get(id));

    [HttpPost]
    public async Task<JsonResult> UpdateStatus(int id, short statusID)
        => Json(await _svc.UpdateStatus(id, statusID));
}
