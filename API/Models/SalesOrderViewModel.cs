using Microsoft.AspNetCore.Mvc.Rendering;

namespace API.Models
{
    public class SalesOrderViewModel
    {
        public SalesOrderModel SalesOrder { get; set; } = new SalesOrderModel();
        public List<SelectListItem> Customers { get; set; } = new List<SelectListItem>();
    }
}
