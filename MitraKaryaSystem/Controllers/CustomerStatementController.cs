using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Customer Statement")]
public class CustomerStatementController : Controller
{
    private readonly ICustomerStatementService _svc;
    private readonly ICustomerService _customerService;

    public CustomerStatementController(ICustomerStatementService svc, ICustomerService customerService)
    {
        _svc = svc;
        _customerService = customerService;
    }

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> GetCustomers()
    {
        var customers = await _customerService.GetListModel();
        var filtered = customers
            .Where(c => !c.IsSupplier && !c.IsSales)
            .Select(c => new { c.ID, c.Name })
            .ToList();
        return Json(filtered);
    }

    [HttpGet]
    public async Task<JsonResult> GetStatement(int customerId, DateTime? from, DateTime? to)
        => Json(await _svc.GetStatement(customerId, from, to));
}
