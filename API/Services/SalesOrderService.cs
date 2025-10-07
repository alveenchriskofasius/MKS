using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services
{
    public class SalesOrderService : ISalesOrderService
    {
        private readonly ISalesOrderRepository _salesOrderRepository;
        public SalesOrderService(ISalesOrderRepository salesOrderRepository) => _salesOrderRepository = salesOrderRepository;
        public async Task<object> Delete(int id) => await _salesOrderRepository.Delete(id);
        public async Task<object> DeleteProductById(int id) => await _salesOrderRepository.DeleteProductById(id);
        public async Task<SalesOrderModel> FillForm(int id) => await _salesOrderRepository.FillForm(id);
        public async Task<object> GetSalesOrderDetailById(int id) => await _salesOrderRepository.GetSalesOrderDetailById(id);

        public Task<List<SalesOrderDetailModel>> GetSalesOrderDetailModelById(int id) => _salesOrderRepository.GetSalesOrderDetailModelById(id);

        public async Task<object> GetSearchList() => await _salesOrderRepository.GetSearchList();
        public async Task<object> Save(SalesOrderModel salesOrder) => await _salesOrderRepository.Save(salesOrder);
    }
}
