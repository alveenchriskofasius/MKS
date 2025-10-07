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
            Debt = 3
        }
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
                    Note = trade.Note
                };
            }
            return salesOrder;
        }
        public async Task<object> GetSalesOrderDetailById(int id) => await _procedure.uspGetSalesOrderItemListAsync(id);
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
                // Guard clauses
                salesOrder.SalesOrderDetails ??= new List<SalesOrderDetailModel>();

                Trade tradeEntity;
                if (salesOrder.ID == 0)
                {
                    // Generate number asynchronously (avoid .Result deadlock risk)
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
                        Note = salesOrder.Note
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
                    tradeEntity.Amount = salesOrder.SalesOrderDetails.Sum(x => x.Subtotal);
                    tradeEntity.CustomerID = salesOrder.CustomerID;
                    tradeEntity.UpdatedAt = DateTime.Now;
                    tradeEntity.UpdatedBy = _httpContextAccessor.HttpContext?.User?.Identity?.Name;
                    tradeEntity.Date = salesOrder.Date;
                    tradeEntity.StatusID = salesOrder.IsPaid ? (short)TradeStatus.Paid : (short)TradeStatus.Draft;
                    tradeEntity.Note = salesOrder.Note;
                    await _context.SaveChangesAsync();
                }

                int tradeID = tradeEntity.ID; // Ensure tradeID always set

                foreach (SalesOrderDetailModel salesOrderDetail in salesOrder.SalesOrderDetails)
                {
                    var saveResult = await SaveProduct(salesOrderDetail, tradeID);
                    dynamic dyn = saveResult;
                    if (dyn.success == false)
                    {
                        return saveResult; // return validation error (e.g., insufficient stock)
                    }
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

                if (salesOrderDetailModel.ID == 0)
                {
                    // New sales order item -> validate stock first
                    if (salesOrderDetailModel.Quantity > product.StockQuantity)
                    {
                        return new { success = false, result = $"Insufficient stock for product. Available: {product.StockQuantity}" };
                    }

                    var newProduct = new SalesOrderItem
                    {
                        TradeID = tradeID,
                        ProductID = salesOrderDetailModel.ProductID,
                        Quantity = salesOrderDetailModel.Quantity
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

                    // Stock currently available including what was previously reserved by this line
                    var availableStock = product.StockQuantity + existingProduct.Quantity;
                    if (salesOrderDetailModel.Quantity > availableStock)
                    {
                        return new { success = false, result = $"Insufficient stock for product. Available: {availableStock}" };
                    }

                    var quantityDifference = salesOrderDetailModel.Quantity - existingProduct.Quantity; // can be negative
                    product.StockQuantity -= quantityDifference; // subtract if increased, add back if decreased (difference negative)
                    existingProduct.Quantity = salesOrderDetailModel.Quantity;
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
