namespace API.Models;

public class SalesReturnModel
{
    public int ID { get; set; }
    public DateTime Date { get; set; } = DateTime.Now.Date;
    public string No { get; set; }
    public int CustomerID { get; set; }
    public string Note { get; set; }
    public string ReturnType { get; set; } = "Refund"; // Refund | Exchange
    public bool ReturnOriginalToStock { get; set; } = true; // for Exchange policy toggle
    public decimal RefundAmount { get; set; } // cash given back (Refund) or difference (Exchange)
    public decimal Amount { get; set; }
    public bool IsLinked { get; set; } // Linked to Sales Order
    public int? LinkedSalesOrderID { get; set; }
    public List<SalesReturnDetailModel> Details { get; set; } = new();
    public List<SalesReturnDetailModel> ReplacementDetails { get; set; } = new(); // only when Exchange
}
public class SalesReturnDetailModel
{
    public int ID { get; set; }
    public int ProductID { get; set; }
    public string ProductName { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public bool IsReplacement { get; set; } // differentiate
    public int? ExchangeSourceItemID { get; set; }
    public decimal RefundAmount { get; set; }
    public int? SourceSalesOrderItemID { get; set; }
    public decimal Subtotal => UnitPrice * Quantity;
}
