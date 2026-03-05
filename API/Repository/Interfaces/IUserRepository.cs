using MitraKaryaSystem.Models;

namespace API.Repository.Interfaces
{
    public interface IUserRepository
    {

        public Task<object> GetUserList();
        public Task<object> SaveUser(UserModel user);
        public Task<UserModel> FillForm(int id);
        public Task<object> DeleteUser(int id);
        public Task<List<RoleModel>> GetUserRoles(int userId);
        public Task<object> SaveUserRoles(int userId, List<int> roleIds);
    }
}
