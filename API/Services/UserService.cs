using API.Context.Table;
using API.Repository.Interfaces;
using API.Services.Interfaces;
using MitraKaryaSystem.Models;

namespace API.Services
{
    public class UserService : IUserService
    {
        private readonly IUserRepository _userRepository;
        private readonly MKSTableContext _context;
        public UserService(IUserRepository userRepository, MKSTableContext context)
        {
            _userRepository = userRepository;
            _context = context;
        }

        public async Task<object> DeleteUser(int id)
        {
            return await _userRepository.DeleteUser(id);
        }

        public async Task<UserModel> FillForm(int id)
        {
            return await _userRepository.FillForm(id);
        }

        public async Task<object> GetUserList()
        {
            return await _userRepository.GetUserList();
        }

        public async Task<object> SaveUser(UserModel user)
        {
            return await _userRepository.SaveUser(user);
        }

        public async Task<List<RoleModel>> GetUserRoles(int userId)
        {
            return await _userRepository.GetUserRoles(userId);
        }

        public async Task<object> SaveUserRoles(int userId, List<int> roleIds)
        {
            return await _userRepository.SaveUserRoles(userId, roleIds);
        }
    }
}
