using API.Context.Table;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StockController : ControllerBase
{
    private readonly MKSTableContext _context;

    public StockController(MKSTableContext context)
    {
        _context = context;
    }

    [HttpGet("low")]
    public async Task<IActionResult> GetLowStock([FromQuery] int? threshold = null)
    {
        var q = _context.Products.AsNoTracking().Where(p => p.StockQuantity <= (threshold ?? (p.LowStockThreshold ?? 0)));
        var list = await q.OrderBy(p => p.StockQuantity)
            .Select(p => new { id = p.ID, name = p.Name, qty = p.StockQuantity, lowStockThreshold = p.LowStockThreshold })
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("card/{productId:int}")]
    public async Task<IActionResult> GetStockCard(int productId, [FromQuery] int take = 200)
    {
        var exists = await _context.Products.AsNoTracking().AnyAsync(p => p.ID == productId);
        if (!exists) return NotFound();

        var rows = await _context.StockLedgers.AsNoTracking()
            .Where(x => x.ProductID == productId)
            .OrderByDescending(x => x.Date)
            .ThenByDescending(x => x.ID)
            .Take(Math.Clamp(take, 1, 1000))
            .Select(x => new
            {
                id = x.ID,
                date = x.Date.ToString("dd-MM-yyyy HH:mm:ss"),
                refType = x.RefType,
                refId = x.RefId,
                refNo = x.RefNo,
                qtyChange = x.QtyChange,
                qtyAfter = x.QtyAfter,
                note = x.Note,
                createdBy = x.CreatedBy
            })
            .ToListAsync();

        return Ok(rows);
    }
}
