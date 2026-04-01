namespace MitraKaryaSystem.Models
{
    public class ProductViewModel
    {
        public CategoryModel? CategoryModel { get; set; } = new CategoryModel();
        public UnitModel? UnitModel { get; set; } = new UnitModel();
        public ProductModel ProductModel { get; set; } = new ProductModel();
        public IFormFile? ImageFile { get; set; }
    }
}
