namespace API.Models;

public class PurchaseReturnModel
{
    public int ID { get; set; }
    public DateTime Date { get; set; } = DateTime.Now.Date;
    public string No { get; set; }
    public int SupplierID { get; set; }
    public string Note { get; set; }
    public decimal Amount { get; set; }
    public List<PurchaseReturnDetailModel> Details { get; set; } = new();
}
public class PurchaseReturnDetailModel
{
    public int ID { get; set; }
    public int ProductID { get; set; }
    public string ProductName { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Subtotal => UnitPrice * Quantity;
}
