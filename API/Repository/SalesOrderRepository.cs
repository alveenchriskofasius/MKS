using API.Context.SP;
using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository
{
    public class SalesOrderRepository : ISalesOrderRepository
    {
        private readonly MKSTableContext _context;
        private readonly MKSSPContextProcedures _procedure;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private enum TradeStatus
        {
            Draft = 1,
            Paid = 2,
            Debt = 3,
            PartialRefund = 4,
            Refund = 5,
            Exchange = 6,
            PartialExchange = 7,
            Completed = 8 // DO delivered / finalized
        }
        private static readonly HashSet<short> LockedStatuses = new HashSet<short> { (short)TradeStatus.Paid, (short)TradeStatus.PartialRefund, (short)TradeStatus.Refund, (short)TradeStatus.Exchange, (short)TradeStatus.PartialExchange, (short)TradeStatus.Completed };
        public SalesOrderRepository(MKSTableContext context, MKSSPContextProcedures procedures, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _procedure = procedures;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<object> Delete(int id)
        {
            try
            {
                Trade trade = await _context.Trades.FindAsync(id);
                var items = await _context.SalesOrderItems.Where(x => x.TradeID == id).ToListAsync();
                if (trade == null)
                {
                    return new { success = false, result = "Stock In item not found." };
                }
                _context.SalesOrderItems.RemoveRange(items);
                _context.Trades.Remove(trade);
                await _context.SaveChangesAsync();
            }
            catch (Exception e)
            {
                await Task.FromResult<object>(new { success = false, result = e.Message });
            }
            return new { success = true };
        }
        public async Task<object> DeleteProductById(int id)
        {
            try
            {
                var product = await _context.SalesOrderItems.FindAsync(id);
                if (product == null)
                {
                    return new { success = false, result = "Sales Order item not found." };
                }
                _context.SalesOrderItems.Remove(product);
                await _context.SaveChangesAsync();
            }
            catch (Exception e)
            {
                await Task.FromResult<object>(new { success = false, result = e.Message });
            }
            return new { success = true };
        }
        public async Task<SalesOrderModel> FillForm(int id)
        {
            Trade trade = await _context.Trades.FindAsync(id);
            SalesOrderModel salesOrder = null;
            if (trade == null)
            {
                salesOrder = new SalesOrderModel();
            }
            else
            {
                salesOrder = new SalesOrderModel
                {
                    ID = trade.ID,
                    Date = trade.Date,
                    StatusID = trade.StatusID,
                    No = trade.No,
                    Amount = trade.Amount,
                    CustomerID = trade.CustomerID,
                    Note = trade.Note,
                    IsLocked = trade.IsLocked,
                    PaidAmount = trade.PaidAmount ?? 0m
                };
            }
            return salesOrder;
        }
        // Enriched detail list including refunded qty and remaining qty (for return validation)
        public async Task<object> GetSalesOrderDetailById(int id)
        {
            var raw = await _procedure.uspGetSalesOrderItemListAsync(id); // original SP results
            var ids = raw.Select(r => r.ID).ToList();
            var entities = await _context.SalesOrderItems.Where(x => ids.Contains(x.ID)).ToListAsync();
            var enriched = raw.Select(r =>
            {
                var ent = entities.FirstOrDefault(e => e.ID == r.ID);
                int qtySold = r.Quantity;
                int qtyRefunded = ent?.QtyRefunded ?? 0;
                int qtyExchanged = ent?.QtyExchanged ?? 0;
                int remaining = qtySold - (qtyRefunded + qtyExchanged);
                if (remaining < 0) remaining = 0;
                // Try get product id from SP result (property naming may differ)
                int productId = 0;
                try
                {
                    productId = (int)(r.GetType().GetProperty("ProductID")?.GetValue(r) ?? r.GetType().GetProperty("ProductId")?.GetValue(r) ?? 0);
                }
                catch { }
                return new
                {
                    id = r.ID,
                    productID = productId,
                    product = r.Product,
                    quantity = qtySold,
                    unitPrice = r.UnitPrice,
                    subTotal = r.SubTotal,
                    qtyRefunded,
                    qtyExchanged,
                    remainingQty = remaining
                };
            }).ToList();
            return new { result = enriched };
        }
        public async Task<List<SalesOrderDetailModel>> GetSalesOrderDetailModelById(int id)
        {
            var salesOrderDetails = await _procedure.uspGetSalesOrderItemListAsync(id);
            List<SalesOrderDetailModel> salesOrderDetailModels = new List<SalesOrderDetailModel>();
            foreach (var detail in salesOrderDetails)
            {
                salesOrderDetailModels.Add(new SalesOrderDetailModel
                {
                    ID = detail.ID,
                    ProductName = detail.Product,
                    Quantity = detail.Quantity,
                    Subtotal = (decimal)detail.SubTotal,
                    UnitPrice = detail.UnitPrice

                });
            }
            return salesOrderDetailModels;
        }
        public async Task<object> GetSearchList() => await _procedure.GetSalesOrderListAsync();
        public async Task<object> Save(SalesOrderModel salesOrder)
        {
            try
            {
                salesOrder.SalesOrderDetails ??= new List<SalesOrderDetailModel>();

                Trade tradeEntity;
                if (salesOrder.ID == 0)
                {
                    var noResult = await _procedure.uspGenerateNoAsync("SO", salesOrder.Date);
                    var generatedNo = noResult.FirstOrDefault()?.NewPONumber ?? string.Empty;

                    tradeEntity = new Trade
                    {
                        No = generatedNo,
                        Amount = salesOrder.SalesOrderDetails.Sum(x => x.Subtotal),
                        CustomerID = salesOrder.CustomerID,
                        CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name,
                        Date = salesOrder.Date,
                        StatusID = salesOrder.IsPaid ? (short)TradeStatus.Paid : (short)TradeStatus.Draft,
                        TradeTypeID = 2,
                        CreatedAt = DateTime.Now,
                        Note = salesOrder.Note,
                        PaidAmount = salesOrder.IsPaid ? salesOrder.SalesOrderDetails.Sum(x => x.Subtotal) : 0
                    };
                    await _context.Trades.AddAsync(tradeEntity);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    tradeEntity = await _context.Trades.FindAsync(salesOrder.ID);
                    if (tradeEntity == null)
                    {
                        return new { success = false, result = "Sales Order (Trade) not found." };
                    }
                    // Locking rule: prevent modification when status already final/locked
                    if (tradeEntity.StatusID.HasValue && LockedStatuses.Contains(tradeEntity.StatusID.Value))
                    {
                        return new { success = false, result = "Sales Order is locked and cannot be modified (status already finalized / has returns)." };
                    }
                    tradeEntity.Amount = salesOrder.SalesOrderDetails.Sum(x => x.Subtotal);
                    tradeEntity.CustomerID = salesOrder.CustomerID;
                    tradeEntity.UpdatedAt = DateTime.Now;
                    tradeEntity.UpdatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name;
                    tradeEntity.Date = salesOrder.Date;
                    tradeEntity.StatusID = salesOrder.IsPaid ? (short)TradeStatus.Paid : (short)TradeStatus.Draft;
                    tradeEntity.Note = salesOrder.Note;
                    if (tradeEntity.StatusID == (short)TradeStatus.Paid || tradeEntity.StatusID == (short)TradeStatus.Completed)
                    {
                        tradeEntity.IsLocked = true; // mark lock for persistence
                    }
                    if (salesOrder.IsPaid)
                    {
                        tradeEntity.PaidAmount = tradeEntity.Amount; // mark fully paid when saving with isPay
                    }
                    await _context.SaveChangesAsync();
                }

                int tradeID = tradeEntity.ID;

                foreach (SalesOrderDetailModel salesOrderDetail in salesOrder.SalesOrderDetails)
                {
                    var saveResult = await SaveProduct(salesOrderDetail, tradeID);
                    dynamic dyn = saveResult;
                    if (dyn.success == false)
                    {
                        return saveResult;
                    }
                }

                // Propagate SO payment state to linked Sales Invoice if exists
                var linkedInvoice = await _context.Trades.FirstOrDefaultAsync(t => t.TradeTypeID == 3 && t.Note == $"SO:{tradeEntity.ID}");
                if (linkedInvoice != null)
                {
                    var soPaid = tradeEntity.PaidAmount ?? 0m;
                    var invPaid = Math.Min(soPaid, linkedInvoice.Amount);
                    linkedInvoice.PaidAmount = invPaid;
                    if (invPaid >= linkedInvoice.Amount) linkedInvoice.StatusID = 4; // Paid
                    else if (invPaid > 0) linkedInvoice.StatusID = 3; // Partially Paid
                    else linkedInvoice.StatusID = 1; // Draft
                    linkedInvoice.UpdatedAt = DateTime.Now;
                    linkedInvoice.UpdatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name;
                    _context.Trades.Update(linkedInvoice);
                    await _context.SaveChangesAsync();
                }

                return new
                {
                    success = true,
                    id = tradeEntity.ID,
                    no = tradeEntity.No,
                    statusID = tradeEntity.StatusID,
                    amount = tradeEntity.Amount
                };
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
        }
        public async Task<object> SaveProduct(SalesOrderDetailModel salesOrderDetailModel, int tradeID)
        {
            try
            {
                var product = await _context.Products.FindAsync(salesOrderDetailModel.ProductID);
                if (product == null)
                {
                    return new { success = false, result = "Product not found." };
                }
                // Merge logic: avoid duplicate SalesOrderItem entries. If item already exists we will UPDATE to requested qty (not add).
                if (salesOrderDetailModel.ID == 0)
                {
                    var existingSameProduct = await _context.SalesOrderItems.FirstOrDefaultAsync(x => x.TradeID == tradeID && x.ProductID == salesOrderDetailModel.ProductID);
                    if (existingSameProduct != null)
                    {
                        salesOrderDetailModel.ID = existingSameProduct.ID; // switch to update path
                    }
                }
                if (salesOrderDetailModel.ID == 0)
                {
                    if (salesOrderDetailModel.Quantity > product.StockQuantity)
                    {
                        return new { success = false, result = $"Insufficient stock for product. Available: {product.StockQuantity}" };
                    }
                    var newProduct = new SalesOrderItem
                    {
                        TradeID = tradeID,
                        ProductID = salesOrderDetailModel.ProductID,
                        Quantity = salesOrderDetailModel.Quantity,
                        QtyRefunded = 0,
                        QtyExchanged = 0
                    };
                    await _context.SalesOrderItems.AddAsync(newProduct);
                    product.StockQuantity -= salesOrderDetailModel.Quantity;
                }
                else
                {
                    var existingProduct = await _context.SalesOrderItems.FindAsync(salesOrderDetailModel.ID);
                    if (existingProduct == null)
                    {
                        return new { success = false, result = "Sales Order Item not found." };
                    }
                    var availableStock = product.StockQuantity + existingProduct.Quantity; // we can restore original quantity to stock for comparison
                    if (salesOrderDetailModel.Quantity > availableStock)
                    {
                        return new { success = false, result = $"Insufficient stock for product. Available: {availableStock}" };
                    }
                    var quantityDifference = salesOrderDetailModel.Quantity - existingProduct.Quantity; // positive means consume stock, negative means release
                    product.StockQuantity -= quantityDifference;
                    existingProduct.Quantity = salesOrderDetailModel.Quantity; // set to requested (not additive)
                    _context.SalesOrderItems.Update(existingProduct);
                }
                _context.Products.Update(product);
                await _context.SaveChangesAsync();
                return new { success = true };
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
        }

    }
}
