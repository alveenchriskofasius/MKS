﻿using API.Context.SP;
using API.Context.Table;
using API.Repository.Interfaces;
using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;

namespace API.Repository
{
    public class AuthRepository : IAuthRepository
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly MKSTableContext _db;
        private readonly MKSSPContextProcedures _sp;
        public AuthRepository(MKSTableContext db, IHttpContextAccessor contextAccessor, MKSSPContextProcedures sp)
        {
            _httpContextAccessor = contextAccessor;
            _db = db;
            _sp = sp;
        }
        public async Task<bool> Login(string username, string password)
        {
            var users = await _sp.uspUserLoginAsync(username, password);
            uspUserLoginResult? uspUserLogin = users.FirstOrDefault();
            var isLogin = users.Count > 0;
            if (isLogin)
            {
                var claims = new[]
                {
                            new Claim(ClaimTypes.Name, uspUserLogin?.Name),
                            new Claim(ClaimTypes.Role, uspUserLogin?.RoleName),
                };

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
