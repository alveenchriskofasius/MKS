﻿// <auto-generated> This file has been auto generated by EF Core Power Tools. </auto-generated>
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace API.Context.SP
{
    public partial class uspBarcodeScanResult
    {
        public int ID { get; set; }
        public string Name { get; set; }
        [Column("UnitPrice", TypeName = "decimal(10,2)")]
        public decimal UnitPrice { get; set; }
        public short SupplierID { get; set; }
        public string Barcode { get; set; }
        public string SupplierName { get; set; }
    }
}
