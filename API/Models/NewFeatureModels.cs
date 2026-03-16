namespace API.Models;

// ==================== Profit & Loss ====================
public class ProfitLossRequest
{
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
}

public class ProfitLossResult
{
    public decimal Revenue { get; set; }
    public decimal COGS { get; set; }
    public decimal GrossProfit { get; set; }
    public decimal Expenses { get; set; }
    public decimal NetProfit { get; set; }
    public List<ProfitLossLine> RevenueLines { get; set; } = [];
    public List<ProfitLossLine> ExpenseLines { get; set; } = [];
}

public class ProfitLossLine
{
    public string Category { get; set; }
    public decimal Amount { get; set; }
}

// ==================== Price History ====================
public class PriceHistoryItem
{
    public long Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; }
    public decimal OldPrice { get; set; }
    public decimal NewPrice { get; set; }
    public string ChangedBy { get; set; }
    public DateTime ChangedAt { get; set; }
    public string Source { get; set; }
    public string Note { get; set; }
}

public class PriceListItem
{
    public int ProductId { get; set; }
    public string ProductName { get; set; }
    public string Category { get; set; }
    public string Supplier { get; set; }
    public decimal CurrentPrice { get; set; }
    public bool HasDiscount { get; set; }
    public decimal DiscountPct { get; set; }
    public decimal EffectivePrice { get; set; }
    public int Stock { get; set; }
    public DateTime? LastChanged { get; set; }
}

// ==================== Notification / Alert ====================
public class AlertItem
{
    public string Type { get; set; }   // LowStock, OverdueDebt, PendingApproval, ExpiringConsignment
    public string Severity { get; set; } // danger, warning, info
    public string Title { get; set; }
    public string Message { get; set; }
    public string Link { get; set; }
    public DateTime Date { get; set; }
    public object Data { get; set; }
}

// ==================== Customer Statement ====================
public class CustomerStatementRequest
{
    public int CustomerId { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
}

public class CustomerStatementResult
{
    public int CustomerId { get; set; }
    public string CustomerName { get; set; }
    public decimal TotalInvoiced { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal TotalDeposit { get; set; }
    public decimal OutstandingBalance { get; set; }
    public List<StatementLine> Lines { get; set; } = [];
}

public class StatementLine
{
    public DateTime Date { get; set; }
    public string No { get; set; }
    public string Type { get; set; }  // Invoice, Payment, Deposit
    public string Description { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public decimal Balance { get; set; }
}

// ==================== Promo ====================
public class PromoModel
{
    public int Id { get; set; }
    public string Name { get; set; }
    public decimal DiscountPct { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string ApplyTo { get; set; }
    public byte? CategoryId { get; set; }
    public int? ProductId { get; set; }
    public bool IsActive { get; set; }
}

public class PromoListItem
{
    public int Id { get; set; }
    public string Name { get; set; }
    public decimal DiscountPct { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string ApplyTo { get; set; }
    public string TargetName { get; set; }
    public bool IsActive { get; set; }
    public string Status { get; set; }
    public int AffectedProducts { get; set; }
    public string CreatedBy { get; set; }
}

// ==================== Customer Aging ====================
public class CustomerAgingResult
{
    public DateTime AsOfDate { get; set; }
    public decimal TotalOutstanding { get; set; }
    public decimal TotalCurrent { get; set; }
    public decimal Total31_60 { get; set; }
    public decimal Total61_90 { get; set; }
    public decimal TotalOver90 { get; set; }
    public List<CustomerAgingRow> Rows { get; set; } = [];
}

public class CustomerAgingRow
{
    public int CustomerID { get; set; }
    public string CustomerName { get; set; }
    public decimal Current { get; set; }
    public decimal Days31_60 { get; set; }
    public decimal Days61_90 { get; set; }
    public decimal Over90 { get; set; }
    public decimal Total { get; set; }
    public int InvoiceCount { get; set; }
    public string OldestInvoiceDate { get; set; }
}
