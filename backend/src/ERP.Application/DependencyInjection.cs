using ERP.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace ERP.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ISaleService, SaleService>();
        services.AddScoped<IStockService, StockService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IReferenceDataService, ReferenceDataService>();
        services.AddScoped<IPosService, PosService>();
        return services;
    }
}
