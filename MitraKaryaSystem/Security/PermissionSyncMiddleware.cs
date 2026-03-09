using API.Context.SP;
using API.Context.Table;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;

namespace MitraKaryaSystem.Security
{
    /// <summary>
    /// Middleware that keeps permission claims in sync with the database.
    /// When an admin changes role permissions the global "PermVer" is bumped;
    /// this middleware detects the mismatch and re-issues the auth cookie with
    /// fresh permission claims so the user does not need to re-login.
    /// </summary>
    public class PermissionSyncMiddleware
    {
        private readonly RequestDelegate _next;

        public PermissionSyncMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, IMemoryCache cache, MKSSPContextProcedures sp, MKSTableContext db)
        {
            // Skip permission refresh on auth endpoints to prevent cookie collision
            // (e.g. admin cookie getting re-issued right before driver login replaces it)
            if (context.Request.Path.StartsWithSegments("/Auth"))
            {
                await _next(context);
                return;
            }

            if (context.User?.Identity?.IsAuthenticated == true)
            {
                var cookieVer = context.User.FindFirst("PermVer")?.Value ?? "";
                var globalVer = cache.Get<string>("PermVer") ?? "0";

                if (cookieVer != globalVer)
                {
                    // Try "Username" claim first (new cookies), fall back to DB lookup (legacy cookies)
                    var userName = context.User.FindFirst("Username")?.Value;
                    if (string.IsNullOrEmpty(userName))
                    {
                        var userIdStr = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                        if (int.TryParse(userIdStr, out var userId) && userId > 0)
                        {
                            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.ID == userId);
                            userName = user?.UserName;
                        }
                    }

                    if (!string.IsNullOrEmpty(userName))
                    {
                        var perms = await sp.uspGetUserPermissionListAsync(userName);

                        // Rebuild claims: keep everything except Permission, PermVer, and Role
                        // (all three can change when an admin reassigns a user to a different role)
                        var claims = context.User.Claims
                            .Where(c => !string.Equals(c.Type, "Permission", StringComparison.OrdinalIgnoreCase)
                                     && !string.Equals(c.Type, "PermVer", StringComparison.OrdinalIgnoreCase)
                                     && !string.Equals(c.Type, ClaimTypes.Role, StringComparison.OrdinalIgnoreCase))
                            .ToList();

                        // Ensure "Username" claim exists (for legacy cookies that lack it)
                        if (!claims.Any(c => c.Type == "Username"))
                            claims.Add(new Claim("Username", userName));

                        // Refresh role claim from DB (UserRole → Role)
                        var userIdStr = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                        if (int.TryParse(userIdStr, out var uid) && uid > 0)
                        {
                            var roleNames = await db.UserRoles
                                .Where(ur => ur.UserID == uid)
                                .Join(db.Roles, ur => ur.RoleID, r => r.ID, (ur, r) => r.Name)
                                .ToListAsync();
                            foreach (var rn in roleNames)
                                claims.Add(new Claim(ClaimTypes.Role, rn));
                        }

                        if (perms != null)
                            claims.AddRange(perms.Select(p => new Claim("Permission", p.Name)));

                        claims.Add(new Claim("PermVer", globalVer));

                        var identity = new ClaimsIdentity(claims, "AuthScheme");
                        var principal = new ClaimsPrincipal(identity);

                        await context.SignInAsync("AuthScheme", principal,
                            new AuthenticationProperties { IsPersistent = true });

                        // Replace principal for the current request so sidebar & filters see fresh claims
                        context.User = principal;
                    }
                }
            }

            await _next(context);
        }
    }
}
