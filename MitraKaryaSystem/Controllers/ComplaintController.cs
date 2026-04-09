using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Marketplace Order")]
public class ComplaintController : Controller
{
    private readonly IComplaintService _svc;

    public ComplaintController(IComplaintService svc)
    {
        _svc = svc;
    }

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> GetAll() => Json(await _svc.GetAll());

    [HttpGet]
    public async Task<JsonResult> GetDetail(int id) => Json(await _svc.GetById(id));

    [HttpPost]
    public async Task<JsonResult> UpdateStatus(int id, string status, string? adminNote)
        => Json(await _svc.UpdateStatus(id, status, adminNote));
}
