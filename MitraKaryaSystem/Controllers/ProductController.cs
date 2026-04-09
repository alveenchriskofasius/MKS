using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;
using MitraKaryaSystem.Security;
namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    public class ProductController : Controller
    {
        private readonly IProductService _service;
        private readonly ICategoryService _categoryService;
        private readonly IUnitService _unitService;
        private readonly ISupplierService _supplierService;
        private readonly IWebHostEnvironment _env;
        public ProductController(
            IProductService service,
            ICategoryService categoryService,
            IUnitService unitService,
            ISupplierService supplierService,
            IWebHostEnvironment env)
        {
            _service = service;
            _categoryService = categoryService;
            _unitService = unitService;
            _supplierService = supplierService;
            _env = env;
        }

        [HasPermission("Product")]
        public IActionResult Index() => View();

        [HasPermission("Product")]
        public async Task<IActionResult> Form(int id)
        {
            var data = new ProductViewModel();
            if (id != 0)
            {
                data.ProductModel = await _service.FillFormProduct(id);
                return View(data);
            }
            return View(data);
        }

        [HasPermission("Product")]
        public async Task<object> GetProductList() => await _service.GetProductList();

        // These lists are used across multiple screens (not only Product management),
        // so keep them available for any authenticated user.
        public async Task<object> GetCategoryList() => await _categoryService.GetCategoryList();

        public async Task<object> GetSupplierList() => await _supplierService.GetSupplierList();

        public async Task<object> GetUnitList() => await _unitService.GetUnitList();

        [HasPermission("Product")]
        public async Task<JsonResult> SaveProduct(ProductViewModel product)
        {
            try
            {
                if (product.ImageFile != null && product.ImageFile.Length > 0)
                {
                    var uploadsDir = Path.Combine(Path.GetFullPath(Path.Combine(_env.ContentRootPath, "..", "Uploads")), "products");
                    Directory.CreateDirectory(uploadsDir);
                    var fileName = Guid.NewGuid() + Path.GetExtension(product.ImageFile.FileName);
                    using var stream = new FileStream(Path.Combine(uploadsDir, fileName), FileMode.Create);
                    await product.ImageFile.CopyToAsync(stream);
                    product.ProductModel.ImageUrl = "/uploads/products/" + fileName;
                }
            }
            catch (Exception ex)
            {
                return Json(new { success = false, error = "Image upload failed: " + ex.Message });
            }
            return Json(await _service.SaveProduct(product.ProductModel));
        }

        [HasPermission("Product")]
        public async Task<JsonResult> SaveCategory(CategoryModel category) => Json(await _categoryService.SaveCategory(category));

        [HasPermission("Product")]
        public async Task<JsonResult> SaveUnit(UnitModel unit) => Json(await _unitService.SaveUnit(unit));

        [HasPermission("Product")]
        public async Task<JsonResult> DeleteProduct(int id) => Json(await _service.DeleteProduct(id));

        [HasPermission("Product")]
        public async Task<JsonResult> DeleteCategory(int id) => Json(await _categoryService.DeleteCategory(id));

        [HasPermission("Product")]
        public async Task<JsonResult> DeleteUnit(int id) => Json(await _unitService.DeleteUnit(id));

        [HasPermission("Product")]
        public async Task<IActionResult> FillFormCategory(int id) => PartialView("_TableCategory", await _categoryService.FillFormCategory(id));

        [HasPermission("Product")]
        public async Task<IActionResult> FillFormUnit(int id) => PartialView("_TableUnit", await _unitService.FillFormUnit(id));

        // Product combo list is used by Sales Order and other modules; do not require Product permission.
        [HttpGet]
        public async Task<JsonResult> GetProductComboList(string name = "") => Json(await _service.GetProductComboList(name));

        // Products filtered by supplier — used by Purchase Order picker; no Product permission required.
        [HttpGet]
        public async Task<JsonResult> GetProductsBySupplier(int supplierId) => Json(await _service.GetProductsBySupplier(supplierId));

        [HasPermission("Product")]
        public async Task<IActionResult> FillFormProduct(int id)
        {
            try
            {
                var data = await _service.FillFormProduct(id);
                var viewModel = new ProductViewModel
                {
                    ProductModel = data
                };
                return PartialView("Form", viewModel);
            }
            catch (Exception)
            {
                return View("Error");
            }
        }

        [HasPermission("Product")]
        [HttpPost]
        public async Task<JsonResult> UploadProductImage(int id, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return Json(new { success = false, error = "No file uploaded." });

            var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowed.Contains(ext))
                return Json(new { success = false, error = "Only jpg, png, webp allowed." });

            var uploadsDir = Path.Combine(Path.GetFullPath(Path.Combine(_env.ContentRootPath, "..", "Uploads")), "products");
            Directory.CreateDirectory(uploadsDir);

            var fileName = $"product_{id}_{DateTime.Now:yyyyMMddHHmmss}{ext}";
            var filePath = Path.Combine(uploadsDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var imageUrl = $"/uploads/products/{fileName}";
            var result = await _service.UpdateProductImage(id, imageUrl);
            return Json(result);
        }

        [HasPermission("Product")]
        [HttpGet]
        public async Task<JsonResult> GetVariants(int productId) => Json(await _service.GetVariants(productId));

        [HasPermission("Product")]
        [HttpPost]
        public async Task<JsonResult> SaveVariant(ProductVariantModel model) => Json(await _service.SaveVariant(model));

        [HasPermission("Product")]
        [HttpGet]
        public async Task<JsonResult> DeleteVariant(int id) => Json(await _service.DeleteVariant(id));
    }
}
