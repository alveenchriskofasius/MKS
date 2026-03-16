using API.Context.SP;
using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class ConsignmentRepository : IConsignmentRepository
{
    private readonly MKSTableContext _ctx;
    private readonly MKSSPContextProcedures _procedure;

    public ConsignmentRepository(MKSTableContext ctx, MKSSPContextProcedures procedure)
    {
        _ctx = ctx;
        _procedure = procedure;
    }

    public async Task<IEnumerable<ConsignmentListItem>> GetList()
    {
        return await _ctx.Consignments.AsNoTracking()
            .GroupJoin(_ctx.Customers.AsNoTracking().Where(c => c.IsSupplier),
                       c => c.SupplierID, s => s.ID, (c, sg) => new { c, sg })
            .SelectMany(x => x.sg.DefaultIfEmpty(), (x, s) => new { x.c, s })
            .OrderByDescending(x => x.c.Date)
            .Select(x => new ConsignmentListItem
            {
                ID = x.c.ID,
                No = x.c.No,
                Date = x.c.Date.ToString("yyyy-MM-dd"),
                SupplierName = x.s != null ? x.s.Name : "-",
                SalesPersonName = x.c.SalesPersonName ?? "-",
                SalesPersonCompany = x.c.SalesPersonCompany ?? "",
                SalesPersonContact = x.c.SalesPersonContact ?? "",
                StatusID = x.c.StatusID,
                Status = x.c.StatusID == 1 ? "Active" : x.c.StatusID == 2 ? "Settled" : "Returned",
                TotalAmount = x.c.TotalAmount,
                SoldAmount = x.c.SoldAmount,
                TotalItems = _ctx.ConsignmentItems.Count(ci => ci.ConsignmentID == x.c.ID),
                SoldItems = _ctx.ConsignmentItems.Where(ci => ci.ConsignmentID == x.c.ID).Sum(ci => ci.SoldQuantity)
            }).ToListAsync();
    }

    public async Task<ConsignmentModel> Get(int id)
    {
        var c = await _ctx.Consignments.FindAsync(id);
        if (c == null) return new ConsignmentModel();
        return new ConsignmentModel
        {
            ID = c.ID,
            Date = c.Date,
            No = c.No,
            SupplierID = c.SupplierID,
            SalesPersonID = c.SalesPersonID,
            SalesPersonName = c.SalesPersonName,
            SalesPersonCompany = c.SalesPersonCompany,
            SalesPersonContact = c.SalesPersonContact,
            StatusID = c.StatusID,
            Note = c.Note,
            Items = await GetItemModels(id)
        };
    }

    private async Task<List<ConsignmentItemModel>> GetItemModels(int consignmentId)
    {
        return await _ctx.ConsignmentItems.AsNoTracking()
            .Where(ci => ci.ConsignmentID == consignmentId)
            .Join(_ctx.Products.AsNoTracking(), ci => ci.ProductID, p => p.ID, (ci, p) => new { ci, p })
            .GroupJoin(_ctx.Units.AsNoTracking(), x => x.p.UnitID, u => u.ID, (x, ug) => new { x.ci, x.p, ug })
            .SelectMany(x => x.ug.DefaultIfEmpty(), (x, u) => new ConsignmentItemModel
            {
                ID = x.ci.ID,
                ConsignmentID = x.ci.ConsignmentID,
                ProductID = x.ci.ProductID,
                ProductName = x.p.Name,
                UnitName = u != null ? u.Name : "",
                Quantity = x.ci.Quantity,
                SoldQuantity = x.ci.SoldQuantity,
                ReturnedQuantity = x.ci.ReturnedQuantity,
                UnitPrice = x.ci.UnitPrice,
                SellingPrice = x.ci.SellingPrice
            }).ToListAsync();
    }

    public async Task<object> GetItems(int consignmentId)
    {
        return await GetItemModels(consignmentId);
    }

    public async Task<object> Save(ConsignmentModel model, string userName)
    {
        try
        {
            if (model.ID == 0)
            {
                var noResult = await _procedure.uspGenerateNoAsync("CON", model.Date);
                var no = noResult.FirstOrDefault()?.NewNumber ?? $"CON{model.Date:yyMMddHHmmss}";
                var entity = new Consignment
                {
                    Date = model.Date,
                    No = no,
                    SupplierID = model.SupplierID,
                    SalesPersonID = model.SalesPersonID,
                    SalesPersonName = model.SalesPersonName,
                    SalesPersonCompany = model.SalesPersonCompany,
                    SalesPersonContact = model.SalesPersonContact,
                    StatusID = 1,
                    Note = model.Note,
                    TotalAmount = 0,
                    SoldAmount = 0,
                    CreatedBy = userName,
                    CreatedAt = DateTime.Now
                };
                await _ctx.Consignments.AddAsync(entity);
                await _ctx.SaveChangesAsync();
                return new { success = true, id = entity.ID };
            }
            else
            {
                var entity = await _ctx.Consignments.FindAsync(model.ID);
                if (entity == null) return new { success = false, error = "Not found." };
                if (entity.StatusID != 1) return new { success = false, error = "Only active consignments can be edited." };
                entity.Date = model.Date;
                entity.SupplierID = model.SupplierID;
                entity.SalesPersonID = model.SalesPersonID;
                entity.SalesPersonName = model.SalesPersonName;
                entity.SalesPersonCompany = model.SalesPersonCompany;
                entity.SalesPersonContact = model.SalesPersonContact;
                entity.Note = model.Note;
                entity.UpdatedBy = userName;
                entity.UpdatedAt = DateTime.Now;
                _ctx.Consignments.Update(entity);
                await _ctx.SaveChangesAsync();
                return new { success = true, id = entity.ID };
            }
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.InnerException?.Message ?? ex.Message };
        }
    }

    public async Task<object> Delete(int id)
    {
        try
        {
            var entity = await _ctx.Consignments.Include(c => c.ConsignmentItems).FirstOrDefaultAsync(c => c.ID == id);
            if (entity == null) return new { success = false, error = "Not found." };
            if (entity.StatusID != 1) return new { success = false, error = "Only active consignments can be deleted." };
            if (entity.ConsignmentItems.Any(ci => ci.SoldQuantity > 0))
                return new { success = false, error = "Cannot delete: some items have been sold." };
            _ctx.ConsignmentItems.RemoveRange(entity.ConsignmentItems);
            _ctx.Consignments.Remove(entity);
            await _ctx.SaveChangesAsync();
            return new { success = true };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.InnerException?.Message ?? ex.Message };
        }
    }

    public async Task<object> AddItem(ConsignmentItemModel item, string userName)
    {
        try
        {
            var consignment = await _ctx.Consignments.FindAsync(item.ConsignmentID);
            if (consignment == null) return new { success = false, error = "Consignment not found." };
            if (consignment.StatusID != 1) return new { success = false, error = "Only active consignments can have items added." };

            var entity = new ConsignmentItem
            {
                ConsignmentID = item.ConsignmentID,
                ProductID = item.ProductID,
                Quantity = item.Quantity,
                SoldQuantity = 0,
                ReturnedQuantity = 0,
                UnitPrice = item.UnitPrice,
                SellingPrice = item.SellingPrice,
                CreatedAt = DateTime.Now
            };
            await _ctx.ConsignmentItems.AddAsync(entity);

            consignment.TotalAmount = await _ctx.ConsignmentItems
                .Where(ci => ci.ConsignmentID == item.ConsignmentID)
                .SumAsync(ci => (decimal?)(ci.UnitPrice * ci.Quantity)) ?? 0;
            consignment.TotalAmount += entity.UnitPrice * entity.Quantity;
            consignment.UpdatedBy = userName;
            consignment.UpdatedAt = DateTime.Now;

            await _ctx.SaveChangesAsync();
            return new { success = true, id = entity.ID };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.InnerException?.Message ?? ex.Message };
        }
    }

    public async Task<object> RemoveItem(int itemId)
    {
        try
        {
            var item = await _ctx.ConsignmentItems.FindAsync(itemId);
            if (item == null) return new { success = false, error = "Item not found." };
            if (item.SoldQuantity > 0) return new { success = false, error = "Cannot remove: item has sold units." };

            var consignment = await _ctx.Consignments.FindAsync(item.ConsignmentID);
            if (consignment?.StatusID != 1) return new { success = false, error = "Only active consignments can be modified." };

            _ctx.ConsignmentItems.Remove(item);
            await _ctx.SaveChangesAsync();

            consignment.TotalAmount = await _ctx.ConsignmentItems
                .Where(ci => ci.ConsignmentID == consignment.ID)
                .SumAsync(ci => (decimal?)(ci.UnitPrice * ci.Quantity)) ?? 0;
            await _ctx.SaveChangesAsync();

            return new { success = true };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.InnerException?.Message ?? ex.Message };
        }
    }

    public async Task<object> RecordSale(RecordSaleModel model, string userName)
    {
        try
        {
            var item = await _ctx.ConsignmentItems.FindAsync(model.ConsignmentItemID);
            if (item == null) return new { success = false, error = "Item not found." };

            var remaining = item.Quantity - item.SoldQuantity - item.ReturnedQuantity;
            if (model.Quantity <= 0 || model.Quantity > remaining)
                return new { success = false, error = $"Invalid quantity. Available: {remaining}" };

            item.SoldQuantity += model.Quantity;
            await _ctx.SaveChangesAsync();

            var consignment = await _ctx.Consignments.FindAsync(item.ConsignmentID);
            if (consignment != null)
            {
                consignment.SoldAmount = await _ctx.ConsignmentItems
                    .Where(ci => ci.ConsignmentID == consignment.ID)
                    .SumAsync(ci => (decimal?)(ci.UnitPrice * ci.SoldQuantity)) ?? 0;
                consignment.UpdatedBy = userName;
                consignment.UpdatedAt = DateTime.Now;
                await _ctx.SaveChangesAsync();
            }

            return new { success = true };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.InnerException?.Message ?? ex.Message };
        }
    }

    public async Task<object> RecordReturn(RecordReturnModel model, string userName)
    {
        try
        {
            var item = await _ctx.ConsignmentItems.FindAsync(model.ConsignmentItemID);
            if (item == null) return new { success = false, error = "Item not found." };

            var remaining = item.Quantity - item.SoldQuantity - item.ReturnedQuantity;
            if (model.Quantity <= 0 || model.Quantity > remaining)
                return new { success = false, error = $"Invalid quantity. Available: {remaining}" };

            item.ReturnedQuantity += model.Quantity;
            await _ctx.SaveChangesAsync();

            var consignment = await _ctx.Consignments.FindAsync(item.ConsignmentID);
            if (consignment != null)
            {
                consignment.UpdatedBy = userName;
                consignment.UpdatedAt = DateTime.Now;
                await _ctx.SaveChangesAsync();
            }

            return new { success = true };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.InnerException?.Message ?? ex.Message };
        }
    }

    public async Task<object> Settle(int id, string userName)
    {
        try
        {
            var entity = await _ctx.Consignments.Include(c => c.ConsignmentItems).FirstOrDefaultAsync(c => c.ID == id);
            if (entity == null) return new { success = false, error = "Not found." };
            if (entity.StatusID != 1) return new { success = false, error = "Already settled or returned." };

            var hasRemaining = entity.ConsignmentItems.Any(ci => ci.Quantity - ci.SoldQuantity - ci.ReturnedQuantity > 0);
            if (hasRemaining) return new { success = false, error = "All items must be sold or returned before settling." };

            entity.StatusID = 2;
            entity.UpdatedBy = userName;
            entity.UpdatedAt = DateTime.Now;
            await _ctx.SaveChangesAsync();
            return new { success = true };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.InnerException?.Message ?? ex.Message };
        }
    }

    public async Task AutoDeductConsignmentSales(Dictionary<int, int> productQtyMap, string userName)
    {
        if (productQtyMap == null || productQtyMap.Count == 0) return;

        var productIds = productQtyMap.Keys.ToList();
        var activeConsignmentIds = await _ctx.Consignments
            .Where(c => c.StatusID == 1)
            .Select(c => c.ID)
            .ToListAsync();

        if (!activeConsignmentIds.Any()) return;

        var consignmentItems = await _ctx.ConsignmentItems
            .Where(ci => activeConsignmentIds.Contains(ci.ConsignmentID)
                         && productIds.Contains(ci.ProductID)
                         && ci.Quantity - ci.SoldQuantity - ci.ReturnedQuantity > 0)
            .OrderBy(ci => ci.ID)
            .ToListAsync();

        if (!consignmentItems.Any()) return;

        var affectedConsignmentIds = new HashSet<int>();

        foreach (var kvp in productQtyMap)
        {
            var productId = kvp.Key;
            var remainingQty = kvp.Value;
            var items = consignmentItems.Where(ci => ci.ProductID == productId).ToList();

            foreach (var item in items)
            {
                if (remainingQty <= 0) break;
                var available = item.Quantity - item.SoldQuantity - item.ReturnedQuantity;
                if (available <= 0) continue;
                var deduct = Math.Min(remainingQty, available);
                item.SoldQuantity += deduct;
                remainingQty -= deduct;
                affectedConsignmentIds.Add(item.ConsignmentID);
            }
        }

        if (!affectedConsignmentIds.Any()) return;

        await _ctx.SaveChangesAsync();

        foreach (var cid in affectedConsignmentIds)
        {
            var consignment = await _ctx.Consignments.FindAsync(cid);
            if (consignment != null)
            {
                consignment.SoldAmount = await _ctx.ConsignmentItems
                    .Where(ci => ci.ConsignmentID == cid)
                    .SumAsync(ci => (decimal?)(ci.UnitPrice * ci.SoldQuantity)) ?? 0;
                consignment.UpdatedBy = userName;
                consignment.UpdatedAt = DateTime.Now;
            }
        }

        await _ctx.SaveChangesAsync();
    }

    public async Task AutoReverseConsignmentSales(Dictionary<int, int> productQtyMap, string userName)
    {
        if (productQtyMap == null || productQtyMap.Count == 0) return;

        var productIds = productQtyMap.Keys.ToList();
        var activeConsignmentIds = await _ctx.Consignments
            .Where(c => c.StatusID == 1)
            .Select(c => c.ID)
            .ToListAsync();

        if (!activeConsignmentIds.Any()) return;

        var consignmentItems = await _ctx.ConsignmentItems
            .Where(ci => activeConsignmentIds.Contains(ci.ConsignmentID)
                         && productIds.Contains(ci.ProductID)
                         && ci.SoldQuantity > 0)
            .OrderByDescending(ci => ci.ID)
            .ToListAsync();

        if (!consignmentItems.Any()) return;

        var affectedConsignmentIds = new HashSet<int>();

        foreach (var kvp in productQtyMap)
        {
            var productId = kvp.Key;
            var remainingQty = kvp.Value;
            var items = consignmentItems.Where(ci => ci.ProductID == productId).ToList();

            foreach (var item in items)
            {
                if (remainingQty <= 0) break;
                var reversible = item.SoldQuantity;
                if (reversible <= 0) continue;
                var reverse = Math.Min(remainingQty, reversible);
                item.SoldQuantity -= reverse;
                remainingQty -= reverse;
                affectedConsignmentIds.Add(item.ConsignmentID);
            }
        }

        if (!affectedConsignmentIds.Any()) return;

        await _ctx.SaveChangesAsync();

        foreach (var cid in affectedConsignmentIds)
        {
            var consignment = await _ctx.Consignments.FindAsync(cid);
            if (consignment != null)
            {
                consignment.SoldAmount = await _ctx.ConsignmentItems
                    .Where(ci => ci.ConsignmentID == cid)
                    .SumAsync(ci => (decimal?)(ci.UnitPrice * ci.SoldQuantity)) ?? 0;
                consignment.UpdatedBy = userName;
                consignment.UpdatedAt = DateTime.Now;
            }
        }

        await _ctx.SaveChangesAsync();
    }
}
