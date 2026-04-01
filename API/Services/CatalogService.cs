using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services
{
    public class CatalogService : ICatalogService
    {
        private readonly ICatalogRepository _catalogRepository;

        public CatalogService(ICatalogRepository catalogRepository)
        {
            _catalogRepository = catalogRepository;
        }

        public async Task<List<CatalogProductItem>> GetProductList(int? categoryId, string? search)
        {
            return await _catalogRepository.GetProductList(categoryId, search);
        }

        public async Task<CatalogProductDetail?> GetProductDetail(int id)
        {
            return await _catalogRepository.GetProductDetail(id);
        }

        public async Task<List<CatalogCategoryItem>> GetCategoryList()
        {
            return await _catalogRepository.GetCategoryList();
        }

        public async Task<List<CatalogProductItem>> SearchProducts(string query, int take = 10)
        {
            return await _catalogRepository.SearchProducts(query, take);
        }

        public async Task<CatalogProductItem?> GetProductById(int id)
        {
            return await _catalogRepository.GetProductById(id);
        }

        public async Task<List<CatalogProductItem>> GetPopularProducts(int take = 8)
        {
            return await _catalogRepository.GetPopularProducts(take);
        }

        public async Task<List<CatalogProductItem>> GetProductsPaged(int skip, int take)
        {
            return await _catalogRepository.GetProductsPaged(skip, take);
        }
    }
}
