using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Debt")]
public class DebtController : Controller
{
    private readonly IDebtService _svc;
    public DebtController(IDebtService svc) => _svc = svc;

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> Receivables() => Json(await _svc.GetReceivables());

    [HttpGet]
    public async Task<JsonResult> Payables() => Json(await _svc.GetPayables());
}
