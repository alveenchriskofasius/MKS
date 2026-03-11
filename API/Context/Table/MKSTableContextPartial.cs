using Microsoft.EntityFrameworkCore;

namespace API.Context.Table;

public partial class MKSTableContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        // All entity configurations are now in the auto-generated MKSTableContext.cs
        // via EF Core Power Tools reverse engineering.
    }
}
