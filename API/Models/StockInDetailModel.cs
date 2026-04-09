namespace MitraKaryaSystem.Models
{
    public class StockInDetailModel
    {
        public int ID { get; set; }
        public int? ProductID { get; set; }
        public int? VariantID { get; set; }
        public int Quantity { get; set; }
    }
}
