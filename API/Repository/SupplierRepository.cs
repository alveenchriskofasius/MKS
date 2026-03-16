using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;
using MitraKaryaSystem.Models;

namespace API.Repository
{
    public class SupplierRepository : ISupplierRepository
    {
        private readonly MKSTableContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        public SupplierRepository(MKSTableContext context, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task DeleteSupplier(int id)
        {
            _context.Customers.Remove(await _context.Customers.FindAsync(id));
            await _context.SaveChangesAsync();
        }

        public async Task<SupplierModel> FillFormSupplier(int id)
        {
            Customer? supplier = await _context.Customers.FindAsync(id);
            SupplierModel? supplierModel = null;
            if (supplier == null)
            {
                supplierModel = new SupplierModel();
            }
            else
            {
                supplierModel = new SupplierModel
                {
                    ID = supplier.ID,
                    SupplierName = supplier.Name,
                    ContactPerson = supplier.ContactPerson,
                    ContactNumber = supplier.ContactNumber,
                    Address = supplier.Address,
                    Note = supplier.Note
                };
            }
            return supplierModel;
        }

        public async Task<object> GetSupplierList() => await _context.Customers.AsNoTracking().Where(x => x.IsSupplier).Select(x => new { x.ID, SupplierName = x.Name, x.ContactPerson, x.ContactNumber, x.Address, x.IsSupplier }).ToListAsync();

        public async Task SaveSupplier(SupplierModel supplierModel)
        {
            if (supplierModel.ID == 0)
            {
                _context.Customers.Add(new Customer
                {
                    Name = supplierModel.SupplierName,
                    ContactPerson = supplierModel.ContactPerson,
                    ContactNumber = supplierModel.ContactNumber,
                    Address = supplierModel.Address,
                    Note = supplierModel.Note,
                    CreatedBy = _httpContextAccessor.HttpContext.User.Identity.Name,
                    IsSupplier = true
                });
            }
            else
            {
                Customer supplier = await _context.Customers.FindAsync(supplierModel.ID);
                supplier.Name = supplierModel.SupplierName;
                supplier.ContactPerson = supplierModel.ContactPerson;
                supplier.ContactNumber = supplierModel.ContactNumber;
                supplier.Address = supplierModel.Address;
                supplier.Note = supplierModel.Note;
                supplier.UpdatedAt = DateTime.Now;
                supplier.UpdatedBy = _httpContextAccessor.HttpContext.User.Identity.Name;
                _context.Customers.Update(supplier);
            }
            await _context.SaveChangesAsync();
        }

        public async Task<object> GetSalesPersonsBySupplier(int supplierId)
            => await _context.SalesPersons.AsNoTracking()
                .Where(sp => sp.SupplierID == supplierId && sp.IsActive)
                .Select(sp => new { sp.ID, sp.SupplierID, sp.Name, sp.Company, sp.Contact })
                .ToListAsync();

        public async Task<object> GetAllSalesPersons()
            => await _context.SalesPersons.AsNoTracking()
                .Where(sp => sp.IsActive)
                .Join(_context.Customers.AsNoTracking().Where(c => c.IsSupplier),
                    sp => sp.SupplierID, s => s.ID, (sp, s) => new
                    {
                        sp.ID, sp.SupplierID, sp.Name, sp.Company, sp.Contact,
                        SupplierName = s.Name
                    })
                .ToListAsync();

        public async Task<object> SaveSalesPerson(SalesPersonModel model, string userName)
        {
            try
            {
                if (model.ID == 0)
                {
                    _context.SalesPersons.Add(new SalesPerson
                    {
                        SupplierID = model.SupplierID,
                        Name = model.Name,
                        Company = model.Company,
                        Contact = model.Contact,
                        IsActive = true
                    });
                }
                else
                {
                    var entity = await _context.SalesPersons.FindAsync(model.ID);
                    if (entity == null) return new { success = false, error = "Not found" };
                    entity.Name = model.Name;
                    entity.Company = model.Company;
                    entity.Contact = model.Contact;
                    entity.IsActive = model.IsActive;
                    _context.SalesPersons.Update(entity);
                }
                await _context.SaveChangesAsync();
                return new { success = true };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.InnerException?.Message ?? ex.Message };
            }
        }

        public async Task<object> DeleteSalesPerson(int id)
        {
            try
            {
                var entity = await _context.SalesPersons.FindAsync(id);
                if (entity == null) return new { success = false, error = "Not found" };
                _context.SalesPersons.Remove(entity);
                await _context.SaveChangesAsync();
                return new { success = true };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.InnerException?.Message ?? ex.Message };
            }
        }
    }
}
