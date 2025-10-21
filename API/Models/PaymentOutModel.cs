using System.ComponentModel.DataAnnotations;

namespace API.Models;

public enum PaymentStatus
{
    Draft = 1,
    Submitted = 2,
    Paid = 3,
    Canceled = 4
}

public class PaymentOutCreateRequest
{
    public DateTime Date { get; set; } = DateTime.Now.Date;
    public int? SupplierID { get; set; }
    public int? PurchaseOrderID { get; set; }

    // Use string to simplify JSON binding from client
    public string Method { get; set; } = "Cash"; // Cash, Transfer, Deposit, Adjustment

    // Legacy "Type" kept as free-form to preserve existing flows (e.g., "Payment", "Refund", "Full")
    public string Type { get; set; }

    [Range(typeof(decimal), "0.01", "999999999999.99", ErrorMessage = "Amount must be greater than zero")]
    public decimal Amount { get; set; }

    public string Note { get; set; }
    public bool Submit { get; set; } = true;

    // Optional reference number for transfer receipts, etc.
    public string ReferenceNo { get; set; }
}

public class PaymentOutDto
{
    public int ID { get; set; }
    public string No { get; set; }
    public DateTime Date { get; set; }
    public int? SupplierID { get; set; }
    public int? PurchaseOrderID { get; set; }
    public string Method { get; set; }
    public string Type { get; set; }
    public decimal Amount { get; set; }
    public string Note { get; set; }
    public short StatusID { get; set; }
    public string ReferenceNo { get; set; }
}
