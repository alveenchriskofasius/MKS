namespace API.Models;

public class ComplaintCreateModel
{
    public int OrderID { get; set; }
    public string Reason { get; set; } = "";
}

public class ComplaintListItem
{
    public int ID { get; set; }
    public int OrderID { get; set; }
    public string OrderNo { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string Reason { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? AdminNote { get; set; }
    public decimal OrderAmount { get; set; }
}
