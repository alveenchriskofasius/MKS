using API.Context.Table;
using API.Models;
using API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Services;

public class PromoService : IPromoService
{
    private readonly MKSTableContext _ctx;
    private readonly IHttpContextAccessor _http;
    private readonly IPriceHistoryService _priceHistory;

    public PromoService(MKSTableContext ctx, IHttpContextAccessor http, IPriceHistoryService priceHistory)
    {
        _ctx = ctx;
        _http = http;
        _priceHistory = priceHistory;
    }

    private string User => _http.HttpContext?.User?.Identity?.Name ?? "system";

    public async Task<IEnumerable<PromoListItem>> GetList()
    {
        var now = DateTime.Now;
        var promos = await _ctx.Promos.AsNoTracking().OrderByDescending(p => p.ID).ToListAsync();
        var categories = await _ctx.Categories.AsNoTracking().ToDictionaryAsync(c => c.ID, c => c.Name);
        var products = await _ctx.Products.AsNoTracking().ToDictionaryAsync(p => p.ID, p => p.Name);

        return promos.Select(p =>
        {
            var targetName = p.ApplyTo switch
            {
                "Category" => p.CategoryID.HasValue && categories.TryGetValue(p.CategoryID.Value, out var cn) ? cn : "-",
                "Product" => p.ProductID.HasValue && products.TryGetValue(p.ProductID.Value, out var pn) ? pn : "-",
                _ => "All Products"
            };
            var status = !p.IsActive ? "Inactive"
                       : now < p.StartDate ? "Scheduled"
                       : now > p.EndDate ? "Expired"
                       : "Active";
            var affected = p.ApplyTo switch
            {
                "Product" => p.ProductID.HasValue ? 1 : 0,
                "Category" => p.CategoryID.HasValue ? products.Count(x => true) : 0, // approximate
                _ => products.Count
            };
            return new PromoListItem
            {
                Id = p.ID,
                Name = p.Name,
                DiscountPct = p.DiscountPct,
                StartDate = p.StartDate,
                EndDate = p.EndDate,
                ApplyTo = p.ApplyTo,
                TargetName = targetName,
                IsActive = p.IsActive,
                Status = status,
                AffectedProducts = affected,
                CreatedBy = p.CreatedBy
            };
        });
    }

    public async Task<PromoModel> Get(int id)
    {
        var p = await _ctx.Promos.AsNoTracking().FirstOrDefaultAsync(x => x.ID == id);
        if (p == null) return null;
        return new PromoModel
        {
            Id = p.ID,
            Name = p.Name,
            DiscountPct = p.DiscountPct,
            StartDate = p.StartDate,
            EndDate = p.EndDate,
            ApplyTo = p.ApplyTo,
            CategoryId = p.CategoryID,
            ProductId = p.ProductID,
            IsActive = p.IsActive
        };
    }

