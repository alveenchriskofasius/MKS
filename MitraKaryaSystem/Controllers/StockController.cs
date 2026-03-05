using API.Context.Table;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
public class StockController : Controller
{
    private readonly MKSTableContext _db;

    public StockController(MKSTableContext db)
    {
        _db = db;
    }

    [HasPermission("Product")]
    [HttpGet]
    public IActionResult Low() => View();

    [HasPermission("Product")]
    [HttpGet]
    public async Task<JsonResult> LowList(int? threshold = null)
    {
        var q = _db.Products.AsNoTracking();
        if (threshold.HasValue)
        {
            q = q.Where(p => p.StockQuantity <= threshold.Value);
        }
        else
        {
            q = q.Where(p => p.StockQuantity <= (p.LowStockThreshold ?? 0));
        }

        var list = await q.OrderBy(p => p.StockQuantity)
            .Select(p => new { id = p.ID, name = p.Name, qty = p.StockQuantity, lowStockThreshold = p.LowStockThreshold })
            .ToListAsync();

        return Json(list);
    }

    [HasPermission("Product")]
    [HttpGet]
    public async Task<JsonResult> Card(int productId, int take = 200)
    {
        var rows = await _db.StockLedgers.AsNoTracking()
            .Where(x => x.ProductID == productId)
            .OrderByDescending(x => x.Date)
            .ThenByDescending(x => x.ID)
            .Take(Math.Clamp(take, 1, 1000))
            .Select(x => new
            {
                id = x.ID,
                date = x.Date,
                refType = x.RefType,
                refId = x.RefId,
                refNo = x.RefNo,
                qtyChange = x.QtyChange,
                qtyAfter = x.QtyAfter,
                note = x.Note,
                createdBy = x.CreatedBy
            })
            .ToListAsync();

        return Json(rows);
    }
}
