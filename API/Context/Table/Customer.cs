﻿// <auto-generated> This file has been auto generated by EF Core Power Tools. </auto-generated>
#nullable disable
using System;
using System.Collections.Generic;

namespace API.Context.Table;

public partial class Customer
{
    public int ID { get; set; }

    public string Name { get; set; }

    public string ContactNumber { get; set; }

    public string Address { get; set; }

    public string ContactPerson { get; set; }

    public bool IsSupplier { get; set; }

    public string CreatedBy { get; set; }

    public DateTime? CreatedAt { get; set; }

    public string UpdatedBy { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string Note { get; set; }
}