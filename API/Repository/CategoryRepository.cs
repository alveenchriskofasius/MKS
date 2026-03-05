using API.Context.Table;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;
using MitraKaryaSystem.Models;

namespace API.Repository
{
    public class CategoryRepository : BaseRepository, ICategoryRepository
    {
        public CategoryRepository(MKSTableContext context, IHttpContextAccessor http)
            : base(context, http)
        {
        }

        public async Task<object> DeleteCategory(int id)
        {
            try
            {
                var entity = await _context.Categories.FindAsync(id);
                if (entity != null) _context.Categories.Remove(entity);
                await SaveChangesAsync();
                return new { success = true };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }

        public async Task<CategoryModel> FillFormCategory(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null) return new CategoryModel();
            return new CategoryModel { ID = category.ID, CategoryName = category.Name };
        }

        public async Task<object> GetCategoryList() => await _context.Categories.AsNoTracking().Select(x => new { x.ID, CategoryName = x.Name }).ToListAsync();

        public async Task<object> SaveCategory(CategoryModel categoryModel)
        {
            try
            {
                if (categoryModel.ID == 0)
                {
                    _context.Categories.Add(new Category { Name = categoryModel.CategoryName });
                }
                else
                {
                    var category = await _context.Categories.FindAsync(categoryModel.ID);
                    if (category == null) return new { success = false, error = "Category not found" };
                    category.Name = categoryModel.CategoryName;
                    _context.Categories.Update(category);
                }
                await SaveChangesAsync();
                return new { success = true };
            }
            catch (Exception e)
            {
                return CreateErrorResponse(e);
            }
        }
    }
}
