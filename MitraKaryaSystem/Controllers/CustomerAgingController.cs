using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Customer Aging")]
public class CustomerAgingController : Controller
{
    private readonly ICustomerAgingService _svc;
    public CustomerAgingController(ICustomerAgingService svc) => _svc = svc;

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> GetAging(DateTime? asOfDate)
        => Json(await _svc.GetAging(asOfDate));
}
