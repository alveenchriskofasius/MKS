using API.Context.Table;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MitraKaryaSystem.Controllers;

[Authorize]
public class QrisController : Controller
{
    private readonly IMidtransService _midtrans;
    private readonly MKSTableContext _db;
    private readonly ILogger<QrisController> _log;

    public QrisController(IMidtransService midtrans, MKSTableContext db, ILogger<QrisController> log)
    {
        _midtrans = midtrans;
        _db = db;
        _log = log;
    }

    /// <summary>Generate QRIS for a trade (Sales Order / POS)</summary>
    [HttpPost]
    public async Task<JsonResult> Generate(int tradeId)
    {
        var trade = await _db.Trades.AsNoTracking().FirstOrDefaultAsync(t => t.ID == tradeId);
        if (trade == null) return Json(new { success = false, result = "Trade not found" });

        // Use trade No as base for order ID to ensure uniqueness
        var orderId = $"MKS-{trade.No}-{DateTime.Now:yyMMddHHmmss}";
        var amount = trade.Amount - (trade.PaidAmount ?? 0);
        if (amount <= 0) return Json(new { success = false, result = "No outstanding amount" });

        var result = await _midtrans.CreateQris(orderId, amount, $"Invoice {trade.No}");
        if (!result.Success)
            return Json(new { success = false, result = result.ErrorMessage });

        return Json(new
        {
            success = true,
            orderId = result.OrderId,
            qrCodeUrl = result.QrCodeUrl,
            amount
        });
    }

    /// <summary>Poll payment status (called from frontend)</summary>
    [HttpGet]
    public async Task<JsonResult> Status(string orderId)
    {
        var result = await _midtrans.CheckStatus(orderId);
        return Json(new
        {
            success = result.Success,
            status = result.TransactionStatus,
            paymentType = result.PaymentType,
            error = result.ErrorMessage
        });
    }

    /// <summary>Midtrans webhook callback (no auth required)</summary>
    [HttpPost]
    [AllowAnonymous]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> Notify()
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();
        _log.LogInformation("Midtrans webhook: {Body}", body);

        try
        {
            var doc = System.Text.Json.JsonDocument.Parse(body);
            var root = doc.RootElement;

            var orderId = root.GetProperty("order_id").GetString() ?? "";
            var statusCode = root.GetProperty("status_code").GetString() ?? "";
            var grossAmount = root.GetProperty("gross_amount").GetString() ?? "";
            var signatureKey = root.GetProperty("signature_key").GetString() ?? "";
            var txStatus = root.GetProperty("transaction_status").GetString() ?? "";

            // Validate signature
            if (!_midtrans.ValidateSignature(orderId, statusCode, grossAmount, signatureKey))
            {
                _log.LogWarning("Midtrans webhook signature invalid for {OrderId}", orderId);
                return Ok();
            }

            // Extract trade No from orderId format: MKS-{tradeNo}-{timestamp}
            var parts = orderId.Split('-');
            if (parts.Length < 2)
            {
                _log.LogWarning("Cannot parse trade No from orderId: {OrderId}", orderId);
                return Ok();
            }

            // Trade No is everything between first "MKS-" and last "-timestamp"
            var tradeNoPart = string.Join("-", parts.Skip(1).SkipLast(1));

            if (txStatus == "settlement" || txStatus == "capture")
            {
                var trade = await _db.Trades.FirstOrDefaultAsync(t => t.No == tradeNoPart);
                if (trade != null)
                {
                    var amount = decimal.Parse(grossAmount, System.Globalization.CultureInfo.InvariantCulture);
                    trade.PaidAmount = (trade.PaidAmount ?? 0) + amount;
                    if (trade.PaidAmount >= trade.Amount)
                    {
                        trade.StatusID = 2; // Paid
                        trade.Note = string.IsNullOrEmpty(trade.Note) ? "QRIS" : trade.Note + " | QRIS";
                    }
                    trade.UpdatedAt = DateTime.Now;
                    trade.UpdatedBy = "MIDTRANS";
                    await _db.SaveChangesAsync();
                    _log.LogInformation("Trade {No} paid via QRIS, amount {Amount}", tradeNoPart, amount);
                }
            }

            return Ok();
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Midtrans webhook processing failed");
            return Ok(); // Always return 200 to Midtrans
        }
    }
}
