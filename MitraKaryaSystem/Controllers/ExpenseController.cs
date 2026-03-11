using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Expense")]
public class ExpenseController : Controller
{
    private readonly IExpenseService _svc;
    public ExpenseController(IExpenseService svc) => _svc = svc;

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> GetList(DateTime? from, DateTime? to, string category)
        => Json(await _svc.GetList(from, to, category));

    [HttpGet]
    public async Task<JsonResult> Get(int id) => Json(await _svc.Get(id));

    [HttpGet]
    public async Task<JsonResult> Summary() => Json(await _svc.GetSummary());

    [HttpPost]
    public async Task<JsonResult> Save(ExpenseModel model) => Json(await _svc.Save(model));

    [HttpPost]
    public async Task<JsonResult> Delete(int id) => Json(await _svc.Delete(id));
}
