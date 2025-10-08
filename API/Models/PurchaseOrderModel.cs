namespace API.Models
{
    public class PurchaseOrderModel
    {
        public int ID { get; set; }
        public DateTime Date { get; set; } = DateTime.Now;
        public short? StatusID { get; set; }
        public string No { get; set; }
        public int? SupplierID { get; set; }
        public decimal Amount { get; set; }
        public string Note { get; set; }
        public bool IsApproved { get; set; }
        public List<PurchaseOrderDetailModel> PurchaseOrderDetails { get; set; } = new();
    }
}
