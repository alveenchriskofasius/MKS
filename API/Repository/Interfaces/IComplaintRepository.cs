using API.Models;

namespace API.Repository.Interfaces;

public interface IComplaintRepository
{
    Task<object> Create(int customerId, ComplaintCreateModel model);
    Task<List<ComplaintListItem>> GetByCustomer(int customerId);
    Task<List<ComplaintListItem>> GetAll();
    Task<ComplaintListItem?> GetById(int id);
    Task<object> UpdateStatus(int id, string status, string? adminNote);
}
