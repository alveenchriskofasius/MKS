namespace Marketplace.Models
{
    public class CartItem
    {
        public int ProductID { get; set; }
        public string ProductName { get; set; } = "";
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        public decimal Subtotal => UnitPrice * Quantity;
    }

    public class CartViewModel
    {
        public List<CartItem> Items { get; set; } = new();
        public decimal Total => Items.Sum(i => i.Subtotal);
    }
}
