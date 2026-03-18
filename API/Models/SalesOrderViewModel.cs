using Microsoft.AspNetCore.Mvc.Rendering;
using API.Context.Table;

namespace API.Models
{
    public class SalesOrderViewModel
    {
        public SalesOrderModel SalesOrder { get; set; } = new SalesOrderModel();
        public List<SelectListItem> Customers { get; set; } = new List<SelectListItem>();
        public List<Customer> CustomerList { get; set; } = new List<Customer>();
    }
}
