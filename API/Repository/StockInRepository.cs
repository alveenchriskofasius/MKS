using API.Context.SP;
using API.Context.Table;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;
using MitraKaryaSystem.Models;

namespace API.Repository
{
    public class StockInRepository : IStockInRepository
    {
        private readonly MKSTableContext _context;
        private readonly MKSSPContextProcedures _procedure;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly API.Services.IStockLedgerService _stockLedger;
        private readonly API.Services.IAuditService _audit;
        public StockInRepository(MKSTableContext context, MKSSPContextProcedures procedure, IHttpContextAccessor httpContextAccessor, API.Services.IStockLedgerService stockLedger = null, API.Services.IAuditService audit = null)
        {
            _context = context;
            _procedure = procedure;
            _httpContextAccessor = httpContextAccessor;
            _stockLedger = stockLedger;
            _audit = audit;
        }
        public async Task<StockInModel> FillForm(int id)
        {
            Trade trade = await _context.Trades.FindAsync(id);
            StockInModel stockIn = null;
            if (trade == null)
            {
                stockIn = new StockInModel();
            }
            else
            {
                var poNo = trade.PurchaseOrderID != null
                    ? (await _context.Trades.Where(t => t.ID == trade.PurchaseOrderID).Select(t => t.No).FirstOrDefaultAsync())
                    : null;
                stockIn = new StockInModel
                {
                    ID = trade.ID,
                    Date = trade.Date,
                    StatusID = trade.StatusID,
                    No = trade.No,
                    PurchaseOrderID = trade.PurchaseOrderID,
                    PurchaseOrderNo = poNo
                };
            }
            return stockIn;
        }
        public async Task<object> DeleteProductById(int id)
        {
            try
            {
                var item = await _context.StockInItems.FindAsync(id);
                if (item == null)
                {
                    return new { success = false, result = "Stock In item not found." };
                }
                // prevent delete if parent already verified (status >= 3)
                var parent = await _context.Trades.FirstOrDefaultAsync(t => t.ID == item.TradeID);
                if (parent != null && (parent.StatusID ?? 1) >= 3)
                {
                    return new { success = false, result = "Cannot delete item of verified Stock In." };
                }
                _context.StockInItems.Remove(item);
                await _context.SaveChangesAsync();
                return new { success = true };
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
        }
        public async Task<object> DeleteById(int id)
        {
            try
            {
                var trade = await _context.Trades.FindAsync(id);
                var stockInItems = await _context.StockInItems.Where(x => x.TradeID == id).ToListAsync();
                if (trade == null)
                {
                    return new { success = false, result = "Stock In not found." };
                }
                if ((trade.StatusID ?? 1) >= 3)
                {
                    return new { success = false, result = "Cannot delete verified Stock In." };
                }
                _context.StockInItems.RemoveRange(stockInItems);
                _context.Trades.Remove(trade);
                await _context.SaveChangesAsync();
                return new { success = true };
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
        }
        public async Task<StockInDetailModel> FillFormDetail(int id)
        {
            var product = await _context.Products.FindAsync(id);
            var purchaseOrderDetail = new StockInDetailModel();
            try
            {
                if (product == null)
                {
                    return new StockInDetailModel();
                }
                else
                {
                    purchaseOrderDetail = new StockInDetailModel
                    {
                        ID = product.ID,
                        Quantity = 1
                    };
                }
                ;
            }
            catch (Exception e)
            {
                await Task.FromResult<object>(new { success = false, result = e.Message });
            }
            return purchaseOrderDetail;
        }
        public async Task<object> GetStockInList() => await _procedure.GetStockInListAsync();

        public Task<List<uspGetDetailListByIdResult>> GetDetailListById(int id) => _procedure.uspGetDetailListByIdAsync(id);
        public async Task<object> Save(StockInModel stockInModel)
        {
            try
            {
                int tradeID;
                Trade tradeEntity;
                if (stockInModel.ID == 0)
                {
                    var noResult = await _procedure.uspGenerateNoAsync("SI", stockInModel.Date);
                    var generatedNo = noResult.FirstOrDefault()?.NewNumber ?? string.Empty;
                    tradeEntity = new Trade
                    {
                        Date = stockInModel.Date,
                        StatusID = 1, // Draft
                        No = generatedNo,
                        CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name,
                        TradeTypeID = 3,
                        CreatedAt = DateTime.Now,
                        PurchaseOrderID = stockInModel.PurchaseOrderID
                    };
                    await _context.Trades.AddAsync(tradeEntity);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    tradeEntity = await _context.Trades.FindAsync(stockInModel.ID);
                    if (tradeEntity == null)
                    {
                        return new { success = false, result = "Stock In not found." };
                    }
                    // only block when verified
                    if ((tradeEntity.StatusID ?? 1) >= 3)
                    {
                        return new { success = false, result = "Cannot modify verified Stock In." };
                    }
                    tradeEntity.Date = stockInModel.Date;
                    // allow changing PO link only in Draft
                    if ((tradeEntity.StatusID ?? 1) == 1)
                    {
                        tradeEntity.PurchaseOrderID = stockInModel.PurchaseOrderID;
                    }
                    tradeEntity.UpdatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name;
                    tradeEntity.UpdatedAt = DateTime.Now;
                    await _context.SaveChangesAsync();
                }

                tradeID = tradeEntity.ID;

                foreach (var product in stockInModel.StockInDetails)
                {
                    await SaveProduct(product, tradeID);
                }
                return new { success = true, id = tradeEntity.ID, no = tradeEntity.No, statusID = tradeEntity.StatusID };
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
        }

        public async Task<object> SaveProduct(StockInDetailModel stockInDetailModel, int tradeID)
        {
            try
            {
                var product = await _context.Products.FindAsync(stockInDetailModel.ProductID);
                var trade = await _context.Trades.FindAsync(tradeID);

                if (product == null)
                {
                    return new { success = false, result = "Product not found." };
                }

                // only block when verified
                if (trade != null && (trade.StatusID ?? 1) >= 3)
                {
                    return new { success = false, result = "Cannot modify verified Stock In." };
                }

                if (stockInDetailModel.ID == 0)
                {
                    var newItem = new StockInItem
                    {
                        TradeID = tradeID,
                        ProductID = stockInDetailModel.ProductID,
                        Quantity = stockInDetailModel.Quantity
                    };

                    await _context.StockInItems.AddAsync(newItem);
                }
                else
                {
                    var existingItem = await _context.StockInItems.FindAsync(stockInDetailModel.ID);
                    if (existingItem == null)
                    {
                        return new { success = false, result = "Stock In item not found." };
                    }
                    existingItem.Quantity = stockInDetailModel.Quantity;
                    _context.StockInItems.Update(existingItem);
                }
                await _context.SaveChangesAsync();

                return new { success = true };
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
        }

        private async Task WriteLedgerSafe(int productId, int qtyChange, Trade? trade)
        {
            if (_stockLedger == null || qtyChange == 0) return;
            try
            {
                await _stockLedger.WriteAsync(productId, qtyChange, "StockIn", trade?.ID, trade?.No);
            }
            catch { }
        }

        // New: Submit a Stock In -> Status 2
        public async Task<object> Submit(int id)
        {
            try
            {
                var trade = await _context.Trades.FirstOrDefaultAsync(t => t.ID == id);
                if (trade == null) return new { success = false, result = "Stock In not found." };
                if ((trade.StatusID ?? 1) >= 2) return new { success = false, result = "Already submitted or verified." };
                trade.StatusID = 2; // Submitted
                trade.UpdatedAt = DateTime.Now;
                trade.UpdatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name;
                _context.Trades.Update(trade);
                await _context.SaveChangesAsync();

                if (_audit != null)
                {
                    try { await _audit.WriteAsync("StockIn", "Submit", trade.ID.ToString(), new { trade.No, statusId = trade.StatusID }); } catch { }
                }
                return new { success = true };
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
        }

        // Verify a Stock In -> Status 3 (requires submitted)
        // Stock quantity is increased here, not on Save
        public async Task<object> Verify(int id)
        {
            try
            {
                var trade = await _context.Trades.FirstOrDefaultAsync(t => t.ID == id);
                if (trade == null) return new { success = false, result = "Stock In not found." };
                if ((trade.StatusID ?? 1) >= 3) return new { success = false, result = "Already verified." };
                if ((trade.StatusID ?? 1) < 2) return new { success = false, result = "Submit first before verify." };

                // Validate quantities against linked PO
                if (trade.PurchaseOrderID != null)
                {
                    var validation = await ValidateAgainstPO(id, trade.PurchaseOrderID.Value);
                    if (validation != null) return validation;
                }

                // Increase stock for all items upon verification
                var items = await _context.StockInItems.Where(si => si.TradeID == id).ToListAsync();
                foreach (var item in items)
                {
                    if (item.ProductID == null) continue;
                    var product = await _context.Products.FindAsync(item.ProductID);
                    if (product != null)
                    {
                        product.StockQuantity += item.Quantity;
                        _context.Products.Update(product);
                        await WriteLedgerSafe(product.ID, item.Quantity, trade);
                    }
                }

                trade.StatusID = 3; // Verified
                trade.UpdatedAt = DateTime.Now;
                trade.UpdatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name;
                _context.Trades.Update(trade);
                await _context.SaveChangesAsync();

                if (_audit != null)
                {
                    try { await _audit.WriteAsync("StockIn", "Verify", trade.ID.ToString(), new { trade.No, statusId = trade.StatusID }); } catch { }
                }

                // Check which products are still below their low stock threshold after receiving
                var stillLow = new List<object>();
                foreach (var item in items)
                {
                    if (item.ProductID == null) continue;
                    var p = await _context.Products.AsNoTracking().FirstOrDefaultAsync(x => x.ID == item.ProductID);
                    if (p != null)
                    {
                        var thr = p.LowStockThreshold ?? 0;
                        if (thr > 0 && p.StockQuantity <= thr)
                        {
                            stillLow.Add(new { name = p.Name, stockQuantity = p.StockQuantity, lowStockThreshold = thr });
                        }
                    }
                }
                return new { success = true, lowStockWarnings = stillLow };
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
        }

        private async Task<object> ValidateAgainstPO(int stockInTradeId, int poTradeId)
        {
            var poItems = await _context.PurchaseOrderItems
                .Where(pi => pi.TradeID == poTradeId)
                .ToListAsync();

            var siItems = await _context.StockInItems
                .Where(si => si.TradeID == stockInTradeId)
                .ToListAsync();

            // Get quantities already received from other verified Stock Ins linked to this PO
            var otherVerifiedSIIds = await _context.Trades
                .Where(t => t.PurchaseOrderID == poTradeId && t.TradeTypeID == 3 && t.StatusID >= 3 && t.ID != stockInTradeId)
                .Select(t => t.ID)
                .ToListAsync();

            var alreadyReceivedByProduct = await _context.StockInItems
                .Where(si => si.TradeID != null && otherVerifiedSIIds.Contains(si.TradeID.Value))
                .GroupBy(si => si.ProductID)
                .Select(g => new { ProductID = g.Key, TotalQty = g.Sum(x => x.Quantity) })
                .ToListAsync();

            foreach (var siItem in siItems)
            {
                var poItem = poItems.FirstOrDefault(pi => pi.ProductID == siItem.ProductID);
                if (poItem == null) continue; // allow items not in PO

                var alreadyReceived = alreadyReceivedByProduct.FirstOrDefault(x => x.ProductID == siItem.ProductID)?.TotalQty ?? 0;
                var remaining = poItem.Quantity - alreadyReceived;
                if (siItem.Quantity > remaining)
                {
                    var product = await _context.Products.FindAsync(siItem.ProductID);
                    return new { success = false, result = $"Quantity for {product?.Name ?? "product"} exceeds PO remaining ({remaining})." };
                }
            }
            return null; // validation passed
        }

        public async Task<object> CreateFromPurchaseOrder(int poId)
        {
            try
            {
                var po = await _context.Trades.FindAsync(poId);
                if (po == null) return new { success = false, result = "Purchase Order not found." };
                if ((po.StatusID ?? 1) != 3) return new { success = false, result = "Purchase Order must be Approved." };

                // Check if there is already an unverified Stock In for this PO
                var existingUnverified = await _context.Trades
                    .AnyAsync(t => t.PurchaseOrderID == poId && t.TradeTypeID == 3 && (t.StatusID ?? 1) < 3);
                if (existingUnverified)
                    return new { success = false, result = "There is already an unverified Stock In for this Purchase Order. Please verify or delete it first." };

                var poItems = await _context.PurchaseOrderItems.Where(pi => pi.TradeID == poId).ToListAsync();
                if (!poItems.Any()) return new { success = false, result = "Purchase Order has no items." };

                // Calculate remaining qty per product (subtract already-received from other Stock Ins)
                var existingSIIds = await _context.Trades
                    .Where(t => t.PurchaseOrderID == poId && t.TradeTypeID == 3 && t.StatusID >= 3)
                    .Select(t => t.ID)
                    .ToListAsync();

                var receivedByProduct = await _context.StockInItems
                    .Where(si => si.TradeID != null && existingSIIds.Contains(si.TradeID.Value))
                    .GroupBy(si => si.ProductID)
                    .Select(g => new { ProductID = g.Key, TotalQty = g.Sum(x => x.Quantity) })
                    .ToListAsync();

                var noResult = await _procedure.uspGenerateNoAsync("SI", DateTime.Now);
                var generatedNo = noResult.FirstOrDefault()?.NewNumber ?? string.Empty;

                var trade = new Trade
                {
                    Date = DateTime.Now,
                    StatusID = 1, // Draft
                    No = generatedNo,
                    CreatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name,
                    TradeTypeID = 3,
                    CreatedAt = DateTime.Now,
                    PurchaseOrderID = poId
                };
                await _context.Trades.AddAsync(trade);
                await _context.SaveChangesAsync();

                foreach (var poItem in poItems)
                {
                    var received = receivedByProduct.FirstOrDefault(x => x.ProductID == poItem.ProductID)?.TotalQty ?? 0;
                    var remainingQty = poItem.Quantity - received;
                    if (remainingQty <= 0) continue;

                    var siItem = new StockInItem
                    {
                        TradeID = trade.ID,
                        ProductID = poItem.ProductID,
                        Quantity = remainingQty
                    };
                    await _context.StockInItems.AddAsync(siItem);
                }
                await _context.SaveChangesAsync();

                if (_audit != null)
                {
                    try { await _audit.WriteAsync("StockIn", "CreateFromPO", trade.ID.ToString(), new { trade.No, poId, poNo = po.No }); } catch { }
                }
                return new { success = true, id = trade.ID, no = trade.No };
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
        }

        public async Task<object> GetApprovedPurchaseOrders()
        {
            return await _context.Trades
                .Where(t => t.TradeTypeID == 4 && t.StatusID == 3)
                .Select(t => new { id = t.ID, no = t.No, date = t.Date.ToString("yyyy-MM-dd"), amount = t.Amount })
                .OrderByDescending(t => t.id)
                .ToListAsync();
        }

        public async Task<object> ScanBarcode(string barcode)
        {
            try
            {
                var scanned = (await _procedure.uspBarcodeScanAsync(barcode)).FirstOrDefault();
                if (scanned == null)
                {
                    return new { success = false, result = "Barcode not found" };
                }

                // Add live stock from Products table so POS can block out-of-stock items.
                var stockQty = await _context.Products.AsNoTracking()
                    .Where(p => p.ID == scanned.ID)
                    .Select(p => p.StockQuantity)
                    .FirstOrDefaultAsync();

                return new
                {
                    scanned.ID,
                    scanned.Name,
                    scanned.UnitPrice,
                    scanned.SupplierID,
                    scanned.Barcode,
                    scanned.SupplierName,
                    StockQuantity = stockQty
                };
            }
            catch (Exception e)
            {
                return new { success = false, result = e.Message };
            }
        }
    }
}
