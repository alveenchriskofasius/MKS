namespace API.Models;

public class SalesInvoiceModel
{
    public int ID { get; set; }
    public DateTime Date { get; set; } = DateTime.Now.Date;
    public string No { get; set; }
    public int? CustomerID { get; set; }
    public short? StatusID { get; set; }
    public decimal Amount { get; set; }
    public decimal PaidAmount { get; set; }
    public string Note { get; set; }
    public int? SalesOrderID { get; set; }
}

public class SalesInvoiceListItem
{
    public int ID { get; set; }
    public string No { get; set; }
    public DateTime Date { get; set; }
    public int? CustomerID { get; set; }
    public string CustomerName { get; set; }
    public decimal Amount { get; set; }
    public decimal PaidAmount { get; set; }
    public short? StatusID { get; set; }
}
