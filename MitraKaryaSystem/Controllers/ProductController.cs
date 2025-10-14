using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;
using MitraKaryaSystem.Security;
namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    [HasPermission("Product")] // Require Product permission
    public class ProductController : Controller
    {
        private readonly IProductService _service;
        private readonly ICategoryService _categoryService;
        private readonly IUnitService _unitService;
        private readonly ISupplierService _supplierService;
        public ProductController(IProductService service, ICategoryService categoryService, IUnitService unitService, ISupplierService supplierService)
        {
            _service = service;
            _categoryService = categoryService;
            _unitService = unitService;
            _supplierService = supplierService;
        }
        public IActionResult Index() => View();
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
        public async Task<object> GetProductList() => await _service.GetProductList();

        public async Task<object> GetCategoryList() => await _categoryService.GetCategoryList();

        public async Task<object> GetSupplierList() => await _supplierService.GetSupplierList();

        public async Task<object> GetUnitList() => await _unitService.GetUnitList();

        public async Task<JsonResult> SaveProduct(ProductViewModel product) => Json(await _service.SaveProduct(product.ProductModel));

        public async Task<JsonResult> SaveCategory(CategoryModel category) => Json(await _categoryService.SaveCategory(category));

        public async Task<JsonResult> SaveUnit(UnitModel unit) => Json(await _unitService.SaveUnit(unit));

        public async Task<JsonResult> DeleteProduct(int id) => Json(await _service.DeleteProduct(id));

        public async Task<JsonResult> DeleteCategory(int id) => Json(await _categoryService.DeleteCategory(id));

        public async Task<JsonResult> DeleteUnit(int id) => Json(await _unitService.DeleteUnit(id));

        public async Task<IActionResult> FillFormCategory(int id) => PartialView("_TableCategory", await _categoryService.FillFormCategory(id));

        public async Task<IActionResult> FillFormUnit(int id) => PartialView("_TableUnit", await _unitService.FillFormUnit(id));

        public async Task<JsonResult> GetProductComboList(string name = "") => Json(await _service.GetProductComboList(name));

        public async Task<IActionResult> FillFormProduct(int id)
        {
            try
            {
                var data = await _service.FillFormProduct(id);
                var viewModel = new ProductViewModel
                {
                    ProductModel = data
                };
                return PartialView("Form", viewModel); // Return the "Form" view with the filled data
            }
            catch (Exception ex)
            {
                // Handle the exception, you might want to log it or return an error view
                return View("Error");
            }
        }
    }
}
