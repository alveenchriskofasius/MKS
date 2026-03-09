using API.Context.SP;
using API.Context.Table;
using API.Repository.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;

namespace API.Repository
{
    public class AuthRepository : IAuthRepository
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly MKSTableContext _db;
        private readonly MKSSPContextProcedures _sp;
        private readonly IMemoryCache _cache;
        public AuthRepository(MKSTableContext db, IHttpContextAccessor contextAccessor, MKSSPContextProcedures sp, IMemoryCache cache)
        {
            _httpContextAccessor = contextAccessor;
            _db = db;
            _sp = sp;
            _cache = cache;
        }
        public async Task<bool> Login(string username, string password)
        {
            var users = await _sp.uspUserLoginAsync(username, password);
            uspUserLoginResult? uspUserLogin = users.FirstOrDefault();
            var isLogin = users.Count > 0;
            if (isLogin)
            {
                // Load permissions via SP (User → UserRole → RolePermission → Permission)
                var perms = await _sp.uspGetUserPermissionListAsync(username);
                var permissionClaims = perms?.Select(p => new Claim("Permission", p.Name)) ?? Enumerable.Empty<Claim>();

                var permVer = _cache.Get<string>("PermVer") ?? "0";

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, (uspUserLogin?.ID ?? 0).ToString()),
                    new Claim(ClaimTypes.Name, uspUserLogin?.Name ?? username),
                    new Claim("Username", username),
                    new Claim("PermVer", permVer),
                };

                if (!string.IsNullOrEmpty(uspUserLogin?.RoleName))
                {
                    claims.Add(new Claim(ClaimTypes.Role, uspUserLogin.RoleName));
                }

                claims.AddRange(permissionClaims);

                // Create the identity and principal
                var identity = new ClaimsIdentity(claims, "AuthScheme");
                var principal = new ClaimsPrincipal(identity);

                // Create authentication properties as needed
                var authenticationProperties = new AuthenticationProperties
                {
                    IsPersistent = true // You can set this based on your requirements
                };

                // Create the authentication ticket
                var ticket = new AuthenticationTicket(principal, "MKS");
                // Sign in the user using the specified scheme
                await _httpContextAccessor.HttpContext.SignInAsync("AuthScheme", principal, authenticationProperties);
                AuthenticateResult.Success(ticket);
            }
            return isLogin;
        }
    }
}
