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
                return list;
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

        public async Task<object> GetProductComboList(string name) => await _procedures.uspGetProductComboListAsync(name);

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

                if (productModel.ID == 0)
                {
                    var createdBy = GetCurrentUserName();
                    var now = DateTime.Now;

                    _context.Products.Add(CreateProductFromModel(productModel, createdBy, now));
                }
                else
                {
                    Product? product = await _context.Products.FindAsync(productModel.ID);
                    if (product == null) return new { success = false, error = "Product not found" };

                    UpdateProductFromModel(product, productModel);
                    product.UpdatedBy = GetCurrentUserName();
                    product.UpdatedAt = DateTime.Now;
                    _context.Products.Update(product);
                }
                await SaveChangesAsync();
                return new { success = true };
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
                StockQuantity = product.StockQuantity,
                SupplierID = product.SupplierID,
                Barcode = product.Barcode,
                LowStockThreshold = product.LowStockThreshold
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
                StockQuantity = model.StockQuantity,
                LowStockThreshold = model.LowStockThreshold,
                SupplierID = model.SupplierID,
                CreatedBy = createdBy,
                CreatedAt = createdAt,
                Barcode = model.Barcode
            };
        }

        private static void UpdateProductFromModel(Product entity, ProductModel model)
        {
            entity.Name = model.Name;
            entity.CategoryID = model.CategoryID;
            entity.UnitID = model.UnitID;
            entity.Description = model.Description;
            entity.UnitPrice = model.UnitPrice;
            entity.StockQuantity = model.StockQuantity;
            entity.LowStockThreshold = model.LowStockThreshold;
            entity.SupplierID = model.SupplierID;
            entity.Barcode = model.Barcode;
        }
    }
}
