using API.Context.Table;
using Microsoft.EntityFrameworkCore;

namespace API.Services;

public interface IStockLedgerService
{
    Task WriteAsync(int productId, int qtyChange, string refType, int? refId, string? refNo, string? note = null);
}

public sealed class StockLedgerService : IStockLedgerService
{
    private readonly MKSTableContext _context;
    private readonly IHttpContextAccessor _http;

    public StockLedgerService(MKSTableContext context, IHttpContextAccessor http)
    {
        _context = context;
        _http = http;
    }

    public async Task WriteAsync(int productId, int qtyChange, string refType, int? refId, string? refNo, string? note = null)
    {
        var product = await _context.Products.FirstOrDefaultAsync(p => p.ID == productId);
        if (product == null) return;

        var after = product.StockQuantity;
        var user = _http.HttpContext?.User?.Identity?.Name;

        var row = new StockLedger
        {
            ProductID = productId,
            Date = DateTime.Now,
            RefType = refType,
            RefId = refId,
            RefNo = refNo,
            QtyChange = qtyChange,
            QtyAfter = after,
            Note = note,
            CreatedBy = user
        };

        await _context.StockLedgers.AddAsync(row);
        await _context.SaveChangesAsync();
    }
}
