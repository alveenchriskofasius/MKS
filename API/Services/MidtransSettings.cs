namespace API.Services;

public class MidtransSettings
{
    public string MerchantId { get; set; } = string.Empty;
    public string ClientKey { get; set; } = string.Empty;
    public string ServerKey { get; set; } = string.Empty;
    public bool IsProduction { get; set; }
    public string BaseUrl => IsProduction
        ? "https://api.midtrans.com/v2"
        : "https://api.sandbox.midtrans.com/v2";
}
