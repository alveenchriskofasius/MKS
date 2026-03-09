using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize]
    [HasPermission("Stock Count")]
    public class StockCountController : Controller
    {
        private readonly IStockCountService _service;
        public StockCountController(IStockCountService service) { _service = service; }
        public IActionResult Index() => View();
        public async Task<IActionResult> FillForm(int id) => PartialView("_Form", await _service.FillForm(id));
        public async Task<JsonResult> GetDetailList(int id) => Json(await _service.GetDetailList(id));
        public async Task<JsonResult> GetSearchList() => Json(await _service.GetSearchList());
        [HttpPost]
        public async Task<JsonResult> Save(StockCountModel model) => Json(await _service.Save(model));
        public async Task<JsonResult> Delete(int id) => Json(await _service.Delete(id));
        public async Task<JsonResult> DeleteItem(int id) => Json(await _service.DeleteItem(id));
        public async Task<JsonResult> AutoAdjust(int id) => Json(await _service.AutoAdjust(id));
    }
}
