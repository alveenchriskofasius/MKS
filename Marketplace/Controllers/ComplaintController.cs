using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.Controllers;

[Authorize(AuthenticationSchemes = "MarketplaceAuth")]
public class ComplaintController : Controller
{
    private readonly IComplaintService _svc;

    public ComplaintController(IComplaintService svc)
    {
        _svc = svc;
    }

    public IActionResult Index() => View();

    public IActionResult Create(int orderId)
    {
        ViewData["OrderId"] = orderId;
        return View();
    }

    [HttpGet]
    public async Task<JsonResult> GetMyComplaints()
    {
        var customerId = GetCustomerId();
        var list = await _svc.GetByCustomer(customerId);
        return Json(list);
    }

    [HttpPost]
    public async Task<JsonResult> Submit(ComplaintCreateModel model)
    {
        var customerId = GetCustomerId();
        var result = await _svc.Create(customerId, model);
        return Json(result);
    }

    private int GetCustomerId()
    {
        var claim = User.FindFirst("CustomerId")?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }
}
