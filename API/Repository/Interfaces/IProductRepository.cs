using MitraKaryaSystem.Models;

namespace API.Repository.Interfaces
{
    public interface IProductRepository
    {
        Task<object> GetProductList();
        Task<object> SaveProduct(ProductModel product);
        Task<object> DeleteProduct(int id);
        Task<ProductModel> FillFormProduct(int id);
        Task<object> GetProductComboList(string name);
        Task<object> GetLowStockProductList(int threshold = 5);
    }
}
