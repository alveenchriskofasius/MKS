using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MitraKaryaSystem.Controllers;

[Route("api/paymentin")]
[ApiController]
[Authorize(Roles = "Admin,Kasir")]
public class PaymentInController : ControllerBase
{
    private readonly IPaymentInService _svc;
    public PaymentInController(IPaymentInService svc) { _svc = svc; }

    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] PaymentInCreateRequest req)
        => Ok(await _svc.Create(req));

    [HttpGet("get/{id:int}")]
    public async Task<IActionResult> Get(int id)
        => Ok(await _svc.Get(id));

    [HttpGet("list")]
    public async Task<IActionResult> List([FromQuery] int? customerId, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] short? statusId, [FromQuery] int? salesOrderId, [FromQuery] int? salesInvoiceId)
        => Ok(await _svc.List(customerId, from, to, statusId, salesOrderId, salesInvoiceId));

    [HttpPost("update-status")]
    public async Task<IActionResult> UpdateStatus([FromQuery] int id, [FromQuery] short statusId = 2)
        => Ok(await _svc.UpdateStatus(id, statusId));

    [HttpDelete("delete/{id:int}")]
    public async Task<IActionResult> Delete(int id)
        => Ok(await _svc.Delete(id));
}