    public async Task<object> Save(PromoModel model)
    {
        if (string.IsNullOrWhiteSpace(model.Name))
            return new { success = false, result = "Name is required" };
        if (model.DiscountPct <= 0 || model.DiscountPct > 100)
            return new { success = false, result = "Discount must be between 0 and 100" };
        if (model.EndDate <= model.StartDate)
            return new { success = false, result = "End date must be after start date" };

        if (model.Id == 0)
        {
            var entity = new Promo
            {
                Name = model.Name,
                DiscountPct = model.DiscountPct,
                StartDate = model.StartDate,
                EndDate = model.EndDate,
                ApplyTo = model.ApplyTo ?? "All",
                CategoryID = model.CategoryId,
                ProductID = model.ProductId,
                IsActive = model.IsActive,
                CreatedBy = User,
                CreatedAt = DateTime.Now,
                UpdatedBy = User,
                UpdatedAt = DateTime.Now
            };
            _ctx.Promos.Add(entity);
            await _ctx.SaveChangesAsync();
            return new { success = true, id = entity.ID };
        }
        else
        {
            var entity = await _ctx.Promos.FirstOrDefaultAsync(x => x.ID == model.Id);
            if (entity == null) return new { success = false, result = "Not found" };

            // Bug 1 fix: If promo settings changed (dates, target, discount%), remove
            // discounts from previously affected products so they reset.
            bool datesChanged = entity.StartDate != model.StartDate || entity.EndDate != model.EndDate;
            bool targetChanged = entity.ApplyTo != (model.ApplyTo ?? "All")
                              || entity.CategoryID != model.CategoryId
                              || entity.ProductID != model.ProductId;
            bool discountChanged = entity.DiscountPct != model.DiscountPct;

            if (datesChanged || targetChanged || discountChanged)
            {
                var previousProducts = await GetAffectedProducts(entity);
                foreach (var p in previousProducts)
                {
                    if (p.DiscountPercentage == entity.DiscountPct)
                    {
                        p.HasDiscount = false;
                        p.DiscountPercentage = 0;
                    }
                }
            }

            entity.Name = model.Name;
            entity.DiscountPct = model.DiscountPct;
            entity.StartDate = model.StartDate;
            entity.EndDate = model.EndDate;
            entity.ApplyTo = model.ApplyTo ?? "All";
            entity.CategoryID = model.CategoryId;
            entity.ProductID = model.ProductId;
            entity.IsActive = model.IsActive;
            entity.UpdatedBy = User;
            entity.UpdatedAt = DateTime.Now;
            await _ctx.SaveChangesAsync();
            return new { success = true, id = entity.ID };
        }
    }

    public async Task<object> Delete(int id)
    {
        var entity = await _ctx.Promos.FirstOrDefaultAsync(x => x.ID == id);
        if (entity == null) return new { success = false, result = "Not found" };
        _ctx.Promos.Remove(entity);
        await _ctx.SaveChangesAsync();
        return new { success = true };
    }

    public async Task<object> ApplyPromo(int id)
    {
        var promo = await _ctx.Promos.FirstOrDefaultAsync(x => x.ID == id);
        if (promo == null) return new { success = false, result = "Not found" };

        var products = await GetAffectedProducts(promo);
        int count = 0;
        foreach (var p in products)
        {
            var oldPrice = p.UnitPrice;
            p.HasDiscount = true;
            p.DiscountPercentage = promo.DiscountPct;
            _ctx.Products.Update(p);
            await _priceHistory.LogPriceChange(p.ID, oldPrice, oldPrice, "Promo", $"Promo '{promo.Name}' applied ({promo.DiscountPct}%)", User);
            count++;
        }
        await _ctx.SaveChangesAsync();
        return new { success = true, result = $"Applied to {count} product(s)" };
    }

    public async Task<object> DeactivatePromo(int id)
    {
        var promo = await _ctx.Promos.FirstOrDefaultAsync(x => x.ID == id);
        if (promo == null) return new { success = false, result = "Not found" };
        promo.IsActive = false;
        promo.UpdatedBy = User;
        promo.UpdatedAt = DateTime.Now;

        // Remove discounts from affected products
        var products = await GetAffectedProducts(promo);
        foreach (var p in products)
        {
            if (p.DiscountPercentage == promo.DiscountPct)
            {
                p.HasDiscount = false;
                p.DiscountPercentage = 0;
                _ctx.Products.Update(p);
            }
        }
        await _ctx.SaveChangesAsync();
        return new { success = true };
    }

    private async Task<List<Product>> GetAffectedProducts(Promo promo)
    {
        if (promo.ApplyTo == "Category")
        {
            if (!promo.CategoryID.HasValue) return [];
            return await _ctx.Products.Where(p => p.CategoryID == promo.CategoryID.Value).ToListAsync();
        }
        if (promo.ApplyTo == "Product")
        {
            if (!promo.ProductID.HasValue) return [];
            return await _ctx.Products.Where(p => p.ID == promo.ProductID.Value).ToListAsync();
        }
        // "All" — return all products
        return await _ctx.Products.ToListAsync();
    }
}
