using ERP.Application.Abstractions;
using ERP.Application.Dto;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ERP.Application.Services;

public interface IUserService
{
    Task<IReadOnlyList<UserDto>> GetAsync(CancellationToken ct = default);
    Task<UserDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default);
    Task<bool> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}

public class UserService(IErpDbContext db) : IUserService
{
    private static UserDto ToDto(User u) =>
        new(u.Id, u.Username, u.Email, u.Role, u.IsActive, u.CreatedAt);

    public async Task<IReadOnlyList<UserDto>> GetAsync(CancellationToken ct = default)
    {
        return await db.Users.AsNoTracking()
            .OrderBy(u => u.Username)
            .Select(u => new UserDto(u.Id, u.Username, u.Email, u.Role, u.IsActive, u.CreatedAt))
            .ToListAsync(ct);
    }

    public async Task<UserDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
        return u is null ? null : ToDto(u);
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        var exists = await db.Users.AnyAsync(u => u.Username == request.Username, ct);
        if (exists)
            throw new InvalidOperationException($"'{request.Username}' kullanıcı adı zaten kullanılıyor.");

        string? normalizedEmail = null;
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            normalizedEmail = request.Email.Trim().ToLowerInvariant();
            var emailExists = await db.Users.AnyAsync(u => u.Email == normalizedEmail, ct);
            if (emailExists)
                throw new InvalidOperationException($"'{request.Email}' e-posta adresi zaten kullanılıyor.");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username.Trim(),
            Email = normalizedEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = request.Role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return ToDto(user);
    }

    public async Task<bool> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default)
    {
        var user = await db.Users.FindAsync([id], ct);
        if (user is null) return false;

        // Check uniqueness (excluding self)
        var usernameTaken = await db.Users.AnyAsync(u => u.Username == request.Username && u.Id != id, ct);
        if (usernameTaken)
            throw new InvalidOperationException($"'{request.Username}' kullanıcı adı zaten kullanılıyor.");

        string? normalizedEmail = null;
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            normalizedEmail = request.Email.Trim().ToLowerInvariant();
            var emailTaken = await db.Users.AnyAsync(u => u.Email == normalizedEmail && u.Id != id, ct);
            if (emailTaken)
                throw new InvalidOperationException($"'{request.Email}' e-posta adresi zaten kullanılıyor.");
        }

        user.Username = request.Username.Trim();
        user.Email = normalizedEmail;
        user.Role = request.Role;
        user.IsActive = request.IsActive;

        if (!string.IsNullOrWhiteSpace(request.NewPassword))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var user = await db.Users.FindAsync([id], ct);
        if (user is null) return false;

        // Admin kullanıcısını silme
        if (user.Username == "admin")
            throw new InvalidOperationException("Varsayılan admin kullanıcısı silinemez.");

        // Son aktif admin'i silme
        if (user.Role == "Admin")
        {
            var activeAdminCount = await db.Users.CountAsync(u => u.Role == "Admin" && u.IsActive, ct);
            if (activeAdminCount <= 1)
                throw new InvalidOperationException("En az bir aktif admin kullanıcı olması gerekiyor.");
        }

        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
