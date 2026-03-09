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
        private const decimal TaxRate = 0.11m; // 11% tax — must match frontend Pos.js state.taxRate
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

                // Validate stock and compute subtotal by product.UnitPrice (with discount)
                decimal subtotal = 0m;
                foreach (var p in products)
                {
                    var needQty = qtyMap[p.ID];
                    if (p.StockQuantity < needQty)
                    {
                        return new { success = false, result = $"Insufficient stock for {p.Name}" };
                    }
                    var price = p.UnitPrice;
                    if (p.HasDiscount && p.DiscountPercentage > 0)
                        price = price - (price * p.DiscountPercentage / 100m);
                    subtotal += price * needQty;
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

        public async Task<object> GetHistory()
        {
            var list = await (
                from t in _ctx.Trades.AsNoTracking()
                where t.TradeTypeID == PosTradeTypeId && t.Note == "POS"
                join c in _ctx.Customers.AsNoTracking() on t.CustomerID equals c.ID into cg
                from cust in cg.DefaultIfEmpty()
                join l in _ctx.Lookups.Where(x => x.Entity == "SalesOrderStatus").AsNoTracking() on t.StatusID equals (short?)l.Key into lg
                from ls in lg.DefaultIfEmpty()
                orderby t.ID descending
                select new
                {
                    id = t.ID,
                    no = t.No,
                    date = t.Date,
                    amount = t.Amount,
                    paidAmount = t.PaidAmount ?? 0m,
                    customerName = cust != null ? cust.Name : "Umum",
                    statusID = t.StatusID,
                    status = ls != null ? ls.Name : null,
                    createdBy = t.CreatedBy,
                    createdAt = t.CreatedAt
                }
            ).ToListAsync();
            return list;
        }

        public async Task<object> GetHistoryDetail(int id)
        {
            var trade = await _ctx.Trades.AsNoTracking().FirstOrDefaultAsync(t => t.ID == id);
            if (trade == null) return new { success = false, result = "Not found" };

            var customer = trade.CustomerID.HasValue
                ? await _ctx.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.ID == trade.CustomerID.Value)
                : null;

            var items = await (
                from si in _ctx.SalesOrderItems.AsNoTracking()
                where si.TradeID == id
                join p in _ctx.Products.AsNoTracking() on si.ProductID equals p.ID into pg
                from prod in pg.DefaultIfEmpty()
                select new
                {
                    productName = prod != null ? prod.Name : "-",
                    quantity = si.Quantity,
                    unitPrice = prod != null ? prod.UnitPrice : 0m,
                    hasDiscount = prod != null && prod.HasDiscount,
                    discountPercentage = prod != null ? prod.DiscountPercentage : 0m
                }
            ).ToListAsync();

            var detailItems = items.Select(i =>
            {
                var price = i.unitPrice;
                if (i.hasDiscount && i.discountPercentage > 0)
                    price = price - (price * i.discountPercentage / 100m);
                return new { i.productName, i.quantity, unitPrice = price, subTotal = price * i.quantity };
            }).ToList();

            return new
            {
                success = true,
                no = trade.No,
                date = trade.Date,
                customerName = customer?.Name ?? "Umum",
                amount = trade.Amount,
                paidAmount = trade.PaidAmount ?? 0m,
                statusID = trade.StatusID,
                items = detailItems
            };
        }
    }
}
