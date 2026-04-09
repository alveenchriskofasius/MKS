using API.Context.Table;
using API.Models;
using API.Repository.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Repository;

public class ComplaintRepository : BaseRepository, IComplaintRepository
{
    public ComplaintRepository(
        MKSTableContext context,
        IHttpContextAccessor http)
        : base(context, http)
    {
    }

    public async Task<object> Create(int customerId, ComplaintCreateModel model)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(model.Reason))
                return new { success = false, message = "Alasan komplain harus diisi." };

            var order = await _context.Trades
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.ID == model.OrderID && t.CustomerID == customerId && t.TradeTypeID == 4);

            if (order == null)
                return new { success = false, message = "Pesanan tidak ditemukan." };

            var existing = await _context.Complaints
                .AsNoTracking()
                .AnyAsync(c => c.OrderID == model.OrderID && c.CustomerID == customerId);

            if (existing)
                return new { success = false, message = "Komplain untuk pesanan ini sudah pernah diajukan." };

            var complaint = new Complaint
            {
                OrderID = model.OrderID,
                CustomerID = customerId,
                Reason = model.Reason.Trim(),
                Status = "Pending",
                CreatedAt = DateTime.Now
            };

            _context.Complaints.Add(complaint);
            await SaveChangesAsync();

            return new { success = true, message = "Komplain berhasil diajukan." };
        }
        catch (Exception e)
        {
            return CreateErrorResponse(e);
        }
    }

    public async Task<List<ComplaintListItem>> GetByCustomer(int customerId)
    {
        var complaints = await _context.Complaints
            .AsNoTracking()
            .Where(c => c.CustomerID == customerId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return await MapToListItems(complaints);
    }

    public async Task<List<ComplaintListItem>> GetAll()
    {
        var complaints = await _context.Complaints
            .AsNoTracking()
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return await MapToListItems(complaints);
    }

    public async Task<ComplaintListItem?> GetById(int id)
    {
        var complaint = await _context.Complaints
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.ID == id);

        if (complaint == null) return null;

        var items = await MapToListItems(new List<Complaint> { complaint });
        return items.FirstOrDefault();
    }

    public async Task<object> UpdateStatus(int id, string status, string? adminNote)
    {
        try
        {
            var complaint = await _context.Complaints.FindAsync(id);
            if (complaint == null)
                return new { success = false, message = "Komplain tidak ditemukan." };

            complaint.Status = status;
            complaint.AdminNote = adminNote;

            if (status == "Resolved" || status == "Rejected")
                complaint.ResolvedAt = DateTime.Now;

            await SaveChangesAsync();
            return new { success = true, message = "Status komplain berhasil diperbarui." };
        }
        catch (Exception e)
        {
            return CreateErrorResponse(e);
        }
    }

    private async Task<List<ComplaintListItem>> MapToListItems(List<Complaint> complaints)
    {
        if (!complaints.Any()) return new();

        var orderIds = complaints.Select(c => c.OrderID).Distinct().ToList();
        var customerIds = complaints.Select(c => c.CustomerID).Distinct().ToList();

        var orders = await _context.Trades
            .AsNoTracking()
            .Where(t => orderIds.Contains(t.ID))
            .Select(t => new { t.ID, t.No, t.Amount })
            .ToDictionaryAsync(t => t.ID);

        var customers = await _context.Customers
            .AsNoTracking()
            .Where(c => customerIds.Contains(c.ID))
            .Select(c => new { c.ID, c.Name })
            .ToDictionaryAsync(c => c.ID);

        return complaints.Select(c =>
        {
            orders.TryGetValue(c.OrderID, out var order);
            customers.TryGetValue(c.CustomerID, out var customer);
            return new ComplaintListItem
            {
                ID = c.ID,
                OrderID = c.OrderID,
                OrderNo = order?.No ?? "-",
                CustomerName = customer?.Name ?? "-",
                Reason = c.Reason,
                Status = c.Status,
                CreatedAt = c.CreatedAt,
                ResolvedAt = c.ResolvedAt,
                AdminNote = c.AdminNote,
                OrderAmount = order?.Amount ?? 0
            };
        }).ToList();
    }
}
