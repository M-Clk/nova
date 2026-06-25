import { useQuery } from "@tanstack/react-query";
import { Stack, Typography, Grid, Paper, Box, Chip } from "@mui/material";
import { apiClient } from "../api/apiClient";
import { CurrentStockDto, StockMovementDto } from "../api/types";
import { DataTable } from "../components/DataTable";

const fmt = (amount: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);

export function StockMovementsPage() {
  const current = useQuery({
    queryKey: ["stock-current"],
    queryFn: async () => (await apiClient.get<CurrentStockDto[]>("/stock/current")).data
  });
  const movements = useQuery({
    queryKey: ["stock-movements"],
    queryFn: async () => (await apiClient.get<StockMovementDto[]>("/stock/movements")).data
  });

  const getMovementTypeBadge = (type: number) => {
    switch (type) {
      case 1:
        return <Chip label="Satın Alma" color="success" size="small" sx={{ fontWeight: 600, minWidth: 105 }} />;
      case 2:
        return <Chip label="Satış" color="error" size="small" sx={{ fontWeight: 600, minWidth: 105 }} />;
      case 3:
        return <Chip label="İade Giriş" color="success" size="small" variant="outlined" sx={{ fontWeight: 600, minWidth: 105 }} />;
      case 4:
        return <Chip label="İade Çıkış" color="error" size="small" variant="outlined" sx={{ fontWeight: 600, minWidth: 105 }} />;
      case 5:
        return <Chip label="Stok Sayım" color="info" size="small" variant="outlined" sx={{ fontWeight: 600, minWidth: 105 }} />;
      case 6:
        return <Chip label="Transfer Giriş" color="success" size="small" variant="outlined" sx={{ fontWeight: 600, minWidth: 105, borderStyle: "dashed" }} />;
      case 7:
        return <Chip label="Transfer Çıkış" color="error" size="small" variant="outlined" sx={{ fontWeight: 600, minWidth: 105, borderStyle: "dashed" }} />;
      default:
        return <Chip label={`Tip ${type}`} size="small" sx={{ minWidth: 105 }} />;
    }
  };

  const formatQuantity = (type: number, quantity: number) => {
    const isInward = [1, 3, 6].includes(type);
    const isOutward = [2, 4, 7].includes(type);
    if (isInward) {
      return <Typography color="success.main" variant="body2" fontWeight={750}>+{quantity.toFixed(2)}</Typography>;
    } else if (isOutward) {
      return <Typography color="error.main" variant="body2" fontWeight={750}>-{quantity.toFixed(2)}</Typography>;
    }
    return <Typography variant="body2" fontWeight={600}>{quantity.toFixed(2)}</Typography>;
  };

  return (
    <Stack spacing={4}>
      {/* Current Stock */}
      <Box>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>
          Güncel Stok Seviyeleri
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 2.5 }}>
          Depolarınızdaki anlık stok miktarları
        </Typography>
        <DataTable
          columns={["Ürün Kodu", "Ürün Adı", "Depo Adı", "Mevcut Miktar"]}
          rows={(current.data ?? []).map((s) => [
            <Typography variant="body2" fontWeight={700} color="primary.main">{s.productCode}</Typography>,
            s.productName,
            s.warehouseName,
            <Typography variant="body2" fontWeight={700}>{s.quantity.toFixed(2)}</Typography>
          ])}
        />
      </Box>

      {/* Stock Movements Ledger */}
      <Box>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>
          Stok Hareket Defteri
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 2.5 }}>
          Tüm stok işlemlerinin geçmiş kaydı
        </Typography>
        <DataTable
          columns={["Ürün Kodu", "Ürün Adı", "Depo", "Hareket Tipi", "Miktar", "Birim Fiyat", "Referans", "Tarih"]}
          rows={(movements.data ?? []).map((m) => [
            <Typography variant="body2" fontWeight={700} color="primary.main">{m.productCode}</Typography>,
            m.productName,
            m.warehouseName,
            getMovementTypeBadge(m.type),
            formatQuantity(m.type, m.quantity),
            fmt(m.unitPrice),
            m.referenceType || <span style={{ opacity: 0.6 }}>Sistem</span>,
            new Date(m.createdAt).toLocaleString("tr-TR")
          ])}
        />
      </Box>
    </Stack>
  );
}
