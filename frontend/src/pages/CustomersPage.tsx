import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { apiClient } from "../api/apiClient";
import { CustomerDto } from "../api/types";
import { DataTable } from "../components/DataTable";

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ code: "", name: "", phone: "" });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await apiClient.get<CustomerDto[]>("/customers")).data
  });
  const create = useMutation({
    mutationFn: async () => apiClient.post("/customers", form),
    onSuccess: () => {
      setForm({ code: "", name: "", phone: "" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>Customers</Typography>
      <Paper component="form" onSubmit={submit} sx={{ p: 2, borderRadius: 1 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Button type="submit" variant="contained">Save</Button>
        </Stack>
      </Paper>
      <DataTable columns={["Code", "Name", "Phone"]} rows={(customers.data ?? []).map((c) => [c.code, c.name, c.phone])} />
    </Stack>
  );
}
