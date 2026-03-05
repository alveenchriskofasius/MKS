using API.Repository.Interfaces;
using API.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using MitraKaryaSystem.Models;

namespace API.Services
{
    public class SupplierService : ISupplierService
    {
        private readonly ISupplierRepository _repository;
        private readonly IMemoryCache _cache;
        private const string CacheKey = "SupplierList";

        public SupplierService(ISupplierRepository repository, IMemoryCache cache)
        {
            _repository = repository;
            _cache = cache;
        }
        public async Task DeleteSupplier(int id)
        {
            await _repository.DeleteSupplier(id);
            _cache.Remove(CacheKey);
        }

        public async Task<SupplierModel> FillFormSupplier(int id)
        {
            return await _repository.FillFormSupplier(id);
        }

        public async Task<object> GetSupplierList()
        {
            return await _cache.GetOrCreateAsync(CacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                return await _repository.GetSupplierList();
            });
        }

        public async Task SaveSupplier(SupplierModel category)
        {
            await _repository.SaveSupplier(category);
            _cache.Remove(CacheKey);
        }
    }
}
