using API.Context.Table;
using API.Models;
using API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Services;

public class PriceHistoryService : IPriceHistoryService
{
    private readonly MKSTableContext _ctx;
    public PriceHistoryService(MKSTableContext ctx) => _ctx = ctx;

    public async Task<IEnumerable<PriceListItem>> GetPriceList()
    {
        var products = await (
            from p in _ctx.Products.AsNoTracking()
            join c in _ctx.Categories.AsNoTracking() on p.CategoryID equals c.ID into cg
            from cat in cg.DefaultIfEmpty()
            join s in _ctx.Customers.AsNoTracking().Where(x => x.IsSupplier) on (int)p.SupplierID equals s.ID into sg
            from sup in sg.DefaultIfEmpty()
            select new { p, catName = cat != null ? cat.Name : "-", supName = sup != null ? sup.Name : "-" }
        ).ToListAsync();

        // Get last change date per product from PriceHistory
        var lastChanges = await _ctx.PriceHistories.AsNoTracking()
            .GroupBy(h => h.ProductID)
            .Select(g => new { ProductID = g.Key, LastChanged = g.Max(x => x.ChangedAt) })
            .ToDictionaryAsync(x => x.ProductID, x => x.LastChanged);

        return products.Select(x =>
        {
            var effectivePrice = x.p.UnitPrice;
            if (x.p.HasDiscount && x.p.DiscountPercentage > 0)
                effectivePrice -= effectivePrice * x.p.DiscountPercentage / 100m;
            lastChanges.TryGetValue(x.p.ID, out var lastChanged);
            return new PriceListItem
            {
                ProductId = x.p.ID,
                ProductName = x.p.Name,
                Category = x.catName,
                Supplier = x.supName,
                CurrentPrice = x.p.UnitPrice,
                HasDiscount = x.p.HasDiscount,
                DiscountPct = x.p.DiscountPercentage,
                EffectivePrice = effectivePrice,
                Stock = x.p.StockQuantity,
                LastChanged = lastChanged
            };
        }).OrderBy(x => x.ProductName);
    }

    public async Task<IEnumerable<PriceHistoryItem>> GetHistory(int? productId, DateTime? from, DateTime? to)
    {
        var query = _ctx.PriceHistories.AsNoTracking().AsQueryable();
        if (productId.HasValue) query = query.Where(h => h.ProductID == productId.Value);
        if (from.HasValue) query = query.Where(h => h.ChangedAt >= from.Value);
        if (to.HasValue) query = query.Where(h => h.ChangedAt < to.Value.Date.AddDays(1));

        var list = await (
            from h in query
            join p in _ctx.Products.AsNoTracking() on h.ProductID equals p.ID into pg
            from prod in pg.DefaultIfEmpty()
            orderby h.ChangedAt descending
            select new PriceHistoryItem
            {
                Id = h.ID,
                ProductId = h.ProductID,
                ProductName = prod != null ? prod.Name : "-",
                OldPrice = h.OldPrice,
                NewPrice = h.NewPrice,
                ChangedBy = h.ChangedBy,
                ChangedAt = h.ChangedAt,
                Source = h.Source,
                Note = h.Note
            }
        ).Take(500).ToListAsync();

        return list;
    }

    public async Task LogPriceChange(int productId, decimal oldPrice, decimal newPrice, string source, string note, string user)
    {
        if (oldPrice == newPrice) return;
        _ctx.PriceHistories.Add(new PriceHistory
        {
            ProductID = productId,
            OldPrice = oldPrice,
            NewPrice = newPrice,
            ChangedBy = user,
            ChangedAt = DateTime.Now,
            Source = source,
            Note = note
        });
        await _ctx.SaveChangesAsync();
    }
}
