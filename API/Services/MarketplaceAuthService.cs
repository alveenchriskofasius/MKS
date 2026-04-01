using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services
{
    public class MarketplaceAuthService : IMarketplaceAuthService
    {
        private readonly IMarketplaceAuthRepository _repository;

        public MarketplaceAuthService(IMarketplaceAuthRepository repository)
        {
            _repository = repository;
        }

        public async Task<object> Register(MarketplaceRegisterModel model)
        {
            return await _repository.Register(model);
        }

        public async Task<MarketplaceCustomerInfo?> Login(string email, string password)
        {
            return await _repository.Login(email, password);
        }

        public async Task<MarketplaceCustomerInfo?> GetCustomerById(int customerId)
        {
            return await _repository.GetCustomerById(customerId);
        }

        public async Task<object> UpdateProfile(
            int customerId,
            string name,
            string phone,
            string address)
        {
            return await _repository.UpdateProfile(customerId, name, phone, address);
        }

        public async Task SaveCart(int customerId, string cartJson)
        {
            await _repository.SaveCart(customerId, cartJson);
        }

        public async Task<string?> GetCart(int customerId)
        {
            return await _repository.GetCart(customerId);
        }

        public async Task SaveWishlist(int customerId, string wishlistJson)
        {
            await _repository.SaveWishlist(customerId, wishlistJson);
        }

        public async Task<string?> GetWishlist(int customerId)
        {
            return await _repository.GetWishlist(customerId);
        }
    }
}
