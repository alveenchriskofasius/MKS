using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    [HasPermission("Category")]
    public class CategoryController : Controller
    {
        private readonly ICategoryService _service;
        public CategoryController(ICategoryService service) => _service = service;
        public IActionResult Index() => RedirectToAction("Index", "MasterSetting");
        public async Task<JsonResult> GetList() => Json(await _service.GetCategoryList());
        [HttpPost]
        public async Task<IActionResult> FillForm(int id) => PartialView("_CategoryModal", await _service.FillFormCategory(id));
        [HttpPost]
        public async Task<JsonResult> Save(CategoryModel model) => Json(await _service.SaveCategory(model));
        [HttpPost]
        public async Task<JsonResult> Delete(int id) => Json(await _service.DeleteCategory(id));
    }
}
