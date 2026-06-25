import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Button, 
  Paper, 
  Stack, 
  TextField, 
  Typography, 
  Grid,
  Box,
  Collapse
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { apiClient } from "../api/apiClient";
import { CustomerDto } from "../api/types";
import { DataTable } from "../components/DataTable";

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", phone: "" });

  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await apiClient.get<CustomerDto[]>("/customers")).data
  });

  const create = useMutation({
    mutationFn: async () => apiClient.post("/customers", form),
    onSuccess: () => {
      setForm({ code: "", name: "", phone: "" });
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Müşteriler
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Müşteri kayıtlarını görüntüleyin ve yönetin
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={isFormOpen ? <CloseIcon /> : <AddIcon />}
          onClick={() => setIsFormOpen(!isFormOpen)}
        >
          {isFormOpen ? "Vazgeç" : "Müşteri Ekle"}
        </Button>
      </Box>

      {/* Expandable Form */}
      <Collapse in={isFormOpen}>
        <Paper component="form" onSubmit={submit} sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Yeni Müşteri Bilgileri
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField 
                label="Müşteri Kodu" 
                value={form.code} 
                onChange={(e) => setForm({ ...form, code: e.target.value })} 
                required 
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                label="Müşteri Adı" 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                required 
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                label="Telefon Numarası" 
                value={form.phone} 
                onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                fullWidth
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button variant="outlined" onClick={() => setIsFormOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" variant="contained" disabled={create.isPending}>
              {create.isPending ? "Kaydediliyor..." : "Müşteriyi Kaydet"}
            </Button>
          </Box>
        </Paper>
      </Collapse>

      {/* Customer Data Table */}
      <DataTable 
        columns={["Kod", "Ad Soyad", "Telefon"]} 
        rows={(customers.data ?? []).map((c) => [
          <Typography variant="body2" fontWeight={700} color="primary.main">{c.code}</Typography>,
          c.name,
          c.phone || <span style={{ opacity: 0.6 }}>Telefon kaydı yok</span>
        ])} 
      />
    </Stack>
  );
}
