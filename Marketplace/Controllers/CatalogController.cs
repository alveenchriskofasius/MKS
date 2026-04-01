using API.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.Controllers
{
    public class CatalogController : Controller
    {
        private readonly ICatalogService _catalogService;

        public CatalogController(ICatalogService catalogService)
        {
            _catalogService = catalogService;
        }

        public IActionResult Index() => View();

        public IActionResult Detail(int id)
        {
            ViewData["ProductId"] = id;
            return View();
        }

        [HttpGet]
        public async Task<JsonResult> GetProductList(int? categoryId, string? q)
        {
            var products = await _catalogService.GetProductList(categoryId, q);
            return Json(products);
        }

        [HttpGet]
        public async Task<JsonResult> GetCategoryList()
        {
            var categories = await _catalogService.GetCategoryList();
            return Json(categories);
        }

        [HttpGet]
        public async Task<JsonResult> GetProductDetail(int id)
        {
            var product = await _catalogService.GetProductDetail(id);
            return Json(product);
        }

        [HttpGet]
        public async Task<JsonResult> Search(string? q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return Json(new List<object>());

            var results = await _catalogService.SearchProducts(q);
            return Json(results);
        }
    }
}
