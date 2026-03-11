namespace API.Models;

public class ExpenseModel
{
    public int ID { get; set; }
    public DateTime Date { get; set; } = DateTime.Now;
    public string No { get; set; }
    public string Category { get; set; }
    public string Description { get; set; }
    public decimal Amount { get; set; }
}

public class ExpenseListItem
{
    public int ID { get; set; }
    public string No { get; set; }
    public string Date { get; set; }
    public string Category { get; set; }
    public string Description { get; set; }
    public decimal Amount { get; set; }
    public string CreatedBy { get; set; }
}

public class ExpenseSummary
{
    public decimal TotalThisMonth { get; set; }
    public decimal TotalLastMonth { get; set; }
    public List<ExpenseCategorySummary> ByCategory { get; set; } = new();
}

public class ExpenseCategorySummary
{
    public string Category { get; set; }
    public decimal Total { get; set; }
    public int Count { get; set; }
}
