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

# Docker CLI kur — container içinden host Docker daemon'ına erişmek için gerekli
# (güncelleme mekanizması: docker compose pull + up)
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
       > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

ENV ASPNETCORE_URLS=http://+:80
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ERP.Api.dll"]
