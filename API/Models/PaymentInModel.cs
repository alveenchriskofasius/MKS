namespace API.Models;

public class PaymentInCreateRequest
{
    public DateTime Date { get; set; } = DateTime.Now.Date;
    public int? CustomerID { get; set; }
    public int? SalesOrderID { get; set; }
    public int? SalesInvoiceID { get; set; } // reserved for future use
    public string Method { get; set; } // Cash, Transfer, QRIS
    public string Type { get; set; } // DP, Full, Pelunasan
    public decimal Amount { get; set; }
    public string Note { get; set; }
    public bool Submit { get; set; } = true;
}

public class PaymentInDto
{
    public int ID { get; set; }
    public string No { get; set; }
    public DateTime Date { get; set; }
    public int? CustomerID { get; set; }
    public int? SalesOrderID { get; set; }
    public string Method { get; set; }
    public string Type { get; set; }
    public decimal Amount { get; set; }
    public string Note { get; set; }
    public short StatusID { get; set; }
}
