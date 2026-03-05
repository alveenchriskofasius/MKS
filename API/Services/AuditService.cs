using API.Context.Table;
using System.Text.Json;

namespace API.Services;

public interface IAuditService
{
    Task WriteAsync(string entityName, string action, string? entityId = null, object? changes = null);
}

public sealed class AuditService : IAuditService
{
    private readonly MKSTableContext _context;
    private readonly IHttpContextAccessor _http;

    public AuditService(MKSTableContext context, IHttpContextAccessor http)
    {
        _context = context;
        _http = http;
    }

    public async Task WriteAsync(string entityName, string action, string? entityId = null, object? changes = null)
    {
        var user = _http.HttpContext?.User?.Identity?.Name;
        var ip = _http.HttpContext?.Connection?.RemoteIpAddress?.ToString();

        var log = new AuditLog
        {
            EntityName = entityName,
            Action = action,
            EntityId = entityId,
            UserName = user,
            IpAddress = ip,
            Changes = changes == null ? null : JsonSerializer.Serialize(changes),
            CreatedAt = DateTime.Now
        };

        await _context.AuditLogs.AddAsync(log);
        await _context.SaveChangesAsync();
    }
}
