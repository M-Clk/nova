# ERP System MVP

Basit, genisletilebilir ERP sistemi.

## Calistirma

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:5000
- PostgreSQL: localhost:5432

API ilk acilista PostgreSQL semasini olusturur ve `Genel` marka/kategori, `Adet` birim, `Ana Depo` kayitlarini seed eder.

## Mimari

```text
React SPA -> ASP.NET 8 Web API -> PostgreSQL
```

Backend projeleri:

- `ERP.Domain`: Entity ve enum modelleri
- `ERP.Application`: DTO, servis ve DbContext abstraction katmani
- `ERP.Infrastructure`: EF Core, PostgreSQL persistence
- `ERP.Api`: Controller ve host konfigurasyonu

## Temel Ilke

Stok miktari `Product` uzerinde tutulmaz. `StockMovements` tek kaynak kabul edilir; mevcut stok `/api/stock/current` uzerinden hareketlerden hesaplanir.

## Ana Endpointler

- `GET/POST/PUT/DELETE /api/products`
- `GET/POST /api/sales`
- `GET /api/stock/current`
- `GET /api/stock/movements`
- `GET/POST/PUT/DELETE /api/customers`
- `GET /api/reference-data`
