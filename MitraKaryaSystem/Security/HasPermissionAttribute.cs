using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace MitraKaryaSystem.Security
{
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true, Inherited = true)]
    public sealed class HasPermissionAttribute : Attribute, IAsyncAuthorizationFilter
    {
        private readonly string _permissionName;

        public HasPermissionAttribute(string permissionName)
        {
            _permissionName = permissionName ?? string.Empty;
        }

        public Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            var user = context.HttpContext.User;

            // If not authenticated, redirect to login
            if (user?.Identity?.IsAuthenticated != true)
            {
                context.Result = new RedirectToActionResult("Login", "Auth", null);
                return Task.CompletedTask;
            }

            var required = _permissionName;
            if (string.IsNullOrWhiteSpace(required))
            {
                // default to controller name if not provided
                required = context.RouteData.Values["controller"]?.ToString() ?? string.Empty;
            }

            // Case-insensitive comparison on claim type "Permission"
            var hasPermission = user.Claims.Any(c => string.Equals(c.Type, "Permission", StringComparison.OrdinalIgnoreCase)
                                                     && string.Equals(c.Value, required, StringComparison.OrdinalIgnoreCase));

            if (!hasPermission)
            {
                // For AJAX/API requests, return JSON 403 instead of HTML redirect
                var request = context.HttpContext.Request;
                bool isAjax = request.Headers["X-Requested-With"] == "XMLHttpRequest"
                    || (request.Headers["Accept"].ToString().Contains("application/json"));
                if (isAjax)
                {
                    context.Result = new JsonResult(new { success = false, error = "You don't have permission to perform this action." })
                    {
                        StatusCode = 403
                    };
                }
                else
                {
                    context.Result = new RedirectToActionResult("AccessDenied", "Auth", null);
                }
            }

            return Task.CompletedTask;
        }
    }
}
