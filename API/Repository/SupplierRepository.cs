using API.Context.Table;
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
                    ContactNumber = supplier.ContactNumber
                };
            }
            return supplierModel;
        }

        public async Task<object> GetSupplierList() => await _context.Customers.AsNoTracking().Where(x => x.IsSupplier).Select(x => new { x.ID, SupplierName = x.Name, x.ContactPerson, x.ContactNumber, x.IsSupplier }).ToListAsync();

        public async Task SaveSupplier(SupplierModel supplierModel)
        {
            if (supplierModel.ID == 0)
            {
                _context.Customers.Add(new Customer
                {
                    Name = supplierModel.SupplierName,
                    ContactPerson = supplierModel.ContactPerson,
                    ContactNumber = supplierModel.ContactNumber,
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
                supplier.UpdatedAt = DateTime.Now;
                supplier.UpdatedBy = _httpContextAccessor.HttpContext.User.Identity.Name;
                _context.Customers.Update(supplier);
            }
            await _context.SaveChangesAsync();
        }
    }
}
