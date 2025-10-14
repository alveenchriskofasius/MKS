using API.Services.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    public class AuthController : Controller
    {
        private readonly IAuthService _authService;
        public AuthController(IAuthService authService) => _authService = authService;
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

        [AllowAnonymous]
        public IActionResult AccessDenied() => View();
    }
}
