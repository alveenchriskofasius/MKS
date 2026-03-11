using API.Context.Table;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers;

[Authorize]
[HasPermission("Product")]
public class StockController : Controller
{
    private readonly MKSTableContext _db;

    public StockController(MKSTableContext db)
    {
        _db = db;
    }

    [HttpGet]
    public IActionResult Index() => View();

    [HttpGet]
    public async Task<JsonResult> ProductList()
    {
        var list = await _db.Products.AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new { id = p.ID, name = p.Name, stock = p.StockQuantity })
            .ToListAsync();
        return Json(list);
    }

    [HttpGet]
    public async Task<JsonResult> Card(int productId, DateTime? from = null, DateTime? to = null, int take = 500)
    {
        var query = _db.StockLedgers.AsNoTracking()
            .Where(x => x.ProductID == productId);

        if (from.HasValue) query = query.Where(x => x.Date >= from.Value.Date);
        if (to.HasValue) query = query.Where(x => x.Date < to.Value.Date.AddDays(1));

        var rows = await query
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

    [HttpGet]
    public async Task<JsonResult> Summary(int productId)
    {
        var product = await _db.Products.AsNoTracking()
            .Where(p => p.ID == productId)
            .Select(p => new { p.Name, p.StockQuantity, p.LowStockThreshold })
            .FirstOrDefaultAsync();
        if (product == null) return Json(new { success = false });

        var totalIn = await _db.StockLedgers.AsNoTracking()
            .Where(x => x.ProductID == productId && x.QtyChange > 0)
            .SumAsync(x => (int?)x.QtyChange) ?? 0;
        var totalOut = await _db.StockLedgers.AsNoTracking()
            .Where(x => x.ProductID == productId && x.QtyChange < 0)
            .SumAsync(x => (int?)x.QtyChange) ?? 0;

        return Json(new
        {
            success = true,
            name = product.Name,
            currentStock = product.StockQuantity,
            threshold = product.LowStockThreshold ?? 0,
            totalIn,
            totalOut = Math.Abs(totalOut)
        });
    }
}
