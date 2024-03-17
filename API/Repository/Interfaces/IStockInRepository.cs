﻿using API.Context.SP;
using API.Context.Table;
using MitraKaryaSystem.Models;

namespace API.Repository.Interfaces
{
    public interface IStockInRepository
    {
        Task<StockInModel> FillForm(int id);
        Task<StockInDetailModel> FillFormDetail(int id);
        Task<List<Trade>> GetPurchaseOrderBySearch();
        Task<object> ScanBarcode(string barcode);
        Task<object> Save(StockInModel purchaseOrderModel);
        Task<object> GetTradeList();
        Task<List<uspGetDetailListByIdResult>> GetDetailListById(int id);
        Task<object> DeleteProductById(int id);
        Task<object> DeleteById(int id);
    }
}
