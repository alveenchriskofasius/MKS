using API.Models;

namespace API.Repository.Interfaces
{
    public interface IMarketplaceAuthRepository
    {
        Task<object> Register(MarketplaceRegisterModel model);
        Task<MarketplaceCustomerInfo?> Login(string email, string password);
        Task<MarketplaceCustomerInfo?> GetCustomerById(int customerId);
        Task<object> UpdateProfile(int customerId, string name, string phone, string address);
        Task SaveCart(int customerId, string cartJson);
        Task<string?> GetCart(int customerId);
        Task SaveWishlist(int customerId, string wishlistJson);
        Task<string?> GetWishlist(int customerId);
        Task<object> ChangePassword(int customerId, string currentPassword, string newPassword);
    }
}
