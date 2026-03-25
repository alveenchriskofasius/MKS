namespace API.Services.Interfaces
{
    public interface IStoreProfileService
    {
        Task<object> GetProfile();
        Task<object> SaveProfile(Dictionary<string, string> settings);
    }
}
