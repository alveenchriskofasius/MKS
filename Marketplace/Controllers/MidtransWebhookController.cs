using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace Marketplace.Controllers
{
    [AllowAnonymous]
    [Route("api/midtrans")]
    public class MidtransWebhookController : Controller
    {
        private readonly IMarketplaceOrderService _orderService;
        private readonly IMidtransService _midtransService;
        private readonly ILogger<MidtransWebhookController> _logger;

        public MidtransWebhookController(
            IMarketplaceOrderService orderService,
            IMidtransService midtransService,
            ILogger<MidtransWebhookController> logger)
        {
            _orderService = orderService;
            _midtransService = midtransService;
            _logger = logger;
        }

        [HttpPost("notification")]
        public async Task<IActionResult> Notification()
        {
            string rawBody;
            using (var reader = new StreamReader(Request.Body))
            {
                rawBody = await reader.ReadToEndAsync();
            }

            _logger.LogInformation("Midtrans webhook received: {Body}", rawBody);

            try
            {
                var doc = JsonDocument.Parse(rawBody);
                var root = doc.RootElement;

                var orderId = root.GetProperty("order_id").GetString() ?? "";
                var statusCode = root.GetProperty("status_code").GetString() ?? "";
                var grossAmount = root.GetProperty("gross_amount").GetString() ?? "";
                var signatureKey = root.GetProperty("signature_key").GetString() ?? "";
                var transactionStatus = root.GetProperty("transaction_status").GetString() ?? "";

                // Verify signature
                if (!_midtransService.ValidateSignature(orderId, statusCode, grossAmount, signatureKey))
                {
                    _logger.LogWarning("Invalid Midtrans signature for order {OrderId}", orderId);
                    return BadRequest("Invalid signature");
                }

                // Process settlement/capture
                if (transactionStatus is "settlement" or "capture")
                {
                    // Extract order number from midtrans order id
                    // Format: MKT-{OrderNo}-{timestamp}
                    var parts = orderId.Split('-', 3);
                    if (parts.Length >= 2)
                    {
                        var orderNo = parts[1];
                        var result = await _orderService.MarkOrderPaidByNo(orderNo);
                        _logger.LogInformation("Webhook MarkOrderPaid for {OrderNo}: {Result}",
                            orderNo, JsonSerializer.Serialize(result));
                    }
                }
                else
                {
                    _logger.LogInformation("Webhook status {Status} for {OrderId} - no action taken",
                        transactionStatus, orderId);
                }

                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Midtrans webhook");
                return StatusCode(500);
            }
        }
    }
}
