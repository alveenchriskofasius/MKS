﻿using API.Context.SP;
using MitraKaryaSystem.Models;

namespace API.Services.Interfaces
{
    public interface IStockInService
    {
        Task<StockInModel> FillForm(int id);
        Task<StockInDetailModel> FillFormDetail(int id);
        Task<object> ScanBarcode(string barcode);
        Task<object> Save(StockInModel stockIn);
        Task<object> GetStockInList();
        Task<List<uspGetDetailListByIdResult>> GetDetailListById(int id);
        Task<object> DeleteProductById(int id);
        Task<object> DeleteById(int id);
    }
}
