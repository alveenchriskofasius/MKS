using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Promo")]
public class PromoController : Controller
{
    private readonly IPromoService _svc;
    private readonly ICategoryService _catSvc;
    private readonly IProductService _prodSvc;

    public PromoController(IPromoService svc, ICategoryService catSvc, IProductService prodSvc)
    {
        _svc = svc;
        _catSvc = catSvc;
        _prodSvc = prodSvc;
    }

    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> GetList() => Json(await _svc.GetList());

    [HttpGet]
    public async Task<JsonResult> Get(int id) => Json(await _svc.Get(id));

    [HttpGet]
    public async Task<JsonResult> GetCategories() => Json(await _catSvc.GetCategoryList());

    [HttpGet]
    public async Task<JsonResult> GetProducts() => Json(await _prodSvc.GetProductList());

    [HttpPost]
    public async Task<JsonResult> Save(PromoModel model) => Json(await _svc.Save(model));

    [HttpPost]
    public async Task<JsonResult> Delete(int id) => Json(await _svc.Delete(id));

    [HttpPost]
    public async Task<JsonResult> Apply(int id) => Json(await _svc.ApplyPromo(id));

    [HttpPost]
    public async Task<JsonResult> Deactivate(int id) => Json(await _svc.DeactivatePromo(id));
}
