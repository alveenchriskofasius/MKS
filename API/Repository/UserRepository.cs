using API.Context.SP;
using API.Context.Table;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;
using MitraKaryaSystem.Models;
namespace API.Repository
{
    public class UserRepository : IUserRepository
    {
        private readonly MKSTableContext _context;
        private readonly MKSSPContextProcedures _sp;
        public UserRepository(MKSTableContext context, MKSSPContextProcedures procedures)
        {
            _context = context;
            _sp = procedures;
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
                var existing = _context.UserRoles.Where(ur => ur.UserID == userId);
                _context.UserRoles.RemoveRange(existing);

                foreach (var roleId in roleIds)
                {
                    _context.UserRoles.Add(new UserRole { UserID = userId, RoleID = roleId });
                }
                await _context.SaveChangesAsync();
            }
            catch (Exception e)
            {
                return new { success = false, error = e.Message };
            }
            return new { success = true };
        }
    }
}
