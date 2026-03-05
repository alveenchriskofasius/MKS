using API.Repository.Interfaces;
using API.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using MitraKaryaSystem.Models;

namespace API.Services
{
    public class CategoryService : ICategoryService
    {
        private readonly ICategoryRepository _categoryRepository;
        private readonly IMemoryCache _cache;
        private const string CacheKey = "CategoryList";

        public CategoryService(ICategoryRepository categoryRepository, IMemoryCache cache)
        {
            _categoryRepository = categoryRepository;
            _cache = cache;
        }
        public async Task<object> DeleteCategory(int id)
        {
            var res = await _categoryRepository.DeleteCategory(id);
            _cache.Remove(CacheKey);
            return res;
        }
        public async Task<CategoryModel> FillFormCategory(int id)
        {
            return await _categoryRepository.FillFormCategory(id);
        }
        public async Task<object> GetCategoryList()
        {
            return await _cache.GetOrCreateAsync(CacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                return await _categoryRepository.GetCategoryList();
            });
        }
        public async Task<object> SaveCategory(CategoryModel category)
        {
            var res = await _categoryRepository.SaveCategory(category);
            _cache.Remove(CacheKey);
            return res;
        }
    }
}
