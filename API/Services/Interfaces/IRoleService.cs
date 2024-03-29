﻿using MitraKaryaSystem.Models;

namespace API.Services.Interfaces
{
    public interface IRoleService
    {
        public Task<object> GetRoleList();
        public Task SaveRole(RoleViewModel role);
        public Task DeleteRole(int id);
        public Task<RoleViewModel> FillFormRole(int id);
    }
}
