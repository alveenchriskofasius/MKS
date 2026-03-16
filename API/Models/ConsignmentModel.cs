namespace API.Models;

public class ConsignmentModel
{
    public int ID { get; set; }
    public DateTime Date { get; set; } = DateTime.Now;
    public string No { get; set; }
    public int SupplierID { get; set; }
    public int? SalesPersonID { get; set; }
    public string SalesPersonName { get; set; }
    public string SalesPersonCompany { get; set; }
    public string SalesPersonContact { get; set; }
    public short StatusID { get; set; } = 1;
    public string Note { get; set; }
    public List<ConsignmentItemModel> Items { get; set; } = new();
}

public class ConsignmentItemModel
{
    public int ID { get; set; }
    public int ConsignmentID { get; set; }
    public int ProductID { get; set; }
    public string ProductName { get; set; }
    public string UnitName { get; set; }
    public int Quantity { get; set; }
    public int SoldQuantity { get; set; }
    public int ReturnedQuantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal SellingPrice { get; set; }
}

public class ConsignmentListItem
{
    public int ID { get; set; }
    public string No { get; set; }
    public string Date { get; set; }
    public string SupplierName { get; set; }
    public string SalesPersonName { get; set; }
    public string SalesPersonCompany { get; set; }
    public string SalesPersonContact { get; set; }
    public short StatusID { get; set; }
    public string Status { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal SoldAmount { get; set; }
    public int TotalItems { get; set; }
    public int SoldItems { get; set; }
}

public class RecordSaleModel
{
    public int ConsignmentItemID { get; set; }
    public int Quantity { get; set; }
}

public class RecordReturnModel
{
    public int ConsignmentItemID { get; set; }
    public int Quantity { get; set; }
}
