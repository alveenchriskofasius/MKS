using Microsoft.AspNetCore.Mvc;

namespace Marketplace.Controllers
{
    public class FaqController : Controller
    {
        public IActionResult Index() => View();
    }
}
