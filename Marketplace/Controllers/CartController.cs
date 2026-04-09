using API.Services.Interfaces;
using Marketplace.Models;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace Marketplace.Controllers
{
    public class CartController : Controller
    {
        private readonly ICatalogService _catalogService;
        private readonly IMarketplaceAuthService _authService;
        private const string CartSessionKey = "MarketplaceCart";

        public CartController(
            ICatalogService catalogService,
            IMarketplaceAuthService authService)
        {
            _catalogService = catalogService;
            _authService = authService;
        }

        public IActionResult Index() => View();

        [HttpPost]
        public async Task<JsonResult> Add(
            int productId,
            int quantity = 1,
            int? variantId = null,
            string? variantName = null)
        {
            if (User.Identity?.IsAuthenticated != true)
                return Json(new
                {
                    success = false,
                    message = "Silakan login terlebih dahulu.",
                    requireLogin = true
                });

            var product = await _catalogService.GetProductById(productId);
            if (product == null)
                return Json(new { success = false, message = "Produk tidak ditemukan." });

            // Enforce variant selection for products that require it
            if (product.HasVariants && variantId == null)
                return Json(new { success = false, message = "Silakan pilih varian produk terlebih dahulu." });

            // Determine effective stock: variant stock when variantId is present, otherwise product stock
            int effectiveStock = product.StockQuantity;
            if (variantId.HasValue)
            {
                var variant = await _catalogService.GetVariantById(variantId.Value);
                if (variant == null)
                    return Json(new { success = false, message = "Varian tidak ditemukan." });
                effectiveStock = variant.StockQuantity;
            }

            if (effectiveStock < quantity)
                return Json(new { success = false, message = "Stok tidak mencukupi." });

            var cart = GetCart();
            var existing = cart.FirstOrDefault(c =>
                c.ProductID == productId && c.VariantID == variantId);

            if (existing != null)
            {
                var newQty = existing.Quantity + quantity;
                if (newQty > effectiveStock)
                    return Json(new
                    {
                        success = false,
                        message = $"Stok tidak mencukupi (tersedia: {effectiveStock}, di keranjang: {existing.Quantity})."
                    });
                existing.Quantity = newQty;
            }
            else
            {
                cart.Add(new CartItem
                {
                    ProductID = product.ID,
                    ProductName = product.Name,
                    UnitPrice = product.FinalPrice,
                    Quantity = quantity,
                    VariantID = variantId,
                    VariantName = variantName
                });
            }

            SaveCart(cart);
            await SyncCartToDb(cart);
            return Json(new { success = true, cartCount = cart.Count });
        }

        [HttpPost]
        public async Task<JsonResult> Update(
            int productId,
            int quantity,
            int? variantId = null)
        {
            var cart = GetCart();
            var item = cart.FirstOrDefault(c =>
                c.ProductID == productId && c.VariantID == variantId);

            if (item != null)
            {
                if (quantity <= 0)
                {
                    cart.Remove(item);
                }
                else
                {
                    var product = await _catalogService.GetProductById(productId);
                    int maxStock = product?.StockQuantity ?? int.MaxValue;
                    if (variantId.HasValue && product != null)
                    {
                        var variant = await _catalogService.GetVariantById(variantId.Value);
                        if (variant != null) maxStock = variant.StockQuantity;
                    }
                    if (quantity > maxStock)
                    {
                        return Json(new
                        {
                            success = false,
                            message = $"Stok tidak mencukupi (tersedia: {maxStock}).",
                            maxStock
                        });
                    }
                    item.Quantity = quantity;
                }
            }

            SaveCart(cart);
            await SyncCartToDb(cart);
            return Json(new
            {
                success = true,
                cartCount = cart.Count,
                total = cart.Sum(c => c.Subtotal)
            });
        }

        [HttpPost]
        public async Task<JsonResult> Remove(
            int productId,
            int? variantId = null)
        {
            var cart = GetCart();
            cart.RemoveAll(c =>
                c.ProductID == productId && c.VariantID == variantId);
            SaveCart(cart);
            await SyncCartToDb(cart);
            return Json(new
            {
                success = true,
                cartCount = cart.Count,
                total = cart.Sum(c => c.Subtotal)
            });
        }

        [HttpGet]
        public JsonResult GetCartCount()
        {
            var cart = GetCart();
            return Json(new { count = cart.Count });
        }

        [HttpGet]
        public async Task<JsonResult> GetCartItems()
        {
            var cart = GetCart();
            var enriched = new List<object>();
            foreach (var item in cart)
            {
                var product = await _catalogService.GetProductById(item.ProductID);
                int stockQuantity = product?.StockQuantity ?? 0;
                if (item.VariantID.HasValue)
                {
                    var variant = await _catalogService.GetVariantById(item.VariantID.Value);
                    if (variant != null) stockQuantity = variant.StockQuantity;
                }
                enriched.Add(new
                {
                    item.ProductID,
                    item.ProductName,
                    item.UnitPrice,
                    item.Quantity,
                    item.Subtotal,
                    stockQuantity,
                    item.VariantID,
                    item.VariantName
                });
            }
            return Json(new
            {
                items = enriched,
                total = cart.Sum(c => c.Subtotal)
            });
        }

        /// <summary>
        /// Called after login to restore the user's saved cart from DB into session.
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> RestoreCart()
        {
            var customerId = GetCustomerId();
            if (customerId == 0)
                return Json(new { success = false });

            var dbJson = await _authService.GetCart(customerId);
            if (!string.IsNullOrEmpty(dbJson))
            {
                var dbCart = JsonSerializer.Deserialize<List<CartItem>>(dbJson)
                    ?? new List<CartItem>();
                var sessionCart = GetCart();

                // Merge: DB cart + session items (session wins on duplicates)
                foreach (var dbItem in dbCart)
                {
                    if (!sessionCart.Any(s =>
                        s.ProductID == dbItem.ProductID && s.VariantID == dbItem.VariantID))
                        sessionCart.Add(dbItem);
                }
                SaveCart(sessionCart);
            }

            var cart = GetCart();
            return Json(new
            {
                success = true,
                cartCount = cart.Count
            });
        }

        private List<CartItem> GetCart()
        {
            var json = HttpContext.Session.GetString(CartSessionKey);
            if (string.IsNullOrEmpty(json))
                return new List<CartItem>();
            return JsonSerializer.Deserialize<List<CartItem>>(json)
                ?? new List<CartItem>();
        }

        private void SaveCart(List<CartItem> cart)
        {
            HttpContext.Session.SetString(
                CartSessionKey,
                JsonSerializer.Serialize(cart));
        }

        private async Task SyncCartToDb(List<CartItem> cart)
        {
            var customerId = GetCustomerId();
            if (customerId == 0) return;
            var json = cart.Count > 0
                ? JsonSerializer.Serialize(cart)
                : null;
            await _authService.SaveCart(customerId, json ?? "[]");
        }

        private int GetCustomerId()
        {
            var claim = User.FindFirst("CustomerId")?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }
    }
}
