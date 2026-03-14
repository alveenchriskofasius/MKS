using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;
using System.Security.Claims;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Delivery Order")]
public class DeliveryOrderController : Controller
{
    private readonly IDeliveryOrderService _svc;
    private readonly IUserService _userSvc;
    public DeliveryOrderController(IDeliveryOrderService s, IUserService userSvc) { _svc = s; _userSvc = userSvc; }
    public IActionResult Index() => View();
    [HttpPost] public async Task<JsonResult> CreateFromSO(int soId) => Json(await _svc.CreateFromSalesOrder(soId));
    [HttpGet] public async Task<JsonResult> Get(int id) => Json(await _svc.Get(id));
    [HttpGet]
    public async Task<JsonResult> List(short? statusID)
    {
        int? driverFilter = null;
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (string.Equals(role, "Driver", StringComparison.OrdinalIgnoreCase))
        {
            if (int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid))
                driverFilter = uid;
        }
        return Json(await _svc.List(statusID, driverFilter));
    }
    [HttpPost] public async Task<JsonResult> AssignDriver(int id, int driverUserID) => Json(await _svc.AssignDriver(id, driverUserID));
    [HttpPost]
    public async Task<JsonResult> UpdateStatus(int id, short newStatus)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (!string.Equals(role, "Driver", StringComparison.OrdinalIgnoreCase))
            return Json(new { success = false, result = "Only users with Driver role can update delivery progress." });
        return Json(await _svc.UpdateStatus(id, newStatus));
    }
    [HttpGet] public async Task<JsonResult> GetDrivers() => Json(await _userSvc.GetDriverList());
}
