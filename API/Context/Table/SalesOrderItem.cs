﻿// <auto-generated> This file has been auto generated by EF Core Power Tools. </auto-generated>
#nullable disable
using System;
using System.Collections.Generic;

namespace API.Context.Table;

public partial class SalesOrderItem
{
    public int ID { get; set; }

    public int? SalesOrderID { get; set; }

    public int? ProductID { get; set; }

    public int Quantity { get; set; }

    public decimal Price { get; set; }
}