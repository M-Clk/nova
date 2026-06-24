import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { DataTable } from "../components/DataTable";
import { apiClient } from "../api/apiClient";
import { ProductDto, ReferenceDataDto } from "../api/types";

export function ProductsPage() {
  const queryClient = useQueryClient();
  const references = useQuery({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data
  });
  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await apiClient.get<ProductDto[]>("/products")).data
  });
  const [form, setForm] = useState({ code: "", barcode: "", name: "", purchasePrice: 0, salePrice: 0, minStock: 0 });

  const create = useMutation({
    mutationFn: async () => {
      const data = references.data!;
      return apiClient.post("/products", {
        ...form,
        brandId: data.brands[0].id,
        categoryId: data.categories[0].id,
        unitId: data.units[0].id
      });
    },
    onSuccess: () => {
      setForm({ code: "", barcode: "", name: "", purchasePrice: 0, salePrice: 0, minStock: 0 });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>Products</Typography>
      <Paper component="form" onSubmit={submit} sx={{ p: 2, borderRadius: 1 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <TextField label="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <TextField label="Purchase" type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
          <TextField label="Sale" type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })} />
          <TextField select label="Unit" value={references.data?.units[0]?.id ?? ""} sx={{ minWidth: 120 }}>
            {references.data?.units.map((unit) => <MenuItem key={unit.id} value={unit.id}>{unit.name}</MenuItem>)}
          </TextField>
          <Button type="submit" variant="contained" disabled={!references.data}>Save</Button>
        </Stack>
      </Paper>
      <DataTable
        columns={["Code", "Name", "Brand", "Category", "Unit", "Sale Price", "Active"]}
        rows={(products.data ?? []).map((p) => [p.code, p.name, p.brandName, p.categoryName, p.unitName, p.salePrice.toFixed(2), p.isActive ? "Yes" : "No"])}
      />
    </Stack>
  );
}
