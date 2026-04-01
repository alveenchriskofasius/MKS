using API.Services.Interfaces;
using Marketplace.Models;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.Controllers
{
    public class HomeController : Controller
    {
        private readonly ICatalogService _catalogService;
        private readonly IStoreProfileService _storeProfileService;

        public HomeController(ICatalogService catalogService, IStoreProfileService storeProfileService)
        {
            _catalogService = catalogService;
            _storeProfileService = storeProfileService;
        }

        public IActionResult Index() => View();

        public IActionResult Privacy() => View();

        [HttpGet]
        public async Task<JsonResult> GetHomeData()
        {
            var profile = await _storeProfileService.GetProfile() as Dictionary<string, string>
                          ?? new Dictionary<string, string>();

            var allProducts = await _catalogService.GetProductList(null, null);
            var discounted = allProducts.Where(p => p.HasDiscount).Take(4).ToList();
            var popular = await _catalogService.GetPopularProducts(10);

            return Json(new
            {
                storeName = profile.GetValueOrDefault("storeName", "Marketplace"),
                storeAddress = profile.GetValueOrDefault("address", ""),
                storePhone = profile.GetValueOrDefault("phone", ""),
                popular,
                discounted
            });
        }

        [HttpGet]
        public async Task<JsonResult> GetProducts(int skip = 0, int take = 12)
        {
            var products = await _catalogService.GetProductsPaged(skip, take);
            return Json(new { products, hasMore = products.Count == take });
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel
            {
                RequestId = System.Diagnostics.Activity.Current?.Id ?? HttpContext.TraceIdentifier
            });
        }
    }
}
