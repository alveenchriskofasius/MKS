using API.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize]
    [HasPermission("Stock In")] // permission name must match records in Permission table
    public class StockInController : Controller
    {
        private readonly IStockInService _stockInService;

        public StockInController(IStockInService stockInService) => _stockInService = stockInService;
        public IActionResult Index() => View();
        public async Task<JsonResult> ScanBarcode(string barcode) => Json(await _stockInService.ScanBarcode(barcode));
        public async Task<IActionResult> FillFormProduct(int id) => PartialView("_FormDetail", await _stockInService.FillFormDetail(id));
        public async Task<IActionResult> FillForm(int id) => PartialView("_FormHeader", await _stockInService.FillForm(id));
        [HttpPost]
        public async Task<JsonResult> Save([FromBody] StockInModel stockIn) => Json(await _stockInService.Save(stockIn));
        public async Task<JsonResult> GetDetailListById(int id) => Json(await _stockInService.GetDetailListById(id));
        public async Task<object> GetStockInList() => Json(await _stockInService.GetStockInList());
        public async Task<object> DeleteItem(int id) => Json(await _stockInService.DeleteProductById(id));
        public async Task<object> Delete(int id) => Json(await _stockInService.DeleteById(id));
        [HttpPost]
        public async Task<object> Submit(int id) => Json(await _stockInService.Submit(id));
        [HttpPost]
        [HasPermission("StockIn.Verify")]
        public async Task<object> Verify(int id) => Json(await _stockInService.Verify(id));
        [HttpPost]
        public async Task<JsonResult> CreateFromPO(int poId) => Json(await _stockInService.CreateFromPurchaseOrder(poId));
        public async Task<JsonResult> GetApprovedPOs() => Json(await _stockInService.GetApprovedPurchaseOrders());
        public async Task<JsonResult> GetPOQties(int id) => Json(await _stockInService.GetPOItemQuantities(id));
    }
}
