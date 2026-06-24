FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ERP.sln ./
COPY NuGet.Config ./
COPY backend/src/ERP.Api/ERP.Api.csproj backend/src/ERP.Api/
COPY backend/src/ERP.Application/ERP.Application.csproj backend/src/ERP.Application/
COPY backend/src/ERP.Domain/ERP.Domain.csproj backend/src/ERP.Domain/
COPY backend/src/ERP.Infrastructure/ERP.Infrastructure.csproj backend/src/ERP.Infrastructure/
RUN dotnet restore ERP.sln

COPY . .
RUN dotnet publish backend/src/ERP.Api/ERP.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:80
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ERP.Api.dll"]
