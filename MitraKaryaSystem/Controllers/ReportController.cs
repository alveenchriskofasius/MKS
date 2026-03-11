using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Report")]
public class ReportController : Controller
{
    private readonly ISalesOrderService _salesOrderService;
    private readonly IPurchaseOrderService _purchaseOrderService;
    private readonly IProductService _productService;
    private readonly IPaymentInService _paymentInService;
    private readonly IPaymentOutService _paymentOutService;

    public ReportController(
        ISalesOrderService salesOrderService,
        IPurchaseOrderService purchaseOrderService,
        IProductService productService,
        IPaymentInService paymentInService,
        IPaymentOutService paymentOutService)
    {
        _salesOrderService = salesOrderService;
        _purchaseOrderService = purchaseOrderService;
        _productService = productService;
        _paymentInService = paymentInService;
        _paymentOutService = paymentOutService;
    }

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> SalesData()
    {
        var list = await _salesOrderService.GetSearchList();
        return Json(list);
    }

    [HttpGet]
    public async Task<JsonResult> PurchaseData()
    {
        var list = await _purchaseOrderService.GetSearchList();
        return Json(list);
    }

    [HttpGet]
    public async Task<JsonResult> ProductData()
    {
        var list = await _productService.GetProductList();
        return Json(list);
    }

    [HttpGet]
    public async Task<JsonResult> PaymentInData(int? customerId, DateTime? from, DateTime? to, short? statusId)
    {
        var list = await _paymentInService.List(customerId, from, to, statusId, null, null);
        return Json(list);
    }

    [HttpGet]
    public async Task<JsonResult> PaymentOutData(int? supplierId, DateTime? from, DateTime? to, short? statusId)
    {
        var list = await _paymentOutService.List(supplierId, from, to, statusId, null);
        return Json(list);
    }
}
