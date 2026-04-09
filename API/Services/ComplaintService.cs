using API.Models;
using API.Repository.Interfaces;
using API.Services.Interfaces;

namespace API.Services;

public class ComplaintService : IComplaintService
{
    private readonly IComplaintRepository _repo;

    public ComplaintService(IComplaintRepository repo)
    {
        _repo = repo;
    }

    public Task<object> Create(int customerId, ComplaintCreateModel model)
        => _repo.Create(customerId, model);

    public Task<List<ComplaintListItem>> GetByCustomer(int customerId)
        => _repo.GetByCustomer(customerId);

    public Task<List<ComplaintListItem>> GetAll()
        => _repo.GetAll();

    public Task<ComplaintListItem?> GetById(int id)
        => _repo.GetById(id);

    public Task<object> UpdateStatus(int id, string status, string? adminNote)
        => _repo.UpdateStatus(id, status, adminNote);
}
