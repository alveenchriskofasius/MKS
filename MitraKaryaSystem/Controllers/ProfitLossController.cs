using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Profit Loss")]
public class ProfitLossController : Controller
{
    private readonly IProfitLossService _svc;
    public ProfitLossController(IProfitLossService svc) => _svc = svc;

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> GetReport(DateTime? from, DateTime? to)
        => Json(await _svc.GetReport(from, to));
}
