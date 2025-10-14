using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MitraKaryaSystem.Models;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    [HasPermission("Role")] // Require Role permission
    public class RoleController : Controller
    {
        private readonly IRoleService _roleService;

        public RoleController(IRoleService roleService) => _roleService = roleService;
        public IActionResult Index() => View();

        [Route("FillGridRole")]
        public async Task<JsonResult> FillGridRole() => Json(await _roleService.GetRoleList());
        [HttpPost]
        [Route("SaveRole")]
        public async Task<IActionResult> SaveRole([FromBody] RoleViewModel request) => Json(await _roleService.SaveRole(request));
        [Route("FillFormRole")]
        [HttpPost]
        public async Task<IActionResult> FillFormRole(int id) => PartialView("_RoleModal", await _roleService.FillFormRole(id));
        [Route("DeleteRole")]
        [HttpPost]
        public async Task<IActionResult> DeleteRole(int id) => Json(await _roleService.DeleteRole(id));
    }
}
