namespace API.Models;

// Shared trade status enums for consistency across repositories
public enum SalesOrderStatus
{
    Draft = 1,
    Paid = 2,
    Debt = 3,
    PartialRefund = 4,
    Refund = 5,
    Exchange = 6,
    PartialExchange = 7,
    Completed = 8
}

public enum SalesInvoiceStatus
{
    Draft = 1,
    PartiallyPaid = 3,
    Paid = 4
}

public enum PurchaseReturnStatus
{
    Draft = 1,
    Submitted = 2,
    Approved = 3,
    Rejected = 4
}
