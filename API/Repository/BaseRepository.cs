using API.Context.Table;

namespace API.Repository
{
    public abstract class BaseRepository
    {
        protected readonly MKSTableContext _context;
        protected readonly IHttpContextAccessor _httpContextAccessor;

        protected BaseRepository(MKSTableContext context, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        protected string GetCurrentUserName()
        {
            return _httpContextAccessor?.HttpContext?.User?.Identity?.Name;
        }

        protected object CreateErrorResponse(Exception e) => new { success = false, result = e.Message };

        protected async Task<int> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync();
        }
    }
}
