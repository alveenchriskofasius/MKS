using Microsoft.AspNetCore.Mvc;

namespace Marketplace.Controllers
{
    public class AboutController : Controller
    {
        public IActionResult Index() => View();
    }
}
