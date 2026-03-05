namespace MitraKaryaSystem.Models
{
    public class ProductModel
    {
        public int ID { get; set; }
        public string? Name { get; set; }
        public byte CategoryID { get; set; }
        public short UnitID { get; set; }
        public string? Description { get; set; }
        public decimal UnitPrice { get; set; }
        public int StockQuantity { get; set; }
        public int? LowStockThreshold { get; set; }
        public short SupplierID { get; set; }
        public string? Barcode { get; set; }
    }
}
