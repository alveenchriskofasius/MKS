namespace API.Services.Interfaces;

public interface IMidtransService
{
    /// <summary>Generate QRIS payment and return QR code URL + order id</summary>
    Task<MidtransQrisResult> CreateQris(string orderId, decimal amount, string productSummary);

    /// <summary>Check transaction status by order id</summary>
    Task<MidtransStatusResult> CheckStatus(string orderId);

    /// <summary>Validate notification signature from Midtrans webhook</summary>
    bool ValidateSignature(string orderId, string statusCode, string grossAmount, string signatureKey);
}

public class MidtransQrisResult
{
    public bool Success { get; set; }
    public string OrderId { get; set; } = string.Empty;
    public string QrCodeUrl { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
}

public class MidtransStatusResult
{
    public bool Success { get; set; }
    public string OrderId { get; set; } = string.Empty;
    public string TransactionStatus { get; set; } = string.Empty; // settlement, pending, expire, cancel, deny
    public string PaymentType { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
}
