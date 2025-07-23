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
        public async Task<object> GetSearchList() => await _procedure.GetSalesOrderListAsync();
        public async Task<object> Save(SalesOrderModel salesOrder)
        {
            try
            {
                int tradeID = 0;

                if (salesOrder.ID == 0)
                {
                    var newTrade = new Trade
                    {
                        No = _procedure.uspGenerateNoAsync("SO", salesOrder.Date).Result.FirstOrDefault().NewPONumber,
                        Amount = salesOrder.SalesOrderDetails.Sum(x => x.Subtotal),
                        CustomerID = salesOrder.CustomerID,
                        CreatedBy = _httpContextAccessor.HttpContext.User.Identity.Name,
                        Date = salesOrder.Date,
                        StatusID = 1,
                        TradeTypeID = 2,
                        CreatedAt = DateTime.Now,
                        Note = salesOrder.Note
                    };
                    await _context.Trades.AddAsync(newTrade);
                    await _context.SaveChangesAsync();
                    tradeID = newTrade.ID;
                }
                else
                {
                    var existingTrade = await _context.Trades.FindAsync(salesOrder.ID);

                    existingTrade.Amount = salesOrder.SalesOrderDetails.Sum(x => x.Subtotal);
                    existingTrade.CustomerID = salesOrder.CustomerID;
                    existingTrade.UpdatedAt = DateTime.Now;
                    existingTrade.UpdatedBy = _httpContextAccessor.HttpContext.User.Identity.Name;
                    existingTrade.Date = salesOrder.Date;
                    existingTrade.StatusID = salesOrder.StatusID;
                    existingTrade.Note = salesOrder.Note;
                    await _context.SaveChangesAsync();
                }
                foreach (SalesOrderDetailModel salesOrderDetail in salesOrder.SalesOrderDetails)
                {
                    await SaveProduct(salesOrderDetail, tradeID);
                }
                return new { success = true };
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
                var trade = await _context.Trades.FindAsync(tradeID);

                if (product == null)
                {
                    return new { success = false, result = "Product not found." };
                }

                if (salesOrderDetailModel.ID == 0)
                {
                    // New sales order item
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
                    // Existing sales order item
                    var existingProduct = await _context.SalesOrderItems.FindAsync(salesOrderDetailModel.ID);
                    if (existingProduct == null)
                    {
                        return new { success = false, result = "Sales Order Item not found." };
                    }

                    // Calculate the difference between old and new quantity
                    var quantityDifference = salesOrderDetailModel.Quantity - existingProduct.Quantity;

                    // Adjust stock based on the difference
                    product.StockQuantity -= quantityDifference;

                    // Update the existing product's quantity
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
