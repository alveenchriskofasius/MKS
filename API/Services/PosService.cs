using API.Context.SP;
using API.Context.Table;
using API.Models;
using API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Services
{
    public class PosService : IPosService
    {
        private readonly MKSTableContext _ctx;
        private readonly MKSSPContextProcedures _sp;
        private readonly IHttpContextAccessor _http;
        public PosService(MKSTableContext ctx, MKSSPContextProcedures sp, IHttpContextAccessor http) { _ctx = ctx; _sp = sp; _http = http; }

        // Use TradeTypeID = 9 for POS (custom) if available; else fallback to 2 but separate numbering prefix POS
        private const short PosTradeTypeId = 2; // re-use base trade type semantics for stock & payment fields
        private const decimal TaxRate = 0.10m; // 10% tax — must match frontend Pos.js state.taxRate
        public async Task<object> Save(PosSaleRequest req)
        {
            if (req.Items == null || req.Items.Count == 0) return new { success = false, result = "Items empty" };

            // Increase command timeout for POS batch operation to avoid transient timeouts
            var prevTimeout = _ctx.Database.GetCommandTimeout();
            _ctx.Database.SetCommandTimeout(120);

            try
            {
                // Batch fetch products
                var ids = req.Items.Select(i => i.ProductID).Distinct().ToList();
                var products = await _ctx.Products.Where(p => ids.Contains(p.ID)).ToListAsync();
                if (products.Count != ids.Count)
                {
                    var missing = string.Join(",", ids.Except(products.Select(p => p.ID)));
                    return new { success = false, result = $"Product not found: {missing}" };
                }

                // Sum quantities per product (handle duplicates)
                var qtyMap = req.Items
                    .GroupBy(i => i.ProductID)
                    .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));

                // Validate stock and compute subtotal by product.UnitPrice
                decimal subtotal = 0m;
                foreach (var p in products)
                {
                    var needQty = qtyMap[p.ID];
                    if (p.StockQuantity < needQty)
                    {
                        return new { success = false, result = $"Insufficient stock for {p.Name}" };
                    }
                    subtotal += (p.UnitPrice) * needQty;
                }

                var tax = subtotal * TaxRate;
                var total = subtotal + tax;

                // generate POS number with prefix PS (Point Sale)
                var gen = await _sp.uspGenerateNoAsync("PS", DateTime.Now.Date);
                var no = gen.FirstOrDefault()?.NewNumber ?? $"PS{DateTime.Now:yyMMddHHmmss}";
                var user = _http.HttpContext?.User?.Identity?.Name ?? "system";

                using var tx = await _ctx.Database.BeginTransactionAsync();

                var trade = new Trade
                {
                    Date = req.Date.Date,
                    No = no,
                    CustomerID = (req.CustomerID.HasValue && req.CustomerID.Value == 0) ? null : req.CustomerID,
                    TradeTypeID = PosTradeTypeId,
                    Amount = total,
                    CreatedBy = user,
                    CreatedAt = DateTime.Now,
                    UpdatedBy = user,
                    UpdatedAt = DateTime.Now,
                    StatusID = 1,
                    Note = "POS"
                };
                _ctx.Trades.Add(trade);
                await _ctx.SaveChangesAsync(); // need Trade.ID

                // Prepare SalesOrderItems in batch
                var itemsToAdd = new List<SalesOrderItem>(req.Items.Count);
                foreach (var it in req.Items)
                {
                    itemsToAdd.Add(new SalesOrderItem
                    {
                        TradeID = trade.ID,
                        ProductID = it.ProductID,
                        Quantity = it.Quantity,
                        QtyRefunded = 0,
                        QtyExchanged = 0
                    });
                }
                _ctx.SalesOrderItems.AddRange(itemsToAdd);

                // Apply stock deduction in-memory and mark modified
                foreach (var p in products)
                {
                    var needQty = qtyMap[p.ID];
                    p.StockQuantity -= needQty;
                    _ctx.Products.Update(p);
                }

                await _ctx.SaveChangesAsync(); // persist items and stock updates

                // payment logic (store PaymentIn if Full or DP)
                decimal paidApplied = 0m;
                if (!string.Equals(req.PaymentType, "Piutang", StringComparison.OrdinalIgnoreCase))
                {
                    decimal targetPay = total;
                    decimal tender = req.TenderAmount;
                    if (string.Equals(req.PaymentType, "DP", StringComparison.OrdinalIgnoreCase))
                    {
                        targetPay = Math.Min(tender, total);
                    }
                    paidApplied = Math.Min(targetPay, total);
                    var payNoGen = await _sp.uspGenerateNoAsync("RCPT", req.Date);
                    var payNo = payNoGen.FirstOrDefault()?.NewNumber ?? $"RCPT{DateTime.Now:yyMMddHHmmss}";
                    var payment = new PaymentIn
                    {
                        No = payNo,
                        Date = req.Date.Date,
                        CustomerID = trade.CustomerID,
                        SalesOrderID = trade.ID,
                        Method = "Cash",
                        Type = string.Equals(req.PaymentType, "Full", StringComparison.OrdinalIgnoreCase) ? "Full" : "DP",
                        Amount = paidApplied,
                        Note = "POS",
                        StatusID = 2,
                        CreatedAt = DateTime.Now,
                        CreatedBy = user,
                        UpdatedAt = DateTime.Now,
                        UpdatedBy = user
                    };
                    _ctx.PaymentIns.Add(payment);
                    trade.PaidAmount = paidApplied;
                    if (paidApplied >= total) trade.StatusID = 2; // Paid
                    else if (paidApplied > 0 && paidApplied < total) trade.StatusID = 3; // Debt
                }
                else
                {
                    trade.StatusID = 3; // Debt
                }

                _ctx.Trades.Update(trade);
                await _ctx.SaveChangesAsync();
                await tx.CommitAsync();

                decimal change = 0m;
                if (req.TenderAmount > paidApplied && paidApplied > 0) change = req.TenderAmount - paidApplied;
                return new { success = true, id = trade.ID, no = trade.No, amount = trade.Amount, paid = trade.PaidAmount, statusID = trade.StatusID, change };
            }
            catch (Exception ex)
            {
                return new { success = false, result = ex.Message };
            }
            finally
            {
                // restore previous timeout
                _ctx.Database.SetCommandTimeout(prevTimeout);
            }
        }
    }
}
