using API.Context.SP;
using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using API.Services;
using Microsoft.EntityFrameworkCore;

namespace API.Repository
{
    public class SalesOrderRepository : BaseRepository, ISalesOrderRepository
    {
        private readonly MKSSPContextProcedures _procedure;
        private readonly IStockLedgerService _stockLedger;
        private readonly IConsignmentRepository _consignmentRepo;
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

        public SalesOrderRepository(MKSTableContext context, MKSSPContextProcedures procedures, IHttpContextAccessor httpContextAccessor, IStockLedgerService stockLedger = null, IConsignmentRepository consignmentRepo = null)
            : base(context, httpContextAccessor)
        {
            _procedure = procedures;
            _stockLedger = stockLedger;
            _consignmentRepo = consignmentRepo;
        }

        private async Task WriteLedgerSafe(int productId, int qtyChange, Trade trade)
        {
            if (_stockLedger == null || qtyChange == 0) return;
            try { await _stockLedger.WriteAsync(productId, qtyChange, "SalesOrder", trade?.ID, trade?.No); } catch { }
        }

        // Helper: apply payment-related state changes to a trade
        private void ApplyTradePaymentState(Trade tradeEntity, bool isPaid)
        {
            tradeEntity.StatusID = isPaid ? (short)TradeStatus.Paid : (short)TradeStatus.Draft;
            if (isPaid)
            {
                tradeEntity.PaidAmount = tradeEntity.Amount;
            }
            if (tradeEntity.StatusID == (short)TradeStatus.Paid || tradeEntity.StatusID == (short)TradeStatus.Completed)
            {
                tradeEntity.IsLocked = true;
            }
        }

        // Helper: update a linked invoice's paid amount/status based on SO
        private async Task UpdateLinkedInvoiceAsync(Trade soTrade)
        {
            var linkedInvoice = await _context.Trades.FirstOrDefaultAsync(t => t.TradeTypeID == 3 && t.Note == $"SO:{soTrade.ID}");
            if (linkedInvoice != null)
            {
                var soPaid = soTrade.PaidAmount ?? 0m;
                var invPaid = Math.Min(soPaid, linkedInvoice.Amount);
                linkedInvoice.PaidAmount = invPaid;
                if (invPaid >= linkedInvoice.Amount) linkedInvoice.StatusID = 4; // Paid
                else if (invPaid > 0) linkedInvoice.StatusID = 3; // Partially Paid
                else linkedInvoice.StatusID = 1; // Draft
                linkedInvoice.UpdatedAt = DateTime.Now;
                linkedInvoice.UpdatedBy = GetCurrentUserName();
                _context.Trades.Update(linkedInvoice);
                await SaveChangesAsync();
            }
        }

