using MitraKaryaSystem.Models;

namespace API.Services.Interfaces
{
    public interface IProductService
    {
        Task<object> GetProductList();
        Task<object> SaveProduct(ProductModel product);
        Task<object> DeleteProduct(int id);
        Task<ProductModel> FillFormProduct(int id);
        Task<object> GetProductComboList(string name);
        Task<object> GetLowStockProductList(int threshold = 5);
        Task<object> UpdateProductImage(int id, string imageUrl);
        Task<object> GetProductsBySupplier(int supplierId);
        Task<List<ProductVariantModel>> GetVariants(int productId);
        Task<object> SaveVariant(ProductVariantModel model);
        Task<object> DeleteVariant(int id);
    }
}
