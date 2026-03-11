namespace API.Models;

public class CustomerDepositModel
{
    public int ID { get; set; }
    public int SupplierID { get; set; }
    public string SupplierName { get; set; }
    public decimal Amount { get; set; }
    public string CreatedBy { get; set; }
    public DateTime? CreatedAt { get; set; }
    public string UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
