namespace API.Models;

public class StockCountModel
{
    public int ID { get; set; }
    public DateTime Date { get; set; } = DateTime.Now.Date;
    public string No { get; set; }
    public string Note { get; set; }
    public bool AutoAdjust { get; set; }
    public decimal TotalDiffValue { get; set; }
    public List<StockCountDetailModel> Items { get; set; } = new();
}

public class StockCountDetailModel
{
    public int ID { get; set; }
    public int ProductID { get; set; }
    public string ProductName { get; set; }
    public int SystemQty { get; set; }
    public int PhysicalQty { get; set; }
    public int DiffQty { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiffValue => DiffQty * UnitPrice;
}
