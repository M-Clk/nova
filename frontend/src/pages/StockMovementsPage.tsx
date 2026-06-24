import { useQuery } from "@tanstack/react-query";
import { Stack, Typography } from "@mui/material";
import { apiClient } from "../api/apiClient";
import { CurrentStockDto, StockMovementDto } from "../api/types";
import { DataTable } from "../components/DataTable";

export function StockMovementsPage() {
  const current = useQuery({
    queryKey: ["stock-current"],
    queryFn: async () => (await apiClient.get<CurrentStockDto[]>("/stock/current")).data
  });
  const movements = useQuery({
    queryKey: ["stock-movements"],
    queryFn: async () => (await apiClient.get<StockMovementDto[]>("/stock/movements")).data
  });

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>Current Stock</Typography>
      <DataTable
        columns={["Product Code", "Product", "Warehouse", "Quantity"]}
        rows={(current.data ?? []).map((s) => [s.productCode, s.productName, s.warehouseName, s.quantity.toFixed(3)])}
      />
      <Typography variant="h5" fontWeight={700}>Stock Movements</Typography>
      <DataTable
        columns={["Product Code", "Product", "Warehouse", "Type", "Quantity", "Unit Price", "Reference", "Created"]}
        rows={(movements.data ?? []).map((m) => [m.productCode, m.productName, m.warehouseName, m.type, m.quantity.toFixed(3), m.unitPrice.toFixed(2), m.referenceType, new Date(m.createdAt).toLocaleString()])}
      />
    </Stack>
  );
}
