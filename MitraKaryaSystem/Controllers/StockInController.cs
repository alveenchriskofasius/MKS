using API.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
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
        public async Task<JsonResult> Save(StockInModel stockIn) => Json(await _stockInService.Save(stockIn));
        public async Task<JsonResult> GetDetailListById(int id) => Json(await _stockInService.GetDetailListById(id));
        public async Task<object> GetStockInList() => Json(await _stockInService.GetStockInList());
        public async Task<object> DeleteItem(int id) => Json(await _stockInService.DeleteProductById(id));
        public async Task<object> Delete(int id) => Json(await _stockInService.DeleteById(id));
    }
}
