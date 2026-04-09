namespace API.Models
{
    public class MarketplaceCheckoutModel
    {
        public int CustomerID { get; set; }
        public string? Note { get; set; }
        public string PaymentMethod { get; set; } = "qris";
        public string DeliveryMethod { get; set; } = "pickup";
        public List<MarketplaceCheckoutItem> Items { get; set; } = new();
    }

    public class MarketplaceCheckoutItem
    {
        public int ProductID { get; set; }
        public string ProductName { get; set; } = "";
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Subtotal => UnitPrice * Quantity;
        public int? VariantID { get; set; }
        public string? VariantName { get; set; }
    }

    public class MarketplaceOrderSummary
    {
        public int OrderID { get; set; }
        public string OrderNo { get; set; } = "";
        public DateTime Date { get; set; }
        public decimal Amount { get; set; }
        public string Status { get; set; } = "";
        public short? StatusID { get; set; }
        public bool IsPaid { get; set; }
        public bool IsCancelled { get; set; }
        public bool IsCompleted { get; set; }
        public string? PaymentMethod { get; set; }
        public string? DeliveryMethod { get; set; }
        public string? Note { get; set; }
        public List<MarketplaceOrderItem> Items { get; set; } = new();
    }

    public class MarketplaceOrderItem
    {
        public int ProductID { get; set; }
        public string ProductName { get; set; } = "";
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Subtotal { get; set; }
        public int? VariantID { get; set; }
        public string? VariantName { get; set; }
    }
}
