using System.ComponentModel.DataAnnotations;

namespace MitraKaryaSystem.Models
{
    public class RoleModel
    {
        public int ID { get; set; }
        [Required(ErrorMessage = "Role Name is required")]
        public string? Name { get; set; }

        public string? Description { get; set; }
        public bool IsAssigned { get; set; }
    }
}
