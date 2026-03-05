using API.Context.Table;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [Authorize]
    [HasPermission("Audit Log")]
    public class AuditLogController : Controller
    {
        private readonly MKSTableContext _context;

        public AuditLogController(MKSTableContext context) => _context = context;

        public IActionResult Index() => View();

        [HttpGet]
        public async Task<JsonResult> GetList(string? entity, string? action, string? user, DateTime? from, DateTime? to)
        {
            var q = _context.AuditLogs.AsQueryable();
            if (!string.IsNullOrWhiteSpace(entity))
                q = q.Where(x => x.EntityName.Contains(entity));
            if (!string.IsNullOrWhiteSpace(action))
                q = q.Where(x => x.Action.Contains(action));
            if (!string.IsNullOrWhiteSpace(user))
                q = q.Where(x => x.UserName.Contains(user));
            if (from.HasValue)
                q = q.Where(x => x.CreatedAt >= from.Value.Date);
            if (to.HasValue)
                q = q.Where(x => x.CreatedAt < to.Value.Date.AddDays(1));

            var list = await q.OrderByDescending(x => x.CreatedAt)
                .Take(500)
                .Select(x => new
                {
                    x.ID,
                    x.EntityName,
                    x.Action,
                    x.EntityId,
                    x.UserName,
                    x.IpAddress,
                    x.Changes,
                    CreatedAt = x.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")
                })
                .ToListAsync();
            return Json(list);
        }
    }
}
