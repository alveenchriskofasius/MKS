using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    public class MasterSettingController : Controller
    {
        public IActionResult Index() => View();
    }
}
