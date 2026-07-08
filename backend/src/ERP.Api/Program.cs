using ERP.Application;
using ERP.Infrastructure;
using ERP.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.PostgreSQL;
using NpgsqlTypes;

try
{
    Serilog.Debugging.SelfLog.Enable(Console.Error);

    var builder = WebApplication.CreateBuilder(args);

    // Serilog Konfigürasyonu
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("Connection string 'DefaultConnection' was not found.");

    var columnOptions = new Dictionary<string, ColumnWriterBase>
    {
        { "message", new RenderedMessageColumnWriter(NpgsqlDbType.Text) },
        { "message_template", new MessageTemplateColumnWriter(NpgsqlDbType.Text) },
        { "level", new LevelColumnWriter(true, NpgsqlDbType.Varchar) },
        { "timestamp", new TimestampColumnWriter(NpgsqlDbType.TimestampTz) },
        { "exception", new ExceptionColumnWriter(NpgsqlDbType.Text) },
        { "properties", new LogEventSerializedColumnWriter(NpgsqlDbType.Jsonb) }
    };

    Log.Logger = new LoggerConfiguration()
        .MinimumLevel.Warning()
        .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
        .MinimumLevel.Override("System", LogEventLevel.Warning)
        .Enrich.FromLogContext()
        .WriteTo.Console(restrictedToMinimumLevel: LogEventLevel.Information)
        .WriteTo.PostgreSQL(
            connectionString: connectionString,
            tableName: "system_logs",
            columnOptions: columnOptions,
            needAutoCreateTable: false)
        .CreateLogger();

    builder.Host.UseSerilog();

    builder.Services.AddControllers();
    builder.Services.AddApplication();
    builder.Services.AddInfrastructure(builder.Configuration);

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("LanClients", policy =>
            policy.AllowAnyHeader()
                .AllowAnyMethod()
                .AllowAnyOrigin());
    });

    var app = builder.Build();

    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<ErpDbContext>();
        db.Database.Migrate();
    }

    app.UseCors("LanClients");

    app.UseAuthentication();
    app.UseAuthorization();

    app.UseMiddleware<ERP.Api.Middleware.LicenseMiddleware>();

    app.MapControllers();

    Log.Information("Nova Web Sunucusu Başlatılıyor...");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Nova Web Sunucusu beklenmeyen bir hata nedeniyle durduruldu.");
}
finally
{
    Log.CloseAndFlush();
}
