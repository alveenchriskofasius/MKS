using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class CustomerDepositRepository : ICustomerDepositRepository
{
    private readonly MKSTableContext _ctx;
    private readonly IHttpContextAccessor _http;

    public CustomerDepositRepository(MKSTableContext ctx, IHttpContextAccessor http)
    {
        _ctx = ctx;
        _http = http;
    }

    public async Task<IEnumerable<CustomerDepositModel>> GetList()
    {
        var list = await _ctx.CustomerDeposits.AsNoTracking()
            .Join(_ctx.Customers.AsNoTracking(),
                  d => d.SupplierID,
                  c => c.ID,
                  (d, c) => new CustomerDepositModel
                  {
                      ID = d.ID,
                      SupplierID = d.SupplierID,
                      SupplierName = c.Name,
                      Amount = d.Amount,
                      CreatedBy = d.CreatedBy,
                      CreatedAt = d.CreatedAt,
                      UpdatedBy = d.UpdatedBy,
                      UpdatedAt = d.UpdatedAt
                  })
            .OrderByDescending(d => d.Amount)
            .ToListAsync();
        return list;
    }

    public async Task<CustomerDepositModel> Get(int id)
    {
        var d = await _ctx.CustomerDeposits.AsNoTracking().FirstOrDefaultAsync(x => x.ID == id);
        if (d == null) return null;
        var supplierName = await _ctx.Customers.AsNoTracking()
            .Where(c => c.ID == d.SupplierID)
            .Select(c => c.Name)
            .FirstOrDefaultAsync() ?? "-";
        return new CustomerDepositModel
        {
            ID = d.ID,
            SupplierID = d.SupplierID,
            SupplierName = supplierName,
            Amount = d.Amount,
            CreatedBy = d.CreatedBy,
            CreatedAt = d.CreatedAt,
            UpdatedBy = d.UpdatedBy,
            UpdatedAt = d.UpdatedAt
        };
    }

    public async Task<object> Adjust(int supplierId, decimal amount)
    {
        try
        {
            var user = _http.HttpContext?.User?.Identity?.Name ?? "system";
            var now = DateTime.Now;
            var deposit = await _ctx.CustomerDeposits.FirstOrDefaultAsync(d => d.SupplierID == supplierId);
            if (deposit == null)
            {
                deposit = new CustomerDeposit
                {
                    SupplierID = supplierId,
                    Amount = amount,
                    CreatedBy = user,
                    CreatedAt = now
                };
                await _ctx.CustomerDeposits.AddAsync(deposit);
            }
            else
            {
                deposit.Amount = amount;
                deposit.UpdatedBy = user;
                deposit.UpdatedAt = now;
                _ctx.CustomerDeposits.Update(deposit);
            }
            await _ctx.SaveChangesAsync();
            return new { success = true, id = deposit.ID, balance = deposit.Amount };
        }
        catch (Exception e)
        {
            return new { success = false, result = e.Message };
        }
    }
}
