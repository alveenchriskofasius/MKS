using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    public class MasterSettingController : Controller
    {
        private readonly IStoreProfileService _storeProfile;

        public MasterSettingController(IStoreProfileService storeProfile)
        {
            _storeProfile = storeProfile;
        }

        public IActionResult Index() => View();

        [HttpGet]
        public async Task<JsonResult> GetStoreProfile() => Json(await _storeProfile.GetProfile());

        [HttpPost]
        public async Task<JsonResult> SaveStoreProfile([FromBody] Dictionary<string, string> settings)
            => Json(await _storeProfile.SaveProfile(settings));
    }
}
