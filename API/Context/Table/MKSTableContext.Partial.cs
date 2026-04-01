using Microsoft.EntityFrameworkCore;

namespace API.Context.Table;

public partial class MKSTableContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<MarketplaceAccount>(entity =>
        {
            entity.Property(e => e.WishlistJson).HasColumnName("WishlistJson");
        });
    }
}
