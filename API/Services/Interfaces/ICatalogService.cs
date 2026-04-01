using API.Models;

namespace API.Services.Interfaces
{
    public interface ICatalogService
    {
        Task<List<CatalogProductItem>> GetProductList(int? categoryId, string? search);
        Task<CatalogProductDetail?> GetProductDetail(int id);
        Task<List<CatalogCategoryItem>> GetCategoryList();
        Task<List<CatalogProductItem>> SearchProducts(string query, int take = 10);
        Task<CatalogProductItem?> GetProductById(int id);
        Task<List<CatalogProductItem>> GetPopularProducts(int take = 8);
        Task<List<CatalogProductItem>> GetProductsPaged(int skip, int take);
    }
}
