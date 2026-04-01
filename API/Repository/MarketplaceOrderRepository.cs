using API.Context.SP;
using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using API.Services;
using Microsoft.EntityFrameworkCore;

namespace API.Repository
{
    public class MarketplaceOrderRepository : BaseRepository, IMarketplaceOrderRepository
    {
        private readonly MKSSPContextProcedures _procedure;
        private readonly IStockLedgerService _stockLedger;

        public MarketplaceOrderRepository(
            MKSTableContext context,
            IHttpContextAccessor http,
            MKSSPContextProcedures procedures,
            IStockLedgerService stockLedger)
            : base(context, http)
        {
            _procedure = procedures;
            _stockLedger = stockLedger;
        }

        public async Task<object> PlaceOrder(MarketplaceCheckoutModel model)
        {
            try
            {
                if (model.Items == null || model.Items.Count == 0)
                    return new { success = false, message = "Keranjang kosong." };

                // Validate stock
                foreach (var item in model.Items)
                {
                    var product = await _context.Products.FindAsync(item.ProductID);
                    if (product == null)
                        return new { success = false, message = $"Produk '{item.ProductName}' tidak ditemukan." };
                    if (product.StockQuantity < item.Quantity)
                        return new { success = false, message = $"Stok '{product.Name}' tidak mencukupi (tersedia: {product.StockQuantity})." };
                }

                // Generate order number
                var date = DateTime.Now;
                var noResult = await _procedure.uspGenerateNoAsync("MO", date);
                var generatedNo = noResult.FirstOrDefault()?.NewNumber ?? "";

                if (string.IsNullOrWhiteSpace(generatedNo) || await _context.Trades.AnyAsync(t => t.No == generatedNo))
                {
                    string prefix = "MO" + date.ToString("yyMMdd");
                    var existing = await _context.Trades
                        .Where(t => t.TradeTypeID == 4 && t.No.StartsWith(prefix))
                        .Select(t => t.No.Substring(prefix.Length))
                        .ToListAsync();
                    int maxSeq = existing
                        .Select(s => int.TryParse(s, out var n) ? n : 0)
                        .DefaultIfEmpty(0)
                        .Max();
                    generatedNo = prefix + (maxSeq + 1).ToString("D3");
                }

                var totalAmount = model.Items.Sum(i => i.Subtotal);

                // Create Trade — TradeTypeID 4 = Marketplace Order, StatusID 1 = Draft
                var trade = new Trade
                {
                    No = generatedNo,
                    Amount = totalAmount,
                    CustomerID = model.CustomerID,
                    Date = date,
                    TradeTypeID = 4,
                    StatusID = 1,
                    CreatedBy = "Marketplace",
                    CreatedAt = date,
                    Note = model.Note ?? "Order dari Marketplace",
                    PaymentMethod = model.PaymentMethod,
                    DeliveryMethod = model.DeliveryMethod
                };
                _context.Trades.Add(trade);
                await SaveChangesAsync();

                // Create order items (stock is NOT deducted until payment)
                foreach (var item in model.Items)
                {
                    var soItem = new SalesOrderItem
                    {
                        TradeID = trade.ID,
                        ProductID = item.ProductID,
                        Quantity = item.Quantity
                    };
                    _context.SalesOrderItems.Add(soItem);
                }
                await SaveChangesAsync();

                return new
                {
                    success = true,
                    orderId = trade.ID,
                    orderNo = trade.No,
                    amount = trade.Amount
                };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

        public async Task<List<MarketplaceOrderSummary>> GetOrdersByCustomer(int customerId)
        {
            var orders = await (from t in _context.Trades.AsNoTracking()
                                where t.CustomerID == customerId && t.TradeTypeID == 4
                                join l in _context.Lookups.Where(x => x.Entity == "SalesOrderStatus").AsNoTracking()
                                    on (short?)t.StatusID equals (short?)l.Key into lgroup
                                from ls in lgroup.DefaultIfEmpty()
                                orderby t.ID descending
                                select new MarketplaceOrderSummary
                                {
                                    OrderID = t.ID,
                                    OrderNo = t.No,
                                    Date = t.Date,
                                    Amount = t.Amount,
                                    StatusID = t.StatusID,
                                    Status = ls != null ? ls.Name : "Draft",
                                    IsPaid = (t.PaidAmount ?? 0) >= t.Amount,
                                    IsCancelled = t.StatusID == 9,
                                    IsCompleted = t.StatusID == 8,
                                    PaymentMethod = t.PaymentMethod,
                                    DeliveryMethod = t.DeliveryMethod,
                                    Note = t.Note
                                })
                           .ToListAsync();

            return orders;
        }

        public async Task<MarketplaceOrderSummary?> GetOrderDetail(int orderId, int customerId)
        {
            var trade = await _context.Trades
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.ID == orderId && t.CustomerID == customerId && t.TradeTypeID == 4);

            if (trade == null) return null;

            var statusName = await _context.Lookups
                .AsNoTracking()
                .Where(l => l.Entity == "SalesOrderStatus" && l.Key == (trade.StatusID ?? 0))
                .Select(l => l.Name)
                .FirstOrDefaultAsync() ?? "Draft";

            var items = await _context.SalesOrderItems
                .AsNoTracking()
                .Where(i => i.TradeID == orderId)
                .Join(_context.Products.AsNoTracking(),
                    i => i.ProductID, p => p.ID,
                    (i, p) => new MarketplaceOrderItem
                    {
                        ProductID = p.ID,
                        ProductName = p.Name,
                        Quantity = i.Quantity,
                        UnitPrice = p.UnitPrice,
                        Subtotal = p.UnitPrice * i.Quantity
                    })
                .ToListAsync();

            return new MarketplaceOrderSummary
            {
                OrderID = trade.ID,
                OrderNo = trade.No,
                Date = trade.Date,
                Amount = trade.Amount,
                StatusID = trade.StatusID,
                Status = statusName,
                IsPaid = (trade.PaidAmount ?? 0) >= trade.Amount,
                IsCancelled = trade.StatusID == 9,
                IsCompleted = trade.StatusID == 8,
                PaymentMethod = trade.PaymentMethod,
                DeliveryMethod = trade.DeliveryMethod,
                Note = trade.Note,
                Items = items
            };
        }

        public async Task<object> MarkOrderPaid(int orderId)
        {
            using var transaction = await _context.Database
                .BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            try
            {
                var trade = await _context.Trades.FindAsync(orderId);
                if (trade == null)
                    return new { success = false, message = "Order tidak ditemukan." };

                // Guard against double payment
                if (trade.StatusID == 2
                    || (trade.PaidAmount ?? 0) >= trade.Amount)
                {
                    await transaction.RollbackAsync();
                    return new { success = false, message = "Order sudah dibayar." };
                }

                trade.StatusID = 2; // Paid
                trade.PaidAmount = trade.Amount;
                trade.IsLocked = true;
                trade.UpdatedAt = DateTime.Now;
                trade.UpdatedBy = "Marketplace";
                _context.Trades.Update(trade);

                // Deduct stock now that payment is confirmed
                var items = await _context.SalesOrderItems
                    .Where(i => i.TradeID == orderId)
                    .ToListAsync();

                foreach (var item in items)
                {
                    if (item.ProductID == null) continue;
                    var product = await _context.Products.FindAsync(item.ProductID);
                    if (product != null)
                    {
                        if (product.StockQuantity < item.Quantity)
                        {
                            await transaction.RollbackAsync();
                            return new
                            {
                                success = false,
                                message = $"Stok '{product.Name}' tidak mencukupi."
                            };
                        }
                        product.StockQuantity -= item.Quantity;
                        _context.Products.Update(product);
                        try
                        {
                            await _stockLedger.WriteAsync(
                                product.ID,
                                -item.Quantity,
                                "MarketplaceOrder",
                                trade.ID,
                                trade.No);
                        }
                        catch { }
                    }
                }

                await SaveChangesAsync();
                await transaction.CommitAsync();

                return new { success = true };
            }
            catch (Exception e)
            {
                await transaction.RollbackAsync();
                return CreateErrorResponse(e);
            }
        }

        public async Task<object> CancelOrder(int orderId, int customerId)
        {
            using var transaction = await _context.Database
                .BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead);
            try
            {
                var trade = await _context.Trades
                    .FirstOrDefaultAsync(t =>
                        t.ID == orderId
                        && (customerId == 0 || t.CustomerID == customerId)
                        && t.TradeTypeID == 4);

                if (trade == null)
                    return new { success = false, message = "Order tidak ditemukan." };

                if (trade.StatusID == 2 || (trade.PaidAmount ?? 0) >= trade.Amount)
                {
                    await transaction.RollbackAsync();
                    return new
                    {
                        success = false,
                        message = "Order yang sudah dibayar tidak dapat dibatalkan."
                    };
                }

                if (trade.StatusID == 9)
                {
                    await transaction.RollbackAsync();
                    return new { success = false, message = "Order sudah dibatalkan." };
                }

                trade.StatusID = 9; // Cancelled
                trade.IsLocked = true;
                trade.UpdatedAt = DateTime.Now;
                trade.UpdatedBy = "Marketplace";
                _context.Trades.Update(trade);
                await SaveChangesAsync();
                await transaction.CommitAsync();

                return new { success = true, message = "Order berhasil dibatalkan." };
            }
            catch (Exception e)
            {
                await transaction.RollbackAsync();
                return CreateErrorResponse(e);
            }
        }

        public async Task<object> MarkOrderPaidByNo(string orderNo)
        {
            var trade = await _context.Trades
                .FirstOrDefaultAsync(t => t.No == orderNo && t.TradeTypeID == 4);
            if (trade == null)
                return new { success = false, message = "Order tidak ditemukan." };
            return await MarkOrderPaid(trade.ID);
        }

        public async Task<object> MarkPickedUp(int orderId)
        {
            try
            {
                var trade = await _context.Trades.FindAsync(orderId);
                if (trade == null)
                    return new { success = false, message = "Order tidak ditemukan." };

                if (trade.StatusID != 2)
                    return new { success = false, message = "Hanya order yang sudah dibayar dapat diupdate." };

                trade.StatusID = 8; // Completed
                trade.UpdatedAt = DateTime.Now;
                trade.UpdatedBy = GetCurrentUserName() ?? "Backoffice";
                _context.Trades.Update(trade);
                await SaveChangesAsync();

                return new { success = true, message = "Order ditandai sudah diambil." };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }
    }
}
