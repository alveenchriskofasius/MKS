namespace API.Models;

public class SalesPersonModel
{
    public int ID { get; set; }
    public int SupplierID { get; set; }
    public string Name { get; set; }
    public string Company { get; set; }
    public string Contact { get; set; }
    public bool IsActive { get; set; } = true;
}
