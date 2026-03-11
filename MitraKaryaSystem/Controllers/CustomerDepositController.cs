using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Customer Deposit")]
public class CustomerDepositController : Controller
{
    private readonly ICustomerDepositService _svc;
    private readonly ISupplierService _supplierService;

    public CustomerDepositController(ICustomerDepositService svc, ISupplierService supplierService)
    {
        _svc = svc;
        _supplierService = supplierService;
    }

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> GetList() => Json(await _svc.GetList());

    [HttpGet]
    public async Task<JsonResult> Get(int id) => Json(await _svc.Get(id));

    [HttpPost]
    public async Task<JsonResult> Adjust(int supplierId, decimal amount) => Json(await _svc.Adjust(supplierId, amount));

    [HttpGet]
    public async Task<JsonResult> GetSupplierList() => Json(await _supplierService.GetSupplierList());
}
