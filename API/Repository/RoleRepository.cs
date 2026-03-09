using API.Context.SP;
using API.Context.Table;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MitraKaryaSystem.Models;

namespace API.Repository
{
    public class RoleRepository : IRoleRepository
    {
        private readonly MKSTableContext _context;
        private readonly MKSSPContextProcedures _procedure;
        private readonly IMemoryCache _cache;
        public RoleRepository(MKSTableContext context, MKSSPContextProcedures procedure, IMemoryCache cache) { _context = context; _procedure = procedure; _cache = cache; }

        public async Task<object> DeleteRole(int id)
        {
            try
            {
                var role = await _context.Roles.FindAsync(id);
                if (role == null) return new { success = false, result = "Role not found" };
                _context.Roles.Remove(role);
                await DeleteRolePermission(id);
                await _context.SaveChangesAsync();
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
            return new { success = true };
        }

        private async Task DeleteRolePermission(int id)
        {
            var rolePermissions = _context.RolePermissions.Where(x => x.RoleID == id).ToListAsync();
            _context.RolePermissions.RemoveRange(await rolePermissions);
            await _context.SaveChangesAsync();
        }

        private async Task<List<PermissionModel>> GetRolePermissionList(int id)
        {
            var data = await _procedure.uspGetPermissionListAsync(id);
            List<PermissionModel> permissionModels = new List<PermissionModel>();
            data.ForEach(x => permissionModels.Add(new PermissionModel { ID = x.ID, Name = x.Name, IsSelected = (bool)x.IsSelected }));
            return permissionModels;
        }

        public async Task<object> GetRoleList() => await _context.Roles.ToListAsync();
        public async Task<object> SaveRole(RoleViewModel role)
        {
            try
            {
                if (role.Role.ID != 0)
                {
                    Role roles = await _context.Roles.FindAsync(role.Role.ID);
                    roles.Name = role.Role.Name;
                    roles.Description = role.Role.Description;
                    _context.Roles.Update(roles);
                    await _context.SaveChangesAsync();

                    foreach (var x in role.Permissions)
                    {
                        await SaveRolePermission(x, role.Role.ID);
                    }
                }
                else
                {
                    var newRole = new Role { Name = role.Role.Name, Description = role.Role.Description };
                    _context.Roles.Add(newRole);
                    await _context.SaveChangesAsync();

                    foreach (var x in role.Permissions)
                    {
                        await SaveRolePermission(x, newRole.ID);
                    }
                }

                // Bump permission version so middleware refreshes user claims
                _cache.Set("PermVer", Guid.NewGuid().ToString("N"));
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
            return new { success = true };
        }

        private async Task<object> SaveRolePermission(PermissionModel permission, int roleID)
        {
            try
            {
                var rolePermissions = await _context.RolePermissions.ToListAsync();

                if (!rolePermissions.Exists(x => x.PermissionID == permission.ID && x.RoleID == roleID) && permission.IsSelected)
                {
                    _context.RolePermissions.Add(new RolePermission { PermissionID = permission.ID, RoleID = roleID });
                    await _context.SaveChangesAsync();
                }
                else if (rolePermissions.Exists(x => x.PermissionID == permission.ID && x.RoleID == roleID) && !permission.IsSelected)
                {
                    var rolePermission = await _context.RolePermissions.FirstOrDefaultAsync(x => x.PermissionID == permission.ID && x.RoleID == roleID);
                    _context.RolePermissions.Remove(rolePermission);
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
            return new { success = true };
        }


        public async Task<RoleViewModel> FillFormRole(int id)
        {
            Role roles = await _context.Roles.FindAsync(id);
            RoleViewModel roleModel = null;
            if (roles == null)
            {
                roleModel = new RoleViewModel
                {
                    Role = new RoleModel(),
                    Permissions = await GetRolePermissionList(id)
                };
            }
            else
            {
                roleModel = new RoleViewModel
                {
                    Role = new RoleModel
                    {
                        ID = roles.ID,
                        Name = roles.Name,
                        Description = roles.Description
                    },
                    Permissions = await GetRolePermissionList(id)
                };
            }
            return roleModel;
        }
    }
}
