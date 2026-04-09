using API.Services.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;
using System.Security.Claims;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    public class AuthController : Controller
    {
        private readonly IAuthService _authService;
        private readonly IUserService _userService;
        public AuthController(IAuthService authService, IUserService userService)
        {
            _authService = authService;
            _userService = userService;
        }

        [AllowAnonymous]
        public IActionResult Login() => View();

        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync("AuthScheme");
            return RedirectToAction("Login", "Auth");
        }
        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> Login(LoginModel user)
        {
            // Always clear existing cookie first so stale claims never survive a login attempt
            await HttpContext.SignOutAsync("AuthScheme");

            if (ModelState.IsValid)
            {
                if (await _authService.Login(user.UserName, user.Password))
                {
                    return RedirectToAction("Index", "Home");
                }
                else
                {
                    ModelState.AddModelError(string.Empty, "Invalid credentials, please try again.");
                }
            }
            return View();
        }

        public async Task<IActionResult> Profile()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var model = await _userService.FillForm(userId);
            return View(model);
        }

        [HttpPost]
        public async Task<JsonResult> UpdateProfile(UserModel model)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            model.ID = userId;
            model.IsActive = true;
            return Json(await _userService.SaveUser(model));
        }

        [AllowAnonymous]
        public IActionResult AccessDenied() => View();
    }
}