        public async Task<object> Delete(int id)
        {
            try
            {
                Trade trade = await _context.Trades.FindAsync(id);
                if (trade == null)
                {
                    return new { success = false, result = "Sales Order not found." };
                }
                // Guard: prevent delete if linked records exist
                if (await _context.PaymentIns.AnyAsync(p => p.SalesOrderID == id))
                    return new { success = false, result = "Cannot delete: Sales Order has linked Payment In records." };
                if (await _context.DeliveryOrders.AnyAsync(d => d.SalesOrderID == id))
                    return new { success = false, result = "Cannot delete: Sales Order has a linked Delivery Order." };
                if (await _context.Trades.AnyAsync(t => t.TradeTypeID == 3 && t.Note == $"SO:{id}"))
                    return new { success = false, result = "Cannot delete: Sales Order has a linked Sales Invoice." };
                if (await _context.Trades.AnyAsync(t => t.TradeTypeID == 5 && t.Note != null && t.Note.Contains($"SO:{id}")))
                    return new { success = false, result = "Cannot delete: Sales Order has linked Sales Return records." };

                var items = await _context.SalesOrderItems.Where(x => x.TradeID == id).ToListAsync();
                // Restore stock for each item before deleting
                foreach (var item in items)
                {
                    var product = await _context.Products.FindAsync(item.ProductID);
                    if (product != null)
                    {
                        product.StockQuantity += item.Quantity;
                        _context.Products.Update(product);
                        await WriteLedgerSafe(product.ID, item.Quantity, trade);
                    }
                }
                _context.SalesOrderItems.RemoveRange(items);
                _context.Trades.Remove(trade);
                await SaveChangesAsync();
                return new { success = true };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }
        public async Task<object> DeleteProductById(int id)
        {
            try
            {
                var item = await _context.SalesOrderItems.FindAsync(id);
                if (item == null)
                {
                    return new { success = false, result = "Sales Order item not found." };
                }
                // Restore stock before removing item
                if (item.ProductID.HasValue)
                {
                    var product = await _context.Products.FindAsync(item.ProductID.Value);
                    if (product != null)
                    {
                        product.StockQuantity += item.Quantity;
                        _context.Products.Update(product);
                        var trade = await _context.Trades.FindAsync(item.TradeID);
                        await WriteLedgerSafe(product.ID, item.Quantity, trade);
                    }
                }
                _context.SalesOrderItems.Remove(item);
                await SaveChangesAsync();
                return new { success = true };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
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
            bool usedFallback = false;
            if (raw == null || raw.Count == 0)
            {
                usedFallback = true;
                var fallback = await _context.SalesOrderItems
                    .Where(i => i.TradeID == id)
                    .Join(_context.Products,
                          i => i.ProductID,
                          p => p.ID,
                          (i, p) => new
                          {
                              ID = i.ID,
                              ProductID = p.ID,
                              Product = p.Name,
                              Quantity = i.Quantity,
                              UnitPrice = p.UnitPrice,
                              SubTotal = (decimal?)(p.UnitPrice * i.Quantity)
                          })
                    .ToListAsync();
                // replace raw with lightweight pseudo-results (anonymous objects) so later projection still works
                raw = fallback.Select(f => new uspGetSalesOrderItemListResult
                {
                    ID = f.ID,
                    ProductID = f.ProductID,
                    Product = f.Product,
                    Quantity = f.Quantity,
                    UnitPrice = f.UnitPrice,
                    SubTotal = f.SubTotal ?? 0m
                }).ToList();
            }
            var ids = raw.Select(r => r.ID).ToList();
            var entities = await _context.SalesOrderItems.Where(x => ids.Contains(x.ID)).ToListAsync();
            var variantIds = entities
                .Where(e => e.VariantID.HasValue && e.VariantID.Value > 0)
                .Select(e => e.VariantID.Value)
                .Distinct()
                .ToList();
            var variantMap = await _context.ProductVariants
                .Where(v => variantIds.Contains(v.ID))
                .ToDictionaryAsync(v => v.ID, v => v.Name);
            var enriched = raw.Select(r =>
            {
                var ent = entities.FirstOrDefault(e => e.ID == r.ID);
                int qtySold = r.Quantity;
                int qtyRefunded = ent?.QtyRefunded ?? 0;
                int qtyExchanged = ent?.QtyExchanged ?? 0;
                int remaining = qtySold - (qtyRefunded + qtyExchanged);
                if (remaining < 0) remaining = 0;
                int productId = r.ProductID ?? 0;
                int varId = ent?.VariantID ?? 0;
                return new
                {
                    id = r.ID,
                    productID = productId,
                    product = r.Product,
                    variantID = varId,
                    variantName = varId > 0 && variantMap.ContainsKey(varId) ? variantMap[varId] : "",
                    quantity = qtySold,
                    unitPrice = r.UnitPrice,
                    subTotal = r.SubTotal,
                    qtyRefunded,
                    qtyExchanged,
                    remainingQty = remaining,
                    isFallback = usedFallback
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
        public async Task<object> GetSearchList(short? tradeTypeFilter = null)
        {
            // Default: show both SO (2) and MO (4). Filter narrows to one type.
            var tradeTypeIds = tradeTypeFilter.HasValue
                ? new[] { tradeTypeFilter.Value }
                : new short[] { 2, 4 };

            var q = from t in _context.Trades.AsNoTracking()
                    where tradeTypeIds.Contains(t.TradeTypeID)
                    join c in _context.Customers.AsNoTracking() on t.CustomerID equals c.ID into cgroup
                    from cust in cgroup.DefaultIfEmpty()
                    join l in _context.Lookups.Where(x => x.Entity == "SalesOrderStatus").AsNoTracking() on t.StatusID equals (short?)l.Key into lgroup
                    from ls in lgroup.DefaultIfEmpty()
                    orderby t.ID descending
                    select new
                    {
                        id = t.ID,
                        no = t.No,
                        date = t.Date.ToString("yyyy-MM-dd"),
                        amount = t.Amount,
                        customerName = cust != null ? cust.Name : "-",
                        createdBy = t.CreatedBy,
                        updatedBy = t.UpdatedBy,
                        statusID = t.StatusID,
                        status = ls != null ? ls.Name : null,
                        tradeTypeID = (int)t.TradeTypeID,
                        paymentMethod = t.PaymentMethod,
                        deliveryMethod = t.DeliveryMethod,
                        hasDeliveryOrder = _context.DeliveryOrders.Any(d => d.SalesOrderID == t.ID)
                    };

            var list = await q.ToListAsync();
            return list;
        }
        public async Task<object> Save(SalesOrderModel salesOrder)
        {
            try
            {
                salesOrder.SalesOrderDetails ??= new List<SalesOrderDetailModel>();

                Trade tradeEntity;
                if (salesOrder.ID == 0)
                {
                    var noResult = await _procedure.uspGenerateNoAsync("SO", salesOrder.Date);
                    var generatedNo = noResult.FirstOrDefault()?.NewNumber ?? string.Empty;

                    // Fallback / uniqueness assurance: if SP returns empty or existing no, build sequential number based on date.
                    if (string.IsNullOrWhiteSpace(generatedNo) || await _context.Trades.AnyAsync(t => t.No == generatedNo))
                    {
                        string prefix = "SO" + salesOrder.Date.ToString("yyMMdd");
                        // collect existing sequences for today
                        var existingSeqParts = await _context.Trades
                            .Where(t => t.TradeTypeID == 2 && t.No.StartsWith(prefix))
                            .Select(t => t.No.Substring(prefix.Length))
                            .ToListAsync();
                        int maxSeq = existingSeqParts
                            .Select(s => int.TryParse(s, out var num) ? num : 0)
                            .DefaultIfEmpty(0)
                            .Max();
                        generatedNo = prefix + (maxSeq + 1).ToString("D2"); // keep 2 digits like sample (..03)
                        int safety = 0;
                        while (await _context.Trades.AnyAsync(t => t.No == generatedNo) && safety < 10)
                        {
                            maxSeq++;
                            generatedNo = prefix + (maxSeq).ToString("D2");
                            safety++;
                        }
                    }

                    tradeEntity = new Trade
                    {
                        No = generatedNo,
                        Amount = salesOrder.SalesOrderDetails.Sum(x => x.Subtotal),
                        CustomerID = salesOrder.CustomerID,
                        CreatedBy = GetCurrentUserName(),
                        Date = salesOrder.Date,
                        TradeTypeID = 2,
                        CreatedAt = DateTime.Now,
                        Note = salesOrder.Note
                    };

                    // apply payment state
                    ApplyTradePaymentState(tradeEntity, salesOrder.IsPaid);

                    await _context.Trades.AddAsync(tradeEntity);
                    await SaveChangesAsync();
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
                    tradeEntity.UpdatedBy = GetCurrentUserName();
                    tradeEntity.Date = salesOrder.Date;
                    tradeEntity.Note = salesOrder.Note;

                    // apply payment state
                    ApplyTradePaymentState(tradeEntity, salesOrder.IsPaid);

                    if (salesOrder.IsPaid)
                    {
                        tradeEntity.PaidAmount = tradeEntity.Amount; // mark fully paid when saving with isPay
                    }

                    _context.Trades.Update(tradeEntity);
                    await SaveChangesAsync();
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

                // propagate SO payment state to linked Sales Invoice if exists
                await UpdateLinkedInvoiceAsync(tradeEntity);

                // Check for products that dropped below their low stock threshold
                var lowStockWarnings = new List<object>();
                foreach (var detail in salesOrder.SalesOrderDetails)
                {
                    if (detail.ProductID == null || detail.ProductID == 0) continue;
                    var prod = await _context.Products.AsNoTracking().FirstOrDefaultAsync(x => x.ID == detail.ProductID);
                    if (prod != null)
                    {
                        var thr = prod.LowStockThreshold ?? 0;
                        if (thr > 0 && prod.StockQuantity <= thr)
                        {
                            lowStockWarnings.Add(new { name = prod.Name, stockQuantity = prod.StockQuantity, lowStockThreshold = thr });
                        }
                    }
                }

                return new
                {
                    success = true,
                    id = tradeEntity.ID,
                    no = tradeEntity.No,
                    statusID = tradeEntity.StatusID,
                    amount = tradeEntity.Amount,
                    lowStockWarnings
                };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
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
                    _context.Products.Update(product);
                    await SaveChangesAsync();
                    var tradeForLedger = await _context.Trades.FindAsync(tradeID);
                    await WriteLedgerSafe(product.ID, -salesOrderDetailModel.Quantity, tradeForLedger);
                    // Auto-deduct consignment
                    if (_consignmentRepo != null)
                        await _consignmentRepo.AutoDeductConsignmentSales(
                            new Dictionary<int, int> { { product.ID, salesOrderDetailModel.Quantity } },
                            GetCurrentUserName());
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
                    _context.Products.Update(product);
                    await SaveChangesAsync();
                    if (quantityDifference != 0)
                    {
                        var tradeForLedger = await _context.Trades.FindAsync(tradeID);
                        await WriteLedgerSafe(product.ID, -quantityDifference, tradeForLedger);
                        // Auto-deduct or reverse consignment based on delta
                        if (_consignmentRepo != null)
                        {
                            if (quantityDifference > 0)
                                await _consignmentRepo.AutoDeductConsignmentSales(
                                    new Dictionary<int, int> { { product.ID, quantityDifference } },
                                    GetCurrentUserName());
                            else
                                await _consignmentRepo.AutoReverseConsignmentSales(
                                    new Dictionary<int, int> { { product.ID, -quantityDifference } },
                                    GetCurrentUserName());
                        }
                    }
                }
                return new { success = true };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

    }
}
