using API.Repository.Interfaces;
using API.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using MitraKaryaSystem.Models;

namespace API.Services
{
    public class UnitService : IUnitService
    {
        private readonly IUnitRepository _unitRepository;
        private readonly IMemoryCache _cache;
        private const string CacheKey = "UnitList";

        public UnitService(IUnitRepository unitRepository, IMemoryCache cache)
        {
            _unitRepository = unitRepository;
            _cache = cache;
        }
        public async Task<object> DeleteUnit(int id)
        {
            var res = await _unitRepository.DeleteUnit(id);
            _cache.Remove(CacheKey);
            return res;
        }
        public async Task<UnitModel> FillFormUnit(int id)
        {
            return await _unitRepository.FillFormUnit(id);
        }
        public async Task<object> GetUnitList()
        {
            return await _cache.GetOrCreateAsync(CacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                return await _unitRepository.GetUnitList();
            });
        }
        public async Task<object> SaveUnit(UnitModel unit)
        {
            var res = await _unitRepository.SaveUnit(unit);
            _cache.Remove(CacheKey);
            return res;
        }
    }
}
