using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Notification")]
public class NotificationController : Controller
{
    private readonly INotificationService _svc;
    public NotificationController(INotificationService svc) => _svc = svc;

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> GetAlerts() => Json(await _svc.GetAlerts());
}
