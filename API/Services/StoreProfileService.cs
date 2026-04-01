using API.Context.Table;
using API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Services
{
    public class StoreProfileService : IStoreProfileService
    {
        private readonly MKSTableContext _ctx;
        private const string Entity = "StoreProfile";

        // Key mapping – each setting is a Lookup row with Entity = "StoreProfile"
        private static readonly Dictionary<string, short> KeyMap = new()
        {
            ["storeName"] = 1,
            ["address"] = 2,
            ["phone"] = 3,
            ["email"] = 4,
            ["receiptFooter"] = 5,
            ["receiptHeader"] = 6
        };

        public StoreProfileService(MKSTableContext ctx) => _ctx = ctx;

        public async Task<object> GetProfile()
        {
            var rows = await _ctx.Lookups
                .AsNoTracking()
                .Where(l => l.Entity == Entity)
                .ToListAsync();

            var result = new Dictionary<string, string>();
            foreach (var kv in KeyMap)
            {
                var row = rows.FirstOrDefault(r => r.Key == kv.Value);
                result[kv.Key] = row?.Name ?? "";
            }
            return result;
        }

        public async Task<object> SaveProfile(Dictionary<string, string> settings)
        {
            try
            {
                var existing = await _ctx.Lookups
                    .Where(l => l.Entity == Entity)
                    .ToListAsync();

                foreach (var kv in KeyMap)
                {
                    var value = settings.TryGetValue(kv.Key, out var v) ? v ?? "" : "";
                    var row = existing.FirstOrDefault(r => r.Key == kv.Value);
                    if (row != null)
                    {
                        row.Name = value;
                        _ctx.Lookups.Update(row);
                    }
                    else
                    {
                        _ctx.Lookups.Add(new Lookup
                        {
                            Entity = Entity,
                            Key = kv.Value,
                            Name = value
                        });
                    }
                }
                await _ctx.SaveChangesAsync();
                return new { success = true };
            }
            catch (Exception e)
            {
                return new { success = false, error = e.Message };
            }
        }
    }
}
