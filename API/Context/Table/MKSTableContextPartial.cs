using Microsoft.EntityFrameworkCore;

namespace API.Context.Table;

public partial class MKSTableContext
{
    // Temporary DbSet – will move to auto-generated file after Power Tools regeneration
    public virtual DbSet<SalesPerson> SalesPersons { get; set; }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SalesPerson>(entity =>
        {
            entity.HasKey(e => e.ID).HasName("PK_SalesPerson");
            entity.ToTable("SalesPerson");
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Company).HasMaxLength(200);
            entity.Property(e => e.Contact).HasMaxLength(100);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.HasIndex(e => e.SupplierID).HasDatabaseName("IX_SalesPerson_SupplierID");
        });
    }
}
