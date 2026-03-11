namespace API.Models;

public class DebtSummaryItem
{
    public int TradeID { get; set; }
    public string No { get; set; }
    public string Date { get; set; }
    public string Type { get; set; }
    public int? CustomerID { get; set; }
    public string CustomerName { get; set; }
    public decimal Amount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal Outstanding { get; set; }
    public short? StatusID { get; set; }
}
