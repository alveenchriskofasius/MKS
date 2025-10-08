using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class StockCountRepository : IStockCountRepository
{
    private readonly MKSTableContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;
    public StockCountRepository(MKSTableContext ctx, IHttpContextAccessor accessor)
    { _context = ctx; _httpContextAccessor = accessor; }

    public async Task<StockCountModel> FillForm(int id)
    {
        if (id == 0) return new StockCountModel();
        var sc = await _context.Set<StockCount>().Include(x => x.StockCountItems).FirstOrDefaultAsync(x => x.ID == id);
        if (sc == null) return new StockCountModel();
        return new StockCountModel
        {
            ID = sc.ID,
            Date = sc.Date,
            No = sc.No,
            Note = sc.Note,
            AutoAdjust = sc.AutoAdjust,
            Items = sc.StockCountItems.Select(i => new StockCountDetailModel
            {
                ID = i.ID,
                ProductID = i.ProductID,
                ProductName = _context.Products.Where(p => p.ID == i.ProductID).Select(p => p.Name).FirstOrDefault(),
                SystemQty = i.SystemQty,
                PhysicalQty = i.PhysicalQty,
                DiffQty = i.DiffQty,
                UnitPrice = i.UnitPrice
            }).ToList()
        };
    }

    public async Task<object> GetSearchList()
    {
        var list = await _context.Set<StockCount>().OrderByDescending(x => x.ID).Select(x => new { id = x.ID, no = x.No, date = x.Date.ToString("yyyy-MM-dd"), note = x.Note, items = x.StockCountItems.Count, diffValue = x.StockCountItems.Sum(i => (i.PhysicalQty - i.SystemQty) * i.UnitPrice) }).ToListAsync();
        return list;
    }

    public async Task<object> GetDetailList(int id)
    {
        var items = await _context.StockCountItems.Where(x => x.StockCountID == id).Select(i => new
        {
            id = i.ID,
            productID = i.ProductID,
            product = _context.Products.Where(p => p.ID == i.ProductID).Select(p => p.Name).FirstOrDefault(),
            systemQty = i.SystemQty,
            physicalQty = i.PhysicalQty,
            diffQty = i.DiffQty,
            unitPrice = i.UnitPrice,
            diffValue = i.DiffQty * i.UnitPrice
        }).ToListAsync();
        return items;
    }

    private async Task<string> GenerateNo(DateTime date)
    {
        string prefix = "SC" + date.ToString("yyMMdd");
        int seq = await _context.Set<StockCount>().CountAsync(x => x.Date == date.Date) + 1;
        return prefix + seq.ToString("D3");
    }

    public async Task<object> Save(StockCountModel model)
    {
        try
        {
            model.Items ??= new();
            StockCount entity;
            var user = _httpContextAccessor.HttpContext?.User?.Identity?.Name;
            if (model.ID == 0)
            {
                entity = new StockCount
                {
                    Date = model.Date.Date,
                    No = await GenerateNo(model.Date.Date),
                    Note = model.Note,
                    AutoAdjust = model.AutoAdjust,
                    CreatedAt = DateTime.Now,
                    CreatedBy = user
                };
                await _context.AddAsync(entity);
                await _context.SaveChangesAsync();
            }
            else
            {
                entity = await _context.StockCounts.Include(x => x.StockCountItems).FirstOrDefaultAsync(x => x.ID == model.ID) ?? throw new Exception("Stock Count not found");
                entity.Date = model.Date.Date;
                entity.Note = model.Note;
                entity.AutoAdjust = model.AutoAdjust;
                entity.UpdatedAt = DateTime.Now;
                entity.UpdatedBy = user;
                await _context.SaveChangesAsync();
            }

            // sync detail
            var existingIds = model.Items.Where(i => i.ID > 0).Select(i => i.ID).ToHashSet();
            var toRemove = _context.StockCountItems.Where(i => i.StockCountID == entity.ID && !existingIds.Contains(i.ID));
            _context.StockCountItems.RemoveRange(toRemove);
            await _context.SaveChangesAsync();

            foreach (var d in model.Items)
            {
                if (d.ID == 0)
                {
                    var item = new StockCountItem
                    {
                        StockCountID = entity.ID,
                        ProductID = d.ProductID,
                        SystemQty = d.SystemQty,
                        PhysicalQty = d.PhysicalQty,
                        DiffQty = d.PhysicalQty - d.SystemQty,
                        UnitPrice = d.UnitPrice
                    };
                    await _context.StockCountItems.AddAsync(item);
                }
                else
                {
                    var item = await _context.StockCountItems.FindAsync(d.ID);
                    if (item == null) continue;
                    item.ProductID = d.ProductID;
                    item.SystemQty = d.SystemQty;
                    item.PhysicalQty = d.PhysicalQty;
                    item.DiffQty = d.PhysicalQty - d.SystemQty;
                    item.UnitPrice = d.UnitPrice;
                    _context.StockCountItems.Update(item);
                }
            }
            await _context.SaveChangesAsync();

            if (model.AutoAdjust)
            {
                await AutoAdjust(entity.ID); // simple call; ignore result here
            }

            return new { success = true, id = entity.ID, no = entity.No };
        }
        catch (Exception ex)
        {
            return new { success = false, result = ex.Message };
        }
    }

    public async Task<object> Delete(int id)
    {
        try
        {
            var entity = await _context.StockCounts.FindAsync(id);
            if (entity == null) return new { success = false, result = "Not found" };
            var items = _context.StockCountItems.Where(x => x.StockCountID == id);
            _context.StockCountItems.RemoveRange(items);
            _context.StockCounts.Remove(entity);
            await _context.SaveChangesAsync();
            return new { success = true };
        }
        catch (Exception ex) { return new { success = false, result = ex.Message }; }
    }

    public async Task<object> DeleteItem(int id)
    {
        try
        {
            var item = await _context.StockCountItems.FindAsync(id);
            if (item == null) return new { success = false, result = "Item not found" };
            _context.StockCountItems.Remove(item);
            await _context.SaveChangesAsync();
            return new { success = true };
        }
        catch (Exception ex) { return new { success = false, result = ex.Message }; }
    }

    public async Task<object> AutoAdjust(int id)
    {
        // Placeholder: Here you would create stock adjustment transactions.
        // For now just recalc total diff value.
        var totalDiffValue = await _context.StockCountItems.Where(x => x.StockCountID == id).SumAsync(i => (i.PhysicalQty - i.SystemQty) * i.UnitPrice);
        return new { success = true, diffValue = totalDiffValue };
    }
}
