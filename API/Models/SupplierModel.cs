using System.ComponentModel.DataAnnotations;

namespace MitraKaryaSystem.Models
{
    public class SupplierModel
    {
        public int ID { get; set; }
        [Required(ErrorMessage = "Name is required")]
        public string SupplierName { get; set; }
        [Required(ErrorMessage = "Contact Person is required")]
        public string ContactPerson { get; set; }
        [Required(ErrorMessage = "Contact Number is required")]
        public string ContactNumber { get; set; }
        public string Address { get; set; }
        public string Note { get; set; }
    }
}
