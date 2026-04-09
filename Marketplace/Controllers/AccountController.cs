using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Marketplace.Controllers
{
    public class AccountController : Controller
    {
        private readonly IMarketplaceAuthService _authService;

        public AccountController(IMarketplaceAuthService authService)
        {
            _authService = authService;
        }

        public IActionResult Login() => View();

        public IActionResult Register() => View();

        [HttpPost]
        public async Task<JsonResult> DoLogin(MarketplaceLoginModel model)
        {
            if (!ModelState.IsValid)
                return Json(new { success = false, message = "Data tidak valid." });

            var customer = await _authService.Login(model.Email, model.Password);
            if (customer == null)
                return Json(new { success = false, message = "Email atau password salah." });

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, customer.ID.ToString()),
                new(ClaimTypes.Name, customer.Name),
                new("Email", customer.Email),
                new("CustomerId", customer.ID.ToString())
            };
            var identity = new ClaimsIdentity(claims, "MarketplaceAuth");
            var principal = new ClaimsPrincipal(identity);
            await HttpContext.SignInAsync("MarketplaceAuth", principal, new AuthenticationProperties { IsPersistent = true });

            return Json(new { success = true });
        }

        [HttpPost]
        public async Task<JsonResult> DoRegister(MarketplaceRegisterModel model)
        {
            if (!ModelState.IsValid)
                return Json(new { success = false, message = "Data tidak valid." });

            var result = await _authService.Register(model);
            return Json(result);
        }

        public async Task<IActionResult> Logout()
        {
            HttpContext.Session.Remove("MarketplaceCart");
            await HttpContext.SignOutAsync("MarketplaceAuth");
            return RedirectToAction("Index", "Home");
        }

        [HttpGet]
        public JsonResult WhoAmI()
        {
            if (User.Identity?.IsAuthenticated != true)
                return Json(new { loggedIn = false });

            return Json(new
            {
                loggedIn = true,
                name = User.Identity.Name,
                customerId = User.FindFirst("CustomerId")?.Value,
                email = User.FindFirst("Email")?.Value
            });
        }

        public IActionResult Profile()
        {
            if (User.Identity?.IsAuthenticated != true)
                return RedirectToAction("Login");
            return View();
        }

        [HttpGet]
        public async Task<JsonResult> GetProfile()
        {
            var customerId = int.TryParse(
                User.FindFirst("CustomerId")?.Value, out var id) ? id : 0;
            if (customerId == 0)
                return Json(new { success = false });

            var customer = await _authService.GetCustomerById(customerId);
            if (customer == null)
                return Json(new { success = false });

            return Json(new
            {
                success = true,
                name = customer.Name,
                email = customer.Email,
                phone = customer.Phone,
                address = customer.Address
            });
        }

        [HttpPost]
        public async Task<JsonResult> UpdateProfile(
            string name,
            string phone,
            string address)
        {
            var customerId = int.TryParse(
                User.FindFirst("CustomerId")?.Value, out var id) ? id : 0;
            if (customerId == 0)
                return Json(new { success = false, message = "Not authenticated." });

            var result = await _authService.UpdateProfile(
                customerId, name, phone, address);
            return Json(result);
        }

        [HttpPost]
        public async Task<JsonResult> ChangePassword(
            string currentPassword,
            string newPassword)
        {
            var customerId = int.TryParse(
                User.FindFirst("CustomerId")?.Value, out var id) ? id : 0;
            if (customerId == 0)
                return Json(new { success = false, message = "Not authenticated." });

            var result = await _authService.ChangePassword(
                customerId, currentPassword, newPassword);
            return Json(result);
        }
    }
}
