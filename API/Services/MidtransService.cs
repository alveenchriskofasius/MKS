using API.Services.Interfaces;
using Microsoft.Extensions.Options;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace API.Services;

public class MidtransService : IMidtransService
{
    private readonly MidtransSettings _cfg;
    private readonly HttpClient _http;
    private readonly ILogger<MidtransService> _log;

    public MidtransService(IOptions<MidtransSettings> cfg, IHttpClientFactory httpFactory, ILogger<MidtransService> log)
    {
        _cfg = cfg.Value;
        _http = httpFactory.CreateClient("Midtrans");
        _log = log;

        // Set base auth header
        var authBytes = Encoding.ASCII.GetBytes($"{_cfg.ServerKey}:");
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<MidtransQrisResult> CreateQris(string orderId, decimal amount, string productSummary)
    {
        var payload = new
        {
            payment_type = "qris",
            transaction_details = new
            {
                order_id = orderId,
                gross_amount = (long)Math.Ceiling(amount) // Midtrans expects integer
            },
            item_details = new[]
            {
                new { id = "ITEMS", price = (long)Math.Ceiling(amount), quantity = 1, name = Truncate(productSummary, 50) }
            }
        };

        try
        {
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _http.PostAsync($"{_cfg.BaseUrl}/charge", content);
            var body = await response.Content.ReadAsStringAsync();

            _log.LogInformation("Midtrans QRIS charge response: {Status} {Body}", response.StatusCode, body);

            var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            var statusCode = root.GetProperty("status_code").GetString();
            if (statusCode == "201") // Created = pending
            {
                // Find the QR URL from actions array
                var qrUrl = string.Empty;
                if (root.TryGetProperty("actions", out var actions))
                {
                    foreach (var action in actions.EnumerateArray())
                    {
                        if (action.GetProperty("name").GetString() == "generate-qr-code")
                        {
                            qrUrl = action.GetProperty("url").GetString() ?? string.Empty;
                            break;
                        }
                    }
                }

                return new MidtransQrisResult
                {
                    Success = true,
                    OrderId = orderId,
                    QrCodeUrl = qrUrl
                };
            }

            var msg = root.TryGetProperty("status_message", out var sm) ? sm.GetString() : "Unknown error";
            return new MidtransQrisResult { Success = false, ErrorMessage = msg ?? "Failed" };
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Midtrans QRIS charge failed for {OrderId}", orderId);
            return new MidtransQrisResult { Success = false, ErrorMessage = ex.Message };
        }
    }

    public async Task<MidtransStatusResult> CheckStatus(string orderId)
    {
        try
        {
            var response = await _http.GetAsync($"{_cfg.BaseUrl}/{orderId}/status");
            var body = await response.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            var txStatus = root.TryGetProperty("transaction_status", out var ts) ? ts.GetString() : "unknown";
            var payType = root.TryGetProperty("payment_type", out var pt) ? pt.GetString() : "";

            return new MidtransStatusResult
            {
                Success = true,
                OrderId = orderId,
                TransactionStatus = txStatus ?? "unknown",
                PaymentType = payType ?? ""
            };
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Midtrans status check failed for {OrderId}", orderId);
            return new MidtransStatusResult { Success = false, ErrorMessage = ex.Message };
        }
    }

    public bool ValidateSignature(string orderId, string statusCode, string grossAmount, string signatureKey)
    {
        var raw = orderId + statusCode + grossAmount + _cfg.ServerKey;
        var hash = SHA512.HashData(Encoding.UTF8.GetBytes(raw));
        var computed = Convert.ToHexString(hash).ToLowerInvariant();
        return string.Equals(computed, signatureKey, StringComparison.OrdinalIgnoreCase);
    }

    private static string Truncate(string value, int maxLength)
        => string.IsNullOrEmpty(value) ? "Items" : value.Length <= maxLength ? value : value[..maxLength];
}
