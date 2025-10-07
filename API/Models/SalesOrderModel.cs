namespace API.Models
{
    public class SalesOrderModel
    {
        public int ID { get; set; }

        public DateTime Date { get; set; } = DateTime.Now;

        public short? StatusID { get; set; }
        public string No { get; set; }
        public int? CustomerID { get; set; }
        public decimal Amount { get; set; }
        public string Note { get; set; }
        public bool IsPaid { get; set; }

        public List<SalesOrderDetailModel> SalesOrderDetails { get; set; } = new List<SalesOrderDetailModel>();
    }
}
