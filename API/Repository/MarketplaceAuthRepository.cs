using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace API.Repository
{
    public class MarketplaceAuthRepository : BaseRepository, IMarketplaceAuthRepository
    {
        public MarketplaceAuthRepository(MKSTableContext context, IHttpContextAccessor http)
            : base(context, http)
        {
        }

        public async Task<object> Register(MarketplaceRegisterModel model)
        {
            try
            {
                if (await _context.MarketplaceAccounts.AnyAsync(a => a.Email == model.Email))
                    return new { success = false, message = "Email sudah terdaftar." };

                // Create Customer record
                var customer = new Customer
                {
                    Name = model.Name,
                    ContactNumber = model.Phone,
                    ContactPerson = model.Name,
                    Address = model.Address,
                    CreatedBy = "Marketplace",
                    CreatedAt = DateTime.Now
                };
                _context.Customers.Add(customer);
                await SaveChangesAsync();

                // Create MarketplaceAccount
                CreatePasswordHash(model.Password, out byte[] hash, out byte[] salt);
                var account = new MarketplaceAccount
                {
                    CustomerID = customer.ID,
                    Email = model.Email,
                    PasswordHash = hash,
                    PasswordSalt = salt
                };
                _context.MarketplaceAccounts.Add(account);
                await SaveChangesAsync();

                return new { success = true, customerId = customer.ID };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

        public async Task<MarketplaceCustomerInfo?> Login(string email, string password)
        {
            var account = await _context.MarketplaceAccounts
                .Include(a => a.Customer)
                .FirstOrDefaultAsync(a => a.Email == email);

            if (account == null) return null;
            if (!VerifyPasswordHash(password, account.PasswordHash, account.PasswordSalt)) return null;

            return new MarketplaceCustomerInfo
            {
                ID = account.CustomerID,
                Name = account.Customer?.Name ?? "",
                Phone = account.Customer?.ContactNumber ?? "",
                Address = account.Customer?.Address ?? "",
                Email = account.Email
            };
        }

        public async Task<MarketplaceCustomerInfo?> GetCustomerById(int customerId)
        {
            var account = await _context.MarketplaceAccounts
                .Include(a => a.Customer)
                .FirstOrDefaultAsync(a => a.CustomerID == customerId);

            if (account == null) return null;

            return new MarketplaceCustomerInfo
            {
                ID = account.CustomerID,
                Name = account.Customer?.Name ?? "",
                Phone = account.Customer?.ContactNumber ?? "",
                Address = account.Customer?.Address ?? "",
                Email = account.Email
            };
        }

        public async Task<object> UpdateProfile(
            int customerId,
            string name,
            string phone,
            string address)
        {
            try
            {
                var customer = await _context.Customers.FindAsync(customerId);
                if (customer == null)
                    return new { success = false, message = "Customer tidak ditemukan." };

                customer.Name = name;
                customer.ContactNumber = phone;
                customer.ContactPerson = name;
                customer.Address = address;
                customer.UpdatedAt = DateTime.Now;
                customer.UpdatedBy = "Marketplace";
                _context.Customers.Update(customer);
                await SaveChangesAsync();

                return new { success = true, message = "Profil berhasil diperbarui." };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

        public async Task SaveCart(int customerId, string cartJson)
        {
            var account = await _context.MarketplaceAccounts
                .FirstOrDefaultAsync(a => a.CustomerID == customerId);
            if (account != null)
            {
                account.CartJson = cartJson;
                await SaveChangesAsync();
            }
        }

        public async Task<string?> GetCart(int customerId)
        {
            return await _context.MarketplaceAccounts
                .Where(a => a.CustomerID == customerId)
                .Select(a => a.CartJson)
                .FirstOrDefaultAsync();
        }

        public async Task SaveWishlist(int customerId, string wishlistJson)
        {
            var account = await _context.MarketplaceAccounts
                .FirstOrDefaultAsync(a => a.CustomerID == customerId);
            if (account != null)
            {
                account.WishlistJson = wishlistJson;
                await SaveChangesAsync();
            }
        }

        public async Task<string?> GetWishlist(int customerId)
        {
            return await _context.MarketplaceAccounts
                .Where(a => a.CustomerID == customerId)
                .Select(a => a.WishlistJson)
                .FirstOrDefaultAsync();
        }

        public async Task<object> ChangePassword(int customerId, string currentPassword, string newPassword)
        {
            try
            {
                var account = await _context.MarketplaceAccounts
                    .FirstOrDefaultAsync(a => a.CustomerID == customerId);
                if (account == null)
                    return new { success = false, message = "Akun tidak ditemukan." };

                if (!VerifyPasswordHash(currentPassword, account.PasswordHash, account.PasswordSalt))
                    return new { success = false, message = "Password lama salah." };

                CreatePasswordHash(newPassword, out byte[] hash, out byte[] salt);
                account.PasswordHash = hash;
                account.PasswordSalt = salt;
                await SaveChangesAsync();

                return new { success = true, message = "Password berhasil diubah." };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

        private static void CreatePasswordHash(string password, out byte[] hash, out byte[] salt)
        {
            using var hmac = new HMACSHA512();
            salt = hmac.Key;
            hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));
        }

        private static bool VerifyPasswordHash(string password, byte[] hash, byte[] salt)
        {
            using var hmac = new HMACSHA512(salt);
            var computed = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));
            return computed.SequenceEqual(hash);
        }
    }
}
