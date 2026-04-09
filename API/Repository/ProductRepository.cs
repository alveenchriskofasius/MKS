using API.Context.SP;
using API.Context.Table;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;
using MitraKaryaSystem.Models;

namespace API.Repository
{
    public class ProductRepository : BaseRepository, IProductRepository
    {
        private readonly MKSSPContextProcedures _procedures;
        public ProductRepository(MKSTableContext context, MKSSPContextProcedures procedures, IHttpContextAccessor httpContextAccessor)
        : base(context, httpContextAccessor)
        {
            _procedures = procedures;
        }

        public async Task<object> DeleteProduct(int id)
        {
            try
            {
                var p = await _context.Products.FindAsync(id);
                if (p != null) _context.Products.Remove(p);
                await SaveChangesAsync();
                return new { success = true };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }
        public async Task<ProductModel> FillFormProduct(int id)
        {
            Product? product = await _context.Products.FindAsync(id);
            // Use helper to map entity to model (handles null -> new model)
            return ToProductModel(product);
        }

        // Ensure stock quantities come from the authoritative table, not only the SP
        public async Task<object> GetProductList()
        {
            try
            {
                var list = await GetProductListWithFreshStockAsync();
                // Overlay barcode and discount from Products table
                var ids = list.Select(x => x.ID).Distinct().ToList();
                var extraMap = await _context.Products.AsNoTracking()
                    .Where(p => ids.Contains(p.ID))
                    .Select(p => new
                    {
                        p.ID,
                        p.Barcode,
                        p.HasDiscount,
                        p.DiscountPercentage,
                        p.LowStockThreshold,
                        p.PurchasePrice,
                        p.ImageUrl,
                        p.HasVariants
                    })
                    .ToDictionaryAsync(x => x.ID);
                return list.Select(p =>
                {
                    var extra = extraMap.TryGetValue(p.ID, out var e) ? e : null;
                    return new
                    {
                        id = p.ID,
                        name = p.Name,
                        categoryID = p.CategoryID,
                        categoryName = p.CategoryName,
                        unitID = p.UnitID,
                        unitName = p.UnitName,
                        description = p.Description,
                        unitPrice = p.UnitPrice,
                        purchasePrice = extra?.PurchasePrice ?? 0m,
                        stockQuantity = p.StockQuantity,
                        supplierID = p.SupplierID,
                        supplierName = p.SupplierName,
                        barcode = extra?.Barcode,
                        lowStockThreshold = extra?.LowStockThreshold,
                        hasDiscount = extra?.HasDiscount ?? false,
                        discountPercentage = extra?.DiscountPercentage ?? 0m,
                        imageUrl = extra?.ImageUrl,
                        hasVariants = extra?.HasVariants ?? false
                    };
                }).ToList();
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

        public async Task<object> GetProductComboList(string name)
        {
            var spList = await _procedures.uspGetProductComboListAsync(name);
            // Overlay discount info from Products table
            var ids = spList.Select(x => x.ID).Distinct().ToList();
            var discountMap = await _context.Products.AsNoTracking()
                .Where(p => ids.Contains(p.ID))
                .Select(p => new { p.ID, p.HasDiscount, p.DiscountPercentage, p.PurchasePrice })
                .ToDictionaryAsync(x => x.ID);
            return spList.Select(p =>
            {
                var disc = discountMap.TryGetValue(p.ID, out var d) ? d : null;
                return new
                {
                    p.ID,
                    p.Name,
                    p.UnitPrice,
                    purchasePrice = disc?.PurchasePrice ?? 0m,
                    p.SupplierID,
                    p.SupplierName,
                    p.Barcode,
                    p.Unit,
                    p.StockQuantity,
                    hasDiscount = disc?.HasDiscount ?? false,
                    discountPercentage = disc?.DiscountPercentage ?? 0m
                };
            }).ToList();
        }

        public async Task<object> GetLowStockProductList(int threshold = 5)
        {
            try
            {
                var list = await GetProductListWithFreshStockAsync();

                // Build per-product threshold map from Products table
                var thresholdMap = await _context.Products.AsNoTracking()
                    .Select(x => new { x.ID, x.LowStockThreshold })
                    .ToDictionaryAsync(x => x.ID, x => x.LowStockThreshold);

                var low = list.Where(p =>
                {
                    var productThreshold = thresholdMap.TryGetValue(p.ID, out var t) && t.HasValue && t.Value > 0
                        ? t.Value
                        : threshold; // fallback to parameter when product has no threshold set
                    return p.StockQuantity <= productThreshold;
                }).Select(p => new
                {
                    id = p.ID,
                    name = p.Name,
                    stockQuantity = p.StockQuantity,
                    lowStockThreshold = thresholdMap.TryGetValue(p.ID, out var t) && t.HasValue && t.Value > 0
                        ? t.Value
                        : threshold,
                    unitPrice = p.UnitPrice,
                    supplierName = p.SupplierName
                }).ToList();
                return low;
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }
        public async Task<object> SaveProduct(ProductModel productModel)
        {
            try
            {
                if (productModel.Barcode != null && productModel.Barcode.Length > 50)
                    return new { success = false, error = "Barcode maximum is 50 length" };

                int savedId;
                if (productModel.ID == 0)
                {
                    var createdBy = GetCurrentUserName();
                    var now = DateTime.Now;
                    var newProduct = CreateProductFromModel(productModel, createdBy, now);
                    _context.Products.Add(newProduct);
                    await SaveChangesAsync();
                    savedId = newProduct.ID;
                }
                else
                {
                    Product? product = await _context.Products.FindAsync(productModel.ID);
                    if (product == null) return new { success = false, error = "Product not found" };

                    UpdateProductFromModel(product, productModel);
                    product.UpdatedBy = GetCurrentUserName();
                    product.UpdatedAt = DateTime.Now;
                    _context.Products.Update(product);
                    await SaveChangesAsync();
                    savedId = productModel.ID;
                }
                return new { success = true, id = savedId };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

        // Helpers below keep logic DRY and avoid accidental recursive flows

        private async Task<List<GetProductListResult>> GetProductListWithFreshStockAsync()
        {
            // Fetch SP list for names and joins
            var list = await _procedures.GetProductListAsync();

            // Overlay stock from Products table to avoid0 values from SP
            var stockMap = await BuildStockMapAsync();
            OverlayStockQuantities(list, stockMap);

            return list;
        }

        public async Task<object> GetProductsBySupplier(int supplierId)
        {
            try
            {
                var list = await GetProductListWithFreshStockAsync();
                var filtered = list.Where(p => p.SupplierID == supplierId).ToList();
                var ids = filtered.Select(x => x.ID).ToList();
                var extraMap = await _context.Products.AsNoTracking()
                    .Where(p => ids.Contains(p.ID))
                    .Select(p => new { p.ID, p.PurchasePrice, p.HasVariants })
                    .ToDictionaryAsync(x => x.ID);
                var variantsByProduct = await _context.ProductVariants.AsNoTracking()
                    .Where(v => ids.Contains(v.ProductID))
                    .GroupBy(v => v.ProductID)
                    .ToDictionaryAsync(
                        g => g.Key,
                        g => g.Select(v => new { id = v.ID, name = v.Name, stockQuantity = v.StockQuantity }).ToList());
                return filtered.Select(p =>
                {
                    var extra = extraMap.TryGetValue(p.ID, out var e) ? e : null;
                    variantsByProduct.TryGetValue(p.ID, out var variants);
                    return new
                    {
                        id = p.ID,
                        name = p.Name,
                        purchasePrice = extra?.PurchasePrice ?? 0m,
                        stockQuantity = p.StockQuantity,
                        unitName = p.UnitName,
                        hasVariants = extra?.HasVariants ?? false,
                        variants = variants ?? new List<object>() as object
                    };
                }).ToList();
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

        private async Task<Dictionary<int, int>> BuildStockMapAsync()
        {
            return await _context.Products.AsNoTracking()
                .Select(x => new { x.ID, x.StockQuantity })
                .ToDictionaryAsync(x => x.ID, x => x.StockQuantity);
        }

        private static void OverlayStockQuantities(IEnumerable<GetProductListResult> list, IReadOnlyDictionary<int, int> stockMap)
        {
            foreach (var r in list)
            {
                if (stockMap.TryGetValue(r.ID, out var qty)) r.StockQuantity = qty;
            }
        }

        private static ProductModel ToProductModel(Product? product)
        {
            if (product == null) return new ProductModel();

            return new ProductModel
            {
                ID = product.ID,
                Name = product.Name,
                CategoryID = product.CategoryID,
                UnitID = product.UnitID,
                Description = product.Description,
                UnitPrice = product.UnitPrice,
                PurchasePrice = product.PurchasePrice,
                StockQuantity = product.StockQuantity,
                SupplierID = product.SupplierID,
                Barcode = product.Barcode,
                LowStockThreshold = product.LowStockThreshold,
                HasDiscount = product.HasDiscount,
                DiscountPercentage = product.DiscountPercentage,
                ImageUrl = product.ImageUrl,
                HasVariants = product.HasVariants
            };
        }

        private static Product CreateProductFromModel(ProductModel model, string createdBy, DateTime createdAt)
        {
            return new Product
            {
                Name = model.Name,
                CategoryID = model.CategoryID,
                UnitID = model.UnitID,
                Description = model.Description,
                UnitPrice = model.UnitPrice,
                PurchasePrice = model.PurchasePrice,
                StockQuantity = model.StockQuantity,
                LowStockThreshold = model.LowStockThreshold,
                SupplierID = model.SupplierID,
                CreatedBy = createdBy,
                CreatedAt = createdAt,
                Barcode = model.Barcode,
                HasDiscount = model.HasDiscount,
                DiscountPercentage = model.DiscountPercentage,
                ImageUrl = model.ImageUrl,
                HasVariants = model.HasVariants
            };
        }

        private static void UpdateProductFromModel(Product entity, ProductModel model)
        {
            entity.Name = model.Name;
            entity.CategoryID = model.CategoryID;
            entity.UnitID = model.UnitID;
            entity.Description = model.Description;
            entity.UnitPrice = model.UnitPrice;
            entity.PurchasePrice = model.PurchasePrice;
            // StockQuantity is managed by inventory operations (Stock In / Stock Out), not product editing
            entity.LowStockThreshold = model.LowStockThreshold;
            entity.SupplierID = model.SupplierID;
            entity.Barcode = model.Barcode;
            entity.HasDiscount = model.HasDiscount;
            entity.DiscountPercentage = model.DiscountPercentage;
            entity.ImageUrl = model.ImageUrl;
            entity.HasVariants = model.HasVariants;
        }

        public async Task<object> UpdateProductImage(int id, string imageUrl)
        {
            try
            {
                var product = await _context.Products.FindAsync(id);
                if (product == null)
                    return new { success = false, error = "Product not found" };

                product.ImageUrl = imageUrl;
                product.UpdatedBy = GetCurrentUserName();
                product.UpdatedAt = DateTime.Now;
                _context.Products.Update(product);
                await SaveChangesAsync();
                return new { success = true, imageUrl };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

        public async Task<List<ProductVariantModel>> GetVariants(int productId)
        {
            return await _context.ProductVariants
                .Where(v => v.ProductID == productId)
                .OrderBy(v => v.ID)
                .Select(v => new ProductVariantModel { ID = v.ID, ProductID = v.ProductID, Name = v.Name, StockQuantity = v.StockQuantity })
                .ToListAsync();
        }

        public async Task<object> SaveVariant(ProductVariantModel model)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(model.Name))
                    return new { success = false, error = "Variant name is required" };

                if (model.ID == 0)
                {
                    _context.ProductVariants.Add(new ProductVariant
                    {
                        ProductID = model.ProductID,
                        Name = model.Name.Trim(),
                        StockQuantity = model.StockQuantity
                    });
                }
                else
                {
                    var v = await _context.ProductVariants.FindAsync(model.ID);
                    if (v == null) return new { success = false, error = "Variant not found" };
                    v.Name = model.Name.Trim();
                    v.StockQuantity = model.StockQuantity;
                }
                await SaveChangesAsync();

                // Sync product.StockQuantity = sum of all its variants
                await SyncProductStockFromVariantsAsync(model.ProductID);

                return new { success = true };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

        public async Task<object> DeleteVariant(int id)
        {
            try
            {
                var v = await _context.ProductVariants.FindAsync(id);
                if (v != null)
                {
                    int productId = v.ProductID;
                    _context.ProductVariants.Remove(v);
                    await SaveChangesAsync();
                    await SyncProductStockFromVariantsAsync(productId);
                }
                else
                {
                    await SaveChangesAsync();
                }
                return new { success = true };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

        private async Task SyncProductStockFromVariantsAsync(int productId)
        {
            var product = await _context.Products.FindAsync(productId);
            if (product == null) return;
            product.StockQuantity = await _context.ProductVariants
                .Where(v => v.ProductID == productId)
                .SumAsync(v => v.StockQuantity);
            _context.Products.Update(product);
            await SaveChangesAsync();
        }
    }
}
