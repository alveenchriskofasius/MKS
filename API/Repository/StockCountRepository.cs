using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using API.Services;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class StockCountRepository : BaseRepository, IStockCountRepository
{
    private readonly IStockLedgerService _stockLedger;
    public StockCountRepository(MKSTableContext ctx, IHttpContextAccessor accessor, IStockLedgerService stockLedger = null) : base(ctx, accessor) { _stockLedger = stockLedger; }

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
            var user = GetCurrentUserName();
            if (model.ID == 0)
            {
                entity = new StockCount
                {
                    Date = model.Date.Date,
                    No = await GenerateNo(model.Date.Date),
                    Note = model.Note,
                    AutoAdjust = false,
                    CreatedAt = DateTime.Now,
                    CreatedBy = user
                };
                await _context.AddAsync(entity);
                await SaveChangesAsync();
            }
            else
            {
                entity = await _context.StockCounts.Include(x => x.StockCountItems).FirstOrDefaultAsync(x => x.ID == model.ID) ?? throw new Exception("Stock Count not found");
                if (entity.AutoAdjust)
                    return new { success = false, result = "Cannot edit — stock has already been adjusted" };
                entity.Date = model.Date.Date;
                entity.Note = model.Note;
                entity.UpdatedAt = DateTime.Now;
                entity.UpdatedBy = user;
                await SaveChangesAsync();
            }

            // sync detail
            var existingIds = model.Items.Where(i => i.ID > 0).Select(i => i.ID).ToHashSet();
            var toRemove = _context.StockCountItems.Where(i => i.StockCountID == entity.ID && !existingIds.Contains(i.ID));
            _context.StockCountItems.RemoveRange(toRemove);
            await SaveChangesAsync();

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
            await SaveChangesAsync();

            return new { success = true, id = entity.ID, no = entity.No };
        }
        catch (Exception ex)
        {
            return CreateErrorResponse(ex);
        }
    }

    public async Task<object> Delete(int id)
    {
        try
        {
            var entity = await _context.StockCounts.FindAsync(id);
            if (entity == null) return new { success = false, result = "Not found" };
            var items = await _context.StockCountItems.Where(x => x.StockCountID == id).ToListAsync();

            // Reverse stock adjustments if this stock count was already adjusted
            if (entity.AutoAdjust)
            {
                foreach (var item in items)
                {
                    var product = await _context.Products.FindAsync(item.ProductID);
                    if (product != null)
                    {
                        int reversal = item.SystemQty - item.PhysicalQty;
                        product.StockQuantity += reversal;
                        _context.Products.Update(product);
                        if (_stockLedger != null && reversal != 0)
                        {
                            try { await _stockLedger.WriteAsync(product.ID, reversal, "StockCount", id, entity.No, "Reverse - SC Deleted"); } catch { }
                        }
                    }
                }
            }

            _context.StockCountItems.RemoveRange(items);
            _context.StockCounts.Remove(entity);
            await SaveChangesAsync();
            return new { success = true };
        }
        catch (Exception ex) { return CreateErrorResponse(ex); }
    }

    public async Task<object> DeleteItem(int id)
    {
        try
        {
            var item = await _context.StockCountItems.FindAsync(id);
            if (item == null) return new { success = false, result = "Item not found" };
            _context.StockCountItems.Remove(item);
            await SaveChangesAsync();
            return new { success = true };
        }
        catch (Exception ex) { return CreateErrorResponse(ex); }
    }

    public async Task<object> AutoAdjust(int id)
    {
        var sc = await _context.Set<StockCount>().FindAsync(id);
        if (sc == null) return new { success = false, result = "Stock Count not found" };
        if (sc.AutoAdjust) return new { success = false, result = "Stock has already been adjusted for this count" };

        var items = await _context.StockCountItems.Where(x => x.StockCountID == id).ToListAsync();
        foreach (var item in items)
        {
            var product = await _context.Products.FindAsync(item.ProductID);
            if (product != null)
            {
                int diff = item.PhysicalQty - product.StockQuantity;
                product.StockQuantity = item.PhysicalQty;
                _context.Products.Update(product);
                if (_stockLedger != null && diff != 0)
                {
                    try { await _stockLedger.WriteAsync(product.ID, diff, "StockCount", id, sc.No, "Auto Adjust"); } catch { }
                }
            }
        }

        sc.AutoAdjust = true;
        sc.UpdatedAt = DateTime.Now;
        sc.UpdatedBy = GetCurrentUserName();
        _context.Update(sc);
        await SaveChangesAsync();

        var totalDiffValue = items.Sum(i => (i.PhysicalQty - i.SystemQty) * i.UnitPrice);
        return new { success = true, diffValue = totalDiffValue, adjustedCount = items.Count };
    }
}
