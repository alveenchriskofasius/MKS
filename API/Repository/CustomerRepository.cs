using API.Context.Table;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;
using MitraKaryaSystem.Models;

namespace API.Repository
{
    public class CustomerRepository : ICustomerRepository
    {
        private readonly MKSTableContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        public CustomerRepository(MKSTableContext context, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }
        public async Task<object> Delete(int id)
        {
            try
            {
                var customer = await _context.Customers.FindAsync(id);
                if (customer == null)
                    return new { success = false, error = "Customer not found" };
                _context.Customers.Remove(customer);
                await _context.SaveChangesAsync();
            }
            catch (Exception e)
            {
                return new { success = false, error = e.Message };
            }
            return new { success = true };
        }

        public async Task<CustomerModel> FillForm(int id)
        {
            Customer customer = await _context.Customers.FindAsync(id);
            CustomerModel customerModel = null;
            if (customer == null)
            {
                customerModel = new CustomerModel();
            }
            else
            {
                customerModel = new CustomerModel
                {
                    ID = id,
                    Address = customer.Address,
                    ContactNumber = customer.ContactNumber,
                    ContactPerson = customer.ContactPerson,
                    IsSupplier = customer.IsSupplier,
                    Name = customer.Name,
                    Note = customer.Note,
                };
            }
            return customerModel;
        }

        public async Task<object> GetList() => await _context.Customers.Select(x => new
        {
            ID = x.ID,
            Name = x.Name,
            ContactNumber = x.ContactNumber,
            ContactPerson = x.IsSupplier ? x.ContactPerson : "-",
            IsSupplier = x.IsSupplier ? "Supplier" : "Customer",
        }).ToListAsync();
        public async Task<List<Customer>> GetListModel() => await _context.Customers.ToListAsync();
        public async Task<object> Save(CustomerModel customer)
        {
            try
            {
                if (customer.ID == 0)
                {
                    await _context.Customers.AddAsync(new Customer
                    {
                        Name = customer.Name,
                        ContactPerson = customer.IsSupplier ? customer.ContactPerson : "-",
                        ContactNumber = customer.ContactNumber,
                        Address = customer.Address,
                        IsSupplier = customer.IsSupplier,
                        Note = customer.Note,
                        CreatedBy = _httpContextAccessor.HttpContext.User.Identity.Name,

                    });
                }
                else
                {
                    Customer data = await _context.Customers.FindAsync(customer.ID);
                    data.Name = customer.Name;
                    data.ContactPerson = customer.IsSupplier ? customer.ContactPerson : "-";
                    data.ContactNumber = customer.ContactNumber;
                    data.Address = customer.Address;
                    data.IsSupplier = customer.IsSupplier;
                    data.Note = customer.Note;
                    data.UpdatedAt = DateTime.Now;
                    data.UpdatedBy = _httpContextAccessor.HttpContext.User.Identity.Name;
                    _context.Update(data);
                }
                await _context.SaveChangesAsync();
            }
            catch (Exception e)
            {
                return new { success = false, error = e.Message };
            }
            return new { success = true };
        }

        public async Task<object> GetDepositBalance(int supplierId)
        {
            var deposit = await _context.CustomerDeposits
                .FirstOrDefaultAsync(d => d.SupplierID == supplierId);
            if (deposit == null)
                return new { supplierId, balance = 0m };
            return new { supplierId, balance = deposit.Amount };
        }
    }
}
