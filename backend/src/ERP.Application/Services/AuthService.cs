using ERP.Application.Abstractions;
using ERP.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace ERP.Application.Services;

// ─── DTOs ────────────────────────────────────────────────────────────────────

public record LoginRequest(string Username, string Password);

public record RefreshRequest(string RefreshToken);

public record AuthResult(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    string Role,
    string Username);

// ─── Interface ───────────────────────────────────────────────────────────────

public interface IAuthService
{
    Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken ct = default);
    Task RevokeAsync(string refreshToken, CancellationToken ct = default);
}

// ─── Implementation ──────────────────────────────────────────────────────────

public class AuthService(IErpDbContext db, IConfiguration configuration) : IAuthService
{
    private readonly string _jwtSecret = configuration["Jwt:Secret"]
        ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
    private readonly int _accessTokenMinutes = int.Parse(configuration["Jwt:ExpiryMinutes"] ?? "15");
    private readonly int _refreshTokenDays = 7;

    public async Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive, ct)
            ?? throw new UnauthorizedAccessException("Kullanıcı adı veya şifre hatalı.");

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Kullanıcı adı veya şifre hatalı.");

        return await GenerateAndSaveTokens(user, ct);
    }

    public async Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.RefreshToken == refreshToken && u.IsActive, ct)
            ?? throw new UnauthorizedAccessException("Geçersiz refresh token.");

        if (user.RefreshTokenExpiry < DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token süresi dolmuş. Lütfen tekrar giriş yapın.");

        return await GenerateAndSaveTokens(user, ct);
    }

    public async Task RevokeAsync(string refreshToken, CancellationToken ct = default)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.RefreshToken == refreshToken, ct);

        if (user is not null)
        {
            user.RefreshToken = null;
            user.RefreshTokenExpiry = null;
            await db.SaveChangesAsync(ct);
        }
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private async Task<AuthResult> GenerateAndSaveTokens(User user, CancellationToken ct)
    {
        var (accessToken, expiresAt) = GenerateAccessToken(user);
        var refreshToken = GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(_refreshTokenDays);
        await db.SaveChangesAsync(ct);

        return new AuthResult(accessToken, refreshToken, expiresAt, user.Role, user.Username);
    }

    private (string Token, DateTime ExpiresAt) GenerateAccessToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddMinutes(_accessTokenMinutes);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email ?? ""),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("username", user.Username),
            new Claim("role", user.Role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    private static string GenerateRefreshToken()
    {
        var bytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
    }
}
