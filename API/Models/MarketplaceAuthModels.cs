using System.ComponentModel.DataAnnotations;

namespace API.Models
{
    public class MarketplaceRegisterModel
    {
        [Required(ErrorMessage = "Nama wajib diisi")]
        public string Name { get; set; } = "";

        [Required(ErrorMessage = "No. HP wajib diisi")]
        public string Phone { get; set; } = "";

        [Required(ErrorMessage = "Alamat wajib diisi")]
        public string Address { get; set; } = "";

        [Required(ErrorMessage = "Email wajib diisi")]
        [EmailAddress(ErrorMessage = "Format email tidak valid")]
        public string Email { get; set; } = "";

        [Required(ErrorMessage = "Password wajib diisi")]
        [MinLength(6, ErrorMessage = "Password minimal 6 karakter")]
        public string Password { get; set; } = "";
    }

    public class MarketplaceLoginModel
    {
        [Required(ErrorMessage = "Email wajib diisi")]
        public string Email { get; set; } = "";

        [Required(ErrorMessage = "Password wajib diisi")]
        public string Password { get; set; } = "";
    }

    public class MarketplaceCustomerInfo
    {
        public int ID { get; set; }
        public string Name { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Address { get; set; } = "";
        public string Email { get; set; } = "";
    }
}
