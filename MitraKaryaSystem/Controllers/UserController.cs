using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    [HasPermission("User")] // Require User permission
    public class UserController : Controller
    {
        private readonly IUserService _userService;
        public UserController(IUserService service) => _userService = service;
        public IActionResult Index() => View();
        [HttpGet]
        public async Task<JsonResult> GetUserList() => Json(await _userService.GetUserList());
        [HttpPost]
        public async Task<JsonResult> SaveUser(UserModel user) => Json(await _userService.SaveUser(user));
        [HttpPost]
        public async Task<IActionResult> FillForm(int id) => PartialView("_UserModal", await _userService.FillForm(id));
        [HttpPost]
        public async Task<JsonResult> DeleteUser(int id) => Json(await _userService.DeleteUser(id));

        [HttpGet]
        public async Task<JsonResult> GetUserRoles(int userId) => Json(await _userService.GetUserRoles(userId));

        [HttpPost]
        public async Task<JsonResult> SaveUserRoles(int userId, [FromBody] List<int> roleIds) => Json(await _userService.SaveUserRoles(userId, roleIds ?? new()));
    }
}
