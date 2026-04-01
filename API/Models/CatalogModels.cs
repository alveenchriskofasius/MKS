namespace API.Models
{
    public class CatalogProductItem
    {
        public int ID { get; set; }
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public string CategoryName { get; set; } = "";
        public string UnitName { get; set; } = "";
        public decimal UnitPrice { get; set; }
        public int StockQuantity { get; set; }
        public bool HasDiscount { get; set; }
        public decimal DiscountPercentage { get; set; }
        public string? ImageUrl { get; set; }
        public string? PromoName { get; set; }
        public DateTime? PromoEndDate { get; set; }
        public decimal FinalPrice => HasDiscount
            ? UnitPrice - (UnitPrice * DiscountPercentage / 100)
            : UnitPrice;
    }

    public class CatalogCategoryItem
    {
        public int ID { get; set; }
        public string Name { get; set; } = "";
    }

    public class CatalogProductDetail
    {
        public int ID { get; set; }
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public string CategoryName { get; set; } = "";
        public string UnitName { get; set; } = "";
        public decimal UnitPrice { get; set; }
        public int StockQuantity { get; set; }
        public bool HasDiscount { get; set; }
        public decimal DiscountPercentage { get; set; }
        public string? ImageUrl { get; set; }
        public string? PromoName { get; set; }
        public DateTime? PromoEndDate { get; set; }
        public decimal FinalPrice => HasDiscount
            ? UnitPrice - (UnitPrice * DiscountPercentage / 100)
            : UnitPrice;
        public bool InStock => StockQuantity > 0;
    }
}
