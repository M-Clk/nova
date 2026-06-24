import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { apiClient } from "../api/apiClient";
import { ProductDto, ReferenceDataDto, SaleDto } from "../api/types";
import { DataTable } from "../components/DataTable";

export function SalesPage() {
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await apiClient.get<ProductDto[]>("/products")).data
  });
  const references = useQuery({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data
  });
  const sales = useQuery({
    queryKey: ["sales"],
    queryFn: async () => (await apiClient.get<SaleDto[]>("/sales")).data
  });

  const create = useMutation({
    mutationFn: async () =>
      apiClient.post("/sales", {
        warehouseId: references.data?.warehouses[0]?.id,
        items: [{ productId, quantity, discountAmount: 0 }]
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["stock-current"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>Sales</Typography>
      <Paper component="form" onSubmit={submit} sx={{ p: 2, borderRadius: 1 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField select label="Product" value={productId} onChange={(e) => setProductId(e.target.value)} required sx={{ minWidth: 260 }}>
            {(products.data ?? []).map((product) => (
              <MenuItem key={product.id} value={product.id}>{product.code} - {product.name}</MenuItem>
            ))}
          </TextField>
          <TextField label="Quantity" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          <Button type="submit" variant="contained" disabled={!productId || !references.data}>Create Sale</Button>
        </Stack>
      </Paper>
      <DataTable
        columns={["Sale No", "Customer", "Total", "Discount", "Net", "Created"]}
        rows={(sales.data ?? []).map((s) => [s.saleNo, s.customerName ?? "-", s.totalAmount.toFixed(2), s.discountAmount.toFixed(2), s.netAmount.toFixed(2), new Date(s.createdAt).toLocaleString()])}
      />
    </Stack>
  );
}
