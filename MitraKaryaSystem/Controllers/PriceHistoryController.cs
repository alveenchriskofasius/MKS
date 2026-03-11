using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Price History")]
public class PriceHistoryController : Controller
{
    private readonly IPriceHistoryService _svc;
    public PriceHistoryController(IPriceHistoryService svc) => _svc = svc;

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> GetPriceList() => Json(await _svc.GetPriceList());

    [HttpGet]
    public async Task<JsonResult> GetHistory(int? productId, DateTime? from, DateTime? to)
        => Json(await _svc.GetHistory(productId, from, to));
}
