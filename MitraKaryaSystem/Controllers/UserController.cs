using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
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
    }
}
