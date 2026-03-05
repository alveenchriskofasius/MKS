using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;
namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Purchase Return")]
public class PurchaseReturnController : Controller
{
    private readonly IPurchaseReturnService _svc; public PurchaseReturnController(IPurchaseReturnService s) { _svc = s; }
    public IActionResult Index() => View();
    public async Task<IActionResult> FillForm(int id) => PartialView("_Form", await _svc.FillForm(id));
    public async Task<JsonResult> GetDetailList(int id) => Json(await _svc.GetDetailList(id));
    public async Task<JsonResult> GetSearchList() => Json(await _svc.GetSearchList());
    [HttpPost] public async Task<JsonResult> Save(PurchaseReturnModel model) => Json(await _svc.Save(model));
    public async Task<JsonResult> Delete(int id) => Json(await _svc.Delete(id));
    public async Task<JsonResult> DeleteItem(int id) => Json(await _svc.DeleteItem(id));

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<JsonResult> Submit(int id) => Json(await _svc.ChangeStatus(id, 2, null));

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<JsonResult> Approve(int id) => Json(await _svc.ChangeStatus(id, 3, null));

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<JsonResult> Reject(int id, string? reason) => Json(await _svc.ChangeStatus(id, 4, reason));
}
