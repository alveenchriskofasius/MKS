#nullable disable
using System;

namespace API.Context.Table;

public partial class SalesPerson
{
    public int ID { get; set; }

    public int SupplierID { get; set; }

    public string Name { get; set; }

    public string Company { get; set; }

    public string Contact { get; set; }

    public bool IsActive { get; set; }
}
