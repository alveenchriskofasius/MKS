using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;
namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Sales Return")]
public class SalesReturnController : Controller
{
    private readonly ISalesReturnService _svc; public SalesReturnController(ISalesReturnService s) { _svc = s; }
    public IActionResult Index() => View();
    public async Task<IActionResult> FillForm(int id) => PartialView("_Form", await _svc.FillForm(id));
    public async Task<JsonResult> GetDetailList(int id) => Json(await _svc.GetDetailList(id));
    public async Task<JsonResult> GetSearchList() => Json(await _svc.GetSearchList());
    [HttpPost] public async Task<JsonResult> Save(SalesReturnModel model) => Json(await _svc.Save(model));
    public async Task<JsonResult> Delete(int id) => Json(await _svc.Delete(id));
    public async Task<JsonResult> DeleteItem(int id) => Json(await _svc.DeleteItem(id));
}
