namespace API.Models;

public class PurchaseInvoiceModel
{
    public int ID { get; set; }
    public DateTime Date { get; set; } = DateTime.Now.Date;
    public string No { get; set; }
    public int? SupplierID { get; set; }
    public short? StatusID { get; set; }
    public decimal Amount { get; set; }
    public decimal PaidAmount { get; set; }
    public string Note { get; set; }
    public int? PurchaseOrderID { get; set; }
}

public class PurchaseInvoiceListItem
{
    public int ID { get; set; }
    public string No { get; set; }
    public string Date { get; set; }
    public int? SupplierID { get; set; }
    public string SupplierName { get; set; }
    public decimal Amount { get; set; }
    public decimal PaidAmount { get; set; }
    public short? StatusID { get; set; }
}
