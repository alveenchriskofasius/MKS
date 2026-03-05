using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services
{
    public class SalesOrderService : ISalesOrderService
    {
        private readonly ISalesOrderRepository _salesOrderRepository;

        public SalesOrderService(
            ISalesOrderRepository salesOrderRepository)
        {
            _salesOrderRepository = salesOrderRepository;
        }

        public async Task<object> Delete(int id)
        {
            return await _salesOrderRepository.Delete(id);
        }

        public async Task<object> DeleteProductById(int id)
        {
            return await _salesOrderRepository.DeleteProductById(id);
        }

        public async Task<SalesOrderModel> FillForm(int id)
        {
            return await _salesOrderRepository.FillForm(id);
        }

        public async Task<object> GetSalesOrderDetailById(int id)
        {
            return await _salesOrderRepository.GetSalesOrderDetailById(id);
        }

        public Task<List<SalesOrderDetailModel>> GetSalesOrderDetailModelById(int id)
        {
            return _salesOrderRepository.GetSalesOrderDetailModelById(id);
        }

        public async Task<object> GetSearchList()
        {
            return await _salesOrderRepository.GetSearchList();
        }

        public async Task<object> Save(SalesOrderModel salesOrder)
        {
            return await _salesOrderRepository.Save(salesOrder);
        }
    }
}
