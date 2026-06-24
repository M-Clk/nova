import { useQuery } from "@tanstack/react-query";
import { Grid, Paper, Stack, Typography } from "@mui/material";
import { apiClient } from "../api/apiClient";
import { CurrentStockDto, ProductDto, SaleDto } from "../api/types";

export function DashboardPage() {
  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await apiClient.get<ProductDto[]>("/products")).data
  });
  const sales = useQuery({
    queryKey: ["sales"],
    queryFn: async () => (await apiClient.get<SaleDto[]>("/sales")).data
  });
  const stock = useQuery({
    queryKey: ["stock-current"],
    queryFn: async () => (await apiClient.get<CurrentStockDto[]>("/stock/current")).data
  });

  const netSales = sales.data?.reduce((sum, sale) => sum + sale.netAmount, 0) ?? 0;
  const totalStock = stock.data?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
      <Grid container spacing={2}>
        <Metric title="Products" value={products.data?.length ?? 0} />
        <Metric title="Sales" value={sales.data?.length ?? 0} />
        <Metric title="Net Sales" value={netSales.toFixed(2)} />
        <Metric title="Current Stock" value={totalStock.toFixed(3)} />
      </Grid>
    </Stack>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Paper sx={{ p: 2, borderRadius: 1 }}>
        <Typography color="text.secondary" variant="body2">{title}</Typography>
        <Typography variant="h4" fontWeight={700}>{value}</Typography>
      </Paper>
    </Grid>
  );
}
