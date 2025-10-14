using API.Models;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using MitraKaryaSystem.Security;

namespace MitraKaryaSystem.Controllers
{
    [HasPermission("Sales Order")]
    public class SalesOrderController : Controller
    {
        private readonly ISalesOrderService _salesOrderService;
        private readonly ICustomerService _customerService;
        private static readonly HashSet<short> ReturnEligibleStatuses = new() { 2, 8 }; // Paid, Completed(Delivered)
        public SalesOrderController(ISalesOrderService salesOrderService, ICustomerService customerService)
        {
            _salesOrderService = salesOrderService;
            _customerService = customerService;
        }
        public IActionResult Index() => View();

        public async Task<IActionResult> FillForm(int id)
        {
            var customers = await _customerService.GetListModel();
            var salesOrder = new SalesOrderViewModel
            {
                Customers = customers.Select(x => new SelectListItem { Value = x.ID.ToString(), Text = x.Name }).ToList(),
                SalesOrder = await _salesOrderService.FillForm(id)
            };
            salesOrder.Customers.Insert(0, new SelectListItem { Selected = true, Value = "0", Text = "Umum" });
            return PartialView("_Form", salesOrder);
        }
        [HttpPost]
        public async Task<JsonResult> Save(SalesOrderModel salesOrder) => Json(await _salesOrderService.Save(salesOrder));
        public async Task<JsonResult> FillGrid() => Json(await _salesOrderService.GetSearchList());
        public async Task<JsonResult> GetDetailListById(int id) => Json(await _salesOrderService.GetSalesOrderDetailById(id));
        public async Task<object> DeleteItem(int id) => Json(await _salesOrderService.DeleteProductById(id));
        public async Task<object> Delete(int id) => Json(await _salesOrderService.Delete(id));

        [HttpGet]
        public async Task<JsonResult> ReturnSourceList()
        {
            var raw = await _salesOrderService.GetSearchList();
            // raw may be an IEnumerable of anonymous objects or already a list
            var list = new List<object>();
            if (raw is System.Collections.IEnumerable enumerable)
            {
                foreach (var item in enumerable)
                {
                    if (item == null) continue;
                    short statusId = 0;
                    var type = item.GetType();
                    var statusProp = type.GetProperty("StatusID") ?? type.GetProperty("statusID") ?? type.GetProperty("StatusId") ?? type.GetProperty("statusId");
                    if (statusProp != null)
                    {
                        var val = statusProp.GetValue(item);
                        if (val != null && short.TryParse(val.ToString(), out var parsed)) statusId = parsed;
                    }
                    if (ReturnEligibleStatuses.Contains(statusId))
                    {
                        list.Add(item);
                    }
                }
            }
            return Json(list);
        }
    }
}
