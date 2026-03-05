namespace API.Models
{
    public class PosSaleItem
    {
        public int ProductID { get; set; }
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }

    public class PosSaleRequest
    {
        public int? CustomerID { get; set; }
        public DateTime Date { get; set; } = DateTime.Now;
        public List<PosSaleItem> Items { get; set; } = new();
        public string PaymentType { get; set; } // Full, DP, Piutang
        public decimal TenderAmount { get; set; } // uang diterima
    }
}
