using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services
{
    public class PurchaseOrderService : IPurchaseOrderService
    {
        private readonly IPurchaseOrderRepository _repo;
        public PurchaseOrderService(IPurchaseOrderRepository repo) => _repo = repo;
        public Task<PurchaseOrderModel> FillForm(int id) => _repo.FillForm(id);
        public Task<object> GetSearchList() => _repo.GetSearchList();
        public Task<object> GetDetailListById(int id) => _repo.GetDetailListById(id);
        public Task<object> Save(PurchaseOrderModel model) => _repo.Save(model);
        public Task<object> Delete(int id) => _repo.Delete(id);
        public Task<object> DeleteItem(int id) => _repo.DeleteItem(id);
        public Task<object> GetListBySupplier(int supplierId) => _repo.GetListBySupplier(supplierId);
    }
}
