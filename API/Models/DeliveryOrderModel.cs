namespace API.Models;
public class DeliveryOrderModel
{
    public int ID { get; set; }
    public string No { get; set; }
    public int SalesOrderID { get; set; }
    public short StatusID { get; set; } = 1; // Pending
    public int? DriverUserID { get; set; }
    public string DeliveryAddress { get; set; }
    public DateTime? AssignedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public List<DeliveryOrderItemModel> Items { get; set; } = new();
}
public class DeliveryOrderItemModel
{
    public int ID { get; set; }
    public int DeliveryOrderID { get; set; }
    public int SalesOrderItemID { get; set; }
    public int ProductID { get; set; }
    public int Quantity { get; set; }
}
