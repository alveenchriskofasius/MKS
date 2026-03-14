using API.Context.SP;
using API.Context.Table;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MitraKaryaSystem.Models;
namespace API.Repository
{
    public class UserRepository : IUserRepository
    {
        private readonly MKSTableContext _context;
        private readonly MKSSPContextProcedures _sp;
        private readonly IMemoryCache _cache;
        public UserRepository(MKSTableContext context, MKSSPContextProcedures procedures, IMemoryCache cache)
        {
            _context = context;
            _sp = procedures;
            _cache = cache;
        }

        public async Task<object> GetUserList() => await _context.Users.Select(x => new
        {
            ID = x.ID,
            UserName = x.UserName,
            Name = x.Name,
            KTP = x.KTP,
            Email = x.Email,
            Active = x.Active ? "Active" : "Inactive"
        })
        .ToListAsync();

        public async Task<object> SaveUser(UserModel user)
        {
            try
            {
                if (user.ID == 0)
                {
                    await _sp.uspUserAddAsync(user.Name, user.PhoneNumber, user.UserName, user.Email, user.Password, user.IsActive, user.KTP);
                }
                else
                {
                    await _sp.uspUserUpdateAsync(user.ID, user.Name, user.PhoneNumber, user.UserName, user.Email, user.Password, user.IsActive, user.KTP);
                }
                await _context.SaveChangesAsync();
            }
            catch (Exception e)
            {
                return new { success = false, error = e.Message };
            }
            return new { success = true };
        }
        public async Task<UserModel> FillForm(int id)
        {
            List<uspUserGetResult> users = await _sp.uspUserGetAsync(id);
            UserModel userModel = null;
            if (users.Count == 0)
            {
                userModel = new UserModel();
            }
            else
            {
                var user = users.FirstOrDefault();
                userModel = new UserModel
                {
                    ID = user.ID,
                    UserName = user.Username,
                    Email = user.Email,
                    Name = user.Name,
                    KTP = user.KTP,
                    IsActive = user.Active,
                    PhoneNumber = user.PhoneNumber
                };
            }
            return userModel;
        }

        public async Task<object> DeleteUser(int id)
        {
            try
            {
                User user = await _context.Users.FindAsync(id);
                if (user == null)
                    return new { success = false, error = "User not found" };
                _context.Users.Remove(user);
                await _context.SaveChangesAsync();
            }
            catch (Exception e)
            {
                return new { success = false, error = e.Message };
            }
            return new { success = true };
        }

        public async Task<List<RoleModel>> GetUserRoles(int userId)
        {
            var allRoles = await _context.Roles.ToListAsync();
            var userRoleIds = await _context.UserRoles
                .Where(ur => ur.UserID == userId)
                .Select(ur => ur.RoleID)
                .ToListAsync();

            return allRoles.Select(r => new RoleModel
            {
                ID = r.ID,
                Name = r.Name,
                Description = r.Description,
                IsAssigned = userRoleIds.Contains(r.ID)
            }).ToList();
        }

        public async Task<object> SaveUserRoles(int userId, List<int> roleIds)
        {
            try
            {
                // UserRole is a HasNoKey entity — EF change tracker cannot Add/Remove it.
                // Use raw SQL instead.
                await _context.Database.ExecuteSqlRawAsync(
                    "DELETE FROM UserRole WHERE UserID = {0}", userId);

                foreach (var roleId in roleIds)
                {
                    await _context.Database.ExecuteSqlRawAsync(
                        "INSERT INTO UserRole (UserID, RoleID) VALUES ({0}, {1})", userId, roleId);
                }

                // Bump permission version so the middleware refreshes claims
                _cache.Set("PermVer", Guid.NewGuid().ToString("N"));
            }
            catch (Exception e)
            {
                return new { success = false, error = e.Message };
            }
            return new { success = true };
        }

        public async Task<object> GetDriverList()
        {
            var driverRoleIds = await _context.Roles
                .Where(r => r.Name.ToLower() == "driver")
                .Select(r => r.ID)
                .ToListAsync();

            var driverUserIds = await _context.UserRoles
                .Where(ur => ur.RoleID != null && driverRoleIds.Contains(ur.RoleID.Value))
                .Select(ur => ur.UserID)
                .Distinct()
                .ToListAsync();

            return await _context.Users
                .Where(u => u.Active && driverUserIds.Contains(u.ID))
                .Select(u => new { ID = u.ID, Name = u.Name, UserName = u.UserName })
                .ToListAsync();
        }
    }
}
