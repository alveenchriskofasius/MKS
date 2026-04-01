using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace Marketplace.Controllers
{
    [Authorize(AuthenticationSchemes = "MarketplaceAuth")]
    public class WishlistController : Controller
    {
        private readonly IMarketplaceAuthService _authService;
        private readonly ICatalogService _catalogService;

        public WishlistController(
            IMarketplaceAuthService authService,
            ICatalogService catalogService)
        {
            _authService = authService;
            _catalogService = catalogService;
        }

        public IActionResult Index() => View();

        [HttpGet]
        public async Task<JsonResult> GetWishlistItems()
        {
            var ids = await GetWishlistIds();
            if (!ids.Any())
                return Json(new List<object>());

            var items = new List<object>();
            foreach (var id in ids)
            {
                var product = await _catalogService.GetProductById(id);
                if (product != null)
                    items.Add(product);
            }
            return Json(items);
        }

        [HttpGet]
        public async Task<JsonResult> GetCount()
        {
            var ids = await GetWishlistIds();
            return Json(new { count = ids.Count });
        }

        [HttpGet]
        public async Task<JsonResult> IsInWishlist(int productId)
        {
            var ids = await GetWishlistIds();
            return Json(new { inWishlist = ids.Contains(productId) });
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<JsonResult> GetWishlistProductIds()
        {
            var ids = await GetWishlistIds();
            return Json(new { ids });
        }

        [HttpPost]
        public async Task<JsonResult> Toggle(int productId)
        {
            var customerId = GetCustomerId();
            if (customerId == 0)
                return Json(new { success = false, message = "Not authenticated." });

            var ids = await GetWishlistIds();
            bool added;
            if (ids.Contains(productId))
            {
                ids.Remove(productId);
                added = false;
            }
            else
            {
                ids.Add(productId);
                added = true;
            }

            var json = JsonSerializer.Serialize(ids);
            await _authService.SaveWishlist(customerId, json);

            return Json(new { success = true, added, count = ids.Count });
        }

        [HttpPost]
        public async Task<JsonResult> Remove(int productId)
        {
            var customerId = GetCustomerId();
            if (customerId == 0)
                return Json(new { success = false, message = "Not authenticated." });

            var ids = await GetWishlistIds();
            ids.Remove(productId);

            var json = JsonSerializer.Serialize(ids);
            await _authService.SaveWishlist(customerId, json);

            return Json(new { success = true, count = ids.Count });
        }

        private async Task<List<int>> GetWishlistIds()
        {
            var customerId = GetCustomerId();
            if (customerId == 0) return new List<int>();

            var json = await _authService.GetWishlist(customerId);
            if (string.IsNullOrEmpty(json)) return new List<int>();

            try
            {
                return JsonSerializer.Deserialize<List<int>>(json) ?? new List<int>();
            }
            catch
            {
                return new List<int>();
            }
        }

        private int GetCustomerId()
        {
            var claim = User.FindFirst("CustomerId")?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }
    }
}
