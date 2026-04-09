using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository
{
    public class CatalogRepository : BaseRepository, ICatalogRepository
    {
        public CatalogRepository(MKSTableContext context, IHttpContextAccessor http)
            : base(context, http)
        {
        }

        private async Task<Dictionary<int, (string Name, DateTime EndDate)>> GetActivePromoMap()
        {
            var now = DateTime.Now;
            var activePromos = await _context.Promos
                .AsNoTracking()
                .Where(p => p.IsActive && p.StartDate <= now && p.EndDate >= now)
                .ToListAsync();

            var products = await _context.Products.AsNoTracking()
                .Select(p => new { p.ID, p.CategoryID })
                .ToListAsync();

            var map = new Dictionary<int, (string Name, DateTime EndDate)>();
            foreach (var promo in activePromos)
            {
                IEnumerable<int> targetIds;
                if (promo.ApplyTo == "Product" && promo.ProductID.HasValue)
                    targetIds = new[] { promo.ProductID.Value };
                else if (promo.ApplyTo == "Category" && promo.CategoryID.HasValue)
                    targetIds = products.Where(p => p.CategoryID == promo.CategoryID.Value).Select(p => p.ID);
                else
                    targetIds = products.Select(p => p.ID);

                foreach (var pid in targetIds)
                {
                    if (!map.ContainsKey(pid))
                        map[pid] = (promo.Name, promo.EndDate);
                }
            }
            return map;
        }

        public async Task<List<CatalogProductItem>> GetProductList(int? categoryId, string? search)
        {
            var query = _context.Products.AsNoTracking().Where(p => p.StockQuantity > 0);

            if (categoryId.HasValue)
                query = query.Where(p => p.CategoryID == categoryId.Value);

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(p => p.Name.Contains(search) || (p.Description != null && p.Description.Contains(search)));

            var items = await query
                .Join(_context.Categories.AsNoTracking(),
                    p => p.CategoryID, c => c.ID,
                    (p, c) => new { Product = p, CategoryName = c.Name })
                .Join(_context.Units.AsNoTracking(),
                    pc => pc.Product.UnitID, u => u.ID,
                    (pc, u) => new CatalogProductItem
                    {
                        ID = pc.Product.ID,
                        Name = pc.Product.Name,
                        Description = pc.Product.Description,
                        CategoryName = pc.CategoryName,
                        UnitName = u.Name,
                        UnitPrice = pc.Product.UnitPrice,
                        StockQuantity = pc.Product.StockQuantity,
                        HasDiscount = pc.Product.HasDiscount,
                        DiscountPercentage = pc.Product.DiscountPercentage,
                        ImageUrl = pc.Product.ImageUrl
                    })
                .ToListAsync();

            var promoMap = await GetActivePromoMap();
            foreach (var item in items)
            {
                if (promoMap.TryGetValue(item.ID, out var promo))
                {
                    item.PromoName = promo.Name;
                    item.PromoEndDate = promo.EndDate;
                }
            }
            return items;
        }

        public async Task<CatalogProductDetail?> GetProductDetail(int id)
        {
            var detail = await _context.Products
                .AsNoTracking()
                .Where(p => p.ID == id)
                .Join(_context.Categories.AsNoTracking(),
                    p => p.CategoryID, c => c.ID,
                    (p, c) => new { Product = p, CategoryName = c.Name })
                .Join(_context.Units.AsNoTracking(),
                    pc => pc.Product.UnitID, u => u.ID,
                    (pc, u) => new CatalogProductDetail
                    {
                        ID = pc.Product.ID,
                        Name = pc.Product.Name,
                        Description = pc.Product.Description,
                        CategoryName = pc.CategoryName,
                        UnitName = u.Name,
                        UnitPrice = pc.Product.UnitPrice,
                        StockQuantity = pc.Product.StockQuantity,
                        HasDiscount = pc.Product.HasDiscount,
                        DiscountPercentage = pc.Product.DiscountPercentage,
                        ImageUrl = pc.Product.ImageUrl,
                        HasVariants = pc.Product.HasVariants
                    })
                .FirstOrDefaultAsync();

            if (detail != null)
            {
                var promoMap = await GetActivePromoMap();
                if (promoMap.TryGetValue(detail.ID, out var promo))
                {
                    detail.PromoName = promo.Name;
                    detail.PromoEndDate = promo.EndDate;
                }

                if (detail.HasVariants)
                {
                    detail.Variants = await _context.ProductVariants
                        .AsNoTracking()
                        .Where(v => v.ProductID == detail.ID)
                        .OrderBy(v => v.ID)
                        .Select(v => new CatalogVariantItem
                        {
                            ID = v.ID,
                            Name = v.Name,
                            StockQuantity = v.StockQuantity
                        })
                        .ToListAsync();
                }
            }
            return detail;
        }

        public async Task<List<CatalogCategoryItem>> GetCategoryList()
        {
            return await _context.Categories
                .AsNoTracking()
                .Select(c => new CatalogCategoryItem { ID = c.ID, Name = c.Name })
                .ToListAsync();
        }

        public async Task<List<CatalogProductItem>> SearchProducts(string query, int take = 10)
        {
            var items = await _context.Products
                .AsNoTracking()
                .Where(p => p.Name.Contains(query) && p.StockQuantity > 0)
                .Take(take)
                .Join(_context.Categories.AsNoTracking(),
                    p => p.CategoryID, c => c.ID,
                    (p, c) => new { Product = p, CategoryName = c.Name })
                .Join(_context.Units.AsNoTracking(),
                    pc => pc.Product.UnitID, u => u.ID,
                    (pc, u) => new CatalogProductItem
                    {
                        ID = pc.Product.ID,
                        Name = pc.Product.Name,
                        Description = pc.Product.Description,
                        CategoryName = pc.CategoryName,
                        UnitName = u.Name,
                        UnitPrice = pc.Product.UnitPrice,
                        StockQuantity = pc.Product.StockQuantity,
                        HasDiscount = pc.Product.HasDiscount,
                        DiscountPercentage = pc.Product.DiscountPercentage,
                        ImageUrl = pc.Product.ImageUrl
                    })
                .ToListAsync();

            var promoMap = await GetActivePromoMap();
            foreach (var item in items)
            {
                if (promoMap.TryGetValue(item.ID, out var promo))
                {
                    item.PromoName = promo.Name;
                    item.PromoEndDate = promo.EndDate;
                }
            }
            return items;
        }

        public async Task<CatalogProductItem?> GetProductById(int id)
        {
            var item = await _context.Products
                .AsNoTracking()
                .Where(p => p.ID == id)
                .Join(_context.Categories.AsNoTracking(),
                    p => p.CategoryID, c => c.ID,
                    (p, c) => new { Product = p, CategoryName = c.Name })
                .Join(_context.Units.AsNoTracking(),
                    pc => pc.Product.UnitID, u => u.ID,
                    (pc, u) => new CatalogProductItem
                    {
                        ID = pc.Product.ID,
                        Name = pc.Product.Name,
                        Description = pc.Product.Description,
                        CategoryName = pc.CategoryName,
                        UnitName = u.Name,
                        UnitPrice = pc.Product.UnitPrice,
                        StockQuantity = pc.Product.StockQuantity,
                        HasDiscount = pc.Product.HasDiscount,
                        DiscountPercentage = pc.Product.DiscountPercentage,
                        ImageUrl = pc.Product.ImageUrl,
                        HasVariants = pc.Product.HasVariants
                    })
                .FirstOrDefaultAsync();

            if (item != null)
            {
                var promoMap = await GetActivePromoMap();
                if (promoMap.TryGetValue(item.ID, out var promo))
                {
                    item.PromoName = promo.Name;
                    item.PromoEndDate = promo.EndDate;
                }
            }
            return item;
        }

        public async Task<CatalogVariantItem?> GetVariantById(int variantId)
        {
            return await _context.ProductVariants
                .AsNoTracking()
                .Where(v => v.ID == variantId)
                .Select(v => new CatalogVariantItem
                {
                    ID = v.ID,
                    Name = v.Name,
                    StockQuantity = v.StockQuantity
                })
                .FirstOrDefaultAsync();
        }

        public async Task<List<CatalogProductItem>> GetPopularProducts(int take = 8)
        {
            // Popular = most sold products based on SalesOrderItem frequency (paid orders only)
            var popularProductIds = await _context.SalesOrderItems
                .AsNoTracking()
                .Join(_context.Trades.AsNoTracking().Where(t => t.StatusID == 2 || t.StatusID == 8),
                    si => si.TradeID, t => t.ID,
                    (si, t) => si)
                .Where(si => si.ProductID != null)
                .GroupBy(si => si.ProductID)
                .Select(g => new { ProductID = g.Key, TotalQty = g.Sum(si => si.Quantity) })
                .OrderByDescending(x => x.TotalQty)
                .Take(take)
                .Select(x => x.ProductID)
                .ToListAsync();

            if (popularProductIds.Count == 0)
            {
                // Fallback: return newest products if no sales data
                return await GetProductsPaged(0, take);
            }

            var items = await _context.Products
                .AsNoTracking()
                .Where(p => popularProductIds.Contains(p.ID) && p.StockQuantity > 0)
                .Join(_context.Categories.AsNoTracking(),
                    p => p.CategoryID, c => c.ID,
                    (p, c) => new { Product = p, CategoryName = c.Name })
                .Join(_context.Units.AsNoTracking(),
                    pc => pc.Product.UnitID, u => u.ID,
                    (pc, u) => new CatalogProductItem
                    {
                        ID = pc.Product.ID,
                        Name = pc.Product.Name,
                        Description = pc.Product.Description,
                        CategoryName = pc.CategoryName,
                        UnitName = u.Name,
                        UnitPrice = pc.Product.UnitPrice,
                        StockQuantity = pc.Product.StockQuantity,
                        HasDiscount = pc.Product.HasDiscount,
                        DiscountPercentage = pc.Product.DiscountPercentage,
                        ImageUrl = pc.Product.ImageUrl
                    })
                .ToListAsync();

            var promoMap = await GetActivePromoMap();
            foreach (var item in items)
            {
                if (promoMap.TryGetValue(item.ID, out var promo))
                {
                    item.PromoName = promo.Name;
                    item.PromoEndDate = promo.EndDate;
                }
            }

            // Preserve popularity order
            var orderedIds = popularProductIds.ToList();
            return items.OrderBy(i => orderedIds.IndexOf(i.ID)).ToList();
        }

        public async Task<List<CatalogProductItem>> GetProductsPaged(int skip, int take)
        {
            var items = await _context.Products
                .AsNoTracking()
                .Where(p => p.StockQuantity > 0)
                .OrderByDescending(p => p.ID)
                .Skip(skip)
                .Take(take)
                .Join(_context.Categories.AsNoTracking(),
                    p => p.CategoryID, c => c.ID,
                    (p, c) => new { Product = p, CategoryName = c.Name })
                .Join(_context.Units.AsNoTracking(),
                    pc => pc.Product.UnitID, u => u.ID,
                    (pc, u) => new CatalogProductItem
                    {
                        ID = pc.Product.ID,
                        Name = pc.Product.Name,
                        Description = pc.Product.Description,
                        CategoryName = pc.CategoryName,
                        UnitName = u.Name,
                        UnitPrice = pc.Product.UnitPrice,
                        StockQuantity = pc.Product.StockQuantity,
                        HasDiscount = pc.Product.HasDiscount,
                        DiscountPercentage = pc.Product.DiscountPercentage,
                        ImageUrl = pc.Product.ImageUrl
                    })
                .ToListAsync();

            var promoMap = await GetActivePromoMap();
            foreach (var item in items)
            {
                if (promoMap.TryGetValue(item.ID, out var promo))
                {
                    item.PromoName = promo.Name;
                    item.PromoEndDate = promo.EndDate;
                }
            }
            return items;
        }
    }
}
