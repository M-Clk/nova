using ERP.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace ERP.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ISaleService, SaleService>();
        services.AddScoped<IStockService, StockService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IReferenceDataService, ReferenceDataService>();
        services.AddScoped<IPosService, PosService>();
        services.AddScoped<ITerminalService, TerminalService>();
        services.AddScoped<IWarehouseService, WarehouseService>();

        // ─── Report Exporters (Strategy Pattern) ─────────────────────────
        // Yeni format eklemek için: services.AddScoped<IReportExporter, PdfReportExporter>();
        services.AddScoped<IReportExporter, CsvReportExporter>();
        services.AddScoped<IReportExporterFactory, ReportExporterFactory>();

        // ─── Report Services ─────────────────────────────────────────────
        services.AddScoped<IStockReportService, StockReportService>();

        return services;
    }
}
