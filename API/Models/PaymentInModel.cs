using System.ComponentModel.DataAnnotations;

namespace API.Models;

public class PaymentInCreateRequest : IValidatableObject
{
    public DateTime Date { get; set; } = DateTime.Now.Date;
    public int? CustomerID { get; set; }
    public int? SalesOrderID { get; set; }
    public int? SalesInvoiceID { get; set; } // reserved for future use

    // Cash, Transfer, QRIS
    [Required]
    public string Method { get; set; }

    // DP, Full, Pelunasan
    public string Type { get; set; }

    [Range(typeof(decimal), "0.01", "79228162514264337593543950335", ErrorMessage = "Amount must be greater than zero")]
    public decimal Amount { get; set; }
    public string Note { get; set; }
    public bool Submit { get; set; } = true;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (SalesOrderID is null && SalesInvoiceID is null)
        {
            yield return new ValidationResult("Either SalesOrderID or SalesInvoiceID is required", new[] { nameof(SalesOrderID), nameof(SalesInvoiceID) });
        }

        // Optional: enforce limited set for Method and Type without breaking existing data.
        var allowedMethods = new[] { "Cash", "Transfer", "QRIS" };
        if (!string.IsNullOrWhiteSpace(Method) && Array.IndexOf(allowedMethods, Method) < 0)
        {
            yield return new ValidationResult($"Method must be one of: {string.Join(", ", allowedMethods)}", new[] { nameof(Method) });
        }

        var allowedTypes = new[] { "DP", "Full", "Pelunasan" };
        if (!string.IsNullOrWhiteSpace(Type) && Array.IndexOf(allowedTypes, Type) < 0)
        {
            yield return new ValidationResult($"Type must be one of: {string.Join(", ", allowedTypes)}", new[] { nameof(Type) });
        }
    }
}

public class PaymentInDto
{
    public int ID { get; set; }
    public string No { get; set; }
    public DateTime Date { get; set; }
    public int? CustomerID { get; set; }
    public int? SalesOrderID { get; set; }
    public int? SalesInvoiceID { get; set; }
    public string Method { get; set; }
    public string Type { get; set; }
    public decimal Amount { get; set; }
    public string Note { get; set; }
    public short StatusID { get; set; }
}
