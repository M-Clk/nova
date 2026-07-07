import { FormEvent, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Grid,
  Box,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
  Snackbar,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import ClearIcon from "@mui/icons-material/Clear";
import { apiClient } from "../api/apiClient";
import { CustomerDto } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import {
  Paper as MuiPaper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
} from "@mui/material";

// ─── Inline EditableTable (müşteriye özel) ──────────────────────────────────

interface CustomerTableProps {
  customers: CustomerDto[];
  onEdit: (customer: CustomerDto) => void;
  onDelete: (customer: CustomerDto) => void;
  canManage?: boolean;
  isLoading?: boolean;
}

function CustomerTable({ customers, onEdit, onDelete, canManage = true, isLoading = false }: CustomerTableProps) {
  const theme = useTheme();

  return (
    <TableContainer
      component={MuiPaper}
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        boxShadow:
          theme.palette.mode === "dark"
            ? "0 4px 20px rgba(0,0,0,0.25)"
            : "0 4px 20px rgba(100,116,139,0.05)",
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Table size="medium">
        <TableHead>
          <TableRow
            sx={{
              bgcolor:
                theme.palette.mode === "dark" ? "background.paper" : "#F8FAFC",
            }}
          >
            {(canManage ? ["Kod", "Ad Soyad", "Telefon", "İşlemler"] : ["Kod", "Ad Soyad", "Telefon"]).map((col) => (
              <TableCell
                key={col}
                sx={{
                  fontWeight: 600,
                  py: 1.8,
                  px: 2,
                  color: "text.primary",
                  fontSize: "0.875rem",
                  letterSpacing: "0.02em",
                  ...(col === "İşlemler" ? { width: 130, textAlign: "center" } : {}),
                }}
              >
                {col}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skel-${i}`}>
                <TableCell sx={{ py: 1.5, px: 2 }}><Skeleton variant="text" width="70%" height={20} animation="wave" /></TableCell>
                <TableCell sx={{ py: 1.5, px: 2 }}><Skeleton variant="text" width="80%" height={20} animation="wave" /></TableCell>
                <TableCell sx={{ py: 1.5, px: 2 }}><Skeleton variant="rounded" width={90} height={24} animation="wave" sx={{ borderRadius: 4 }} /></TableCell>
                {canManage && <TableCell sx={{ py: 1, px: 2 }}><Skeleton variant="rounded" width={64} height={32} animation="wave" sx={{ borderRadius: 1.5, ml: "auto", mr: "auto" }} /></TableCell>}
              </TableRow>
            ))
          ) : customers.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={canManage ? 4 : 3}
                align="center"
                sx={{ py: 6, color: "text.secondary" }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  <PersonIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                  <Typography variant="body2">Eşleşen müşteri bulunamadı</Typography>
                </Box>
              </TableCell>
            </TableRow>
          ) : (
            customers.map((c) => (
              <TableRow
                key={c.id}
                sx={{
                  "&:last-child td, &:last-child th": { border: 0 },
                  transition: "background 0.15s ease",
                  "&:hover": {
                    bgcolor:
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(0,0,0,0.02)",
                  },
                }}
              >
                <TableCell sx={{ py: 1.5, px: 2 }}>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color="primary.main"
                  >
                    {c.code}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2, fontSize: "0.875rem" }}>
                  {c.name}
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2 }}>
                  {c.phone ? (
                    <Chip
                      label={c.phone}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: "0.78rem" }}
                    />
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{ opacity: 0.45, fontStyle: "italic" }}
                    >
                      Kayıt yok
                    </Typography>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell sx={{ py: 1, px: 2, textAlign: "center" }}>
                    <Tooltip title="Düzenle">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => onEdit(c)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Sil">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onDelete(c)}
                        sx={{ ml: 0.5 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Ana Sayfa ───────────────────────────────────────────────────────────────

export function CustomersPage() {
  const { user } = useAuth();
  const canManage = true; // Tüm giriş yapmış kullanıcılar müşteri yönetebilir
  const queryClient = useQueryClient();

  // Yeni müşteri formu
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", phone: "" });

  // Filtreleme
  const [search, setSearch] = useState("");

  // Düzenleme dialog
  const [editTarget, setEditTarget] = useState<CustomerDto | null>(null);
  const [editForm, setEditForm] = useState({ code: "", name: "", phone: "" });

  // Silme onay dialog
  const [deleteTarget, setDeleteTarget] = useState<CustomerDto | null>(null);

  // Bildirimler
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" }>({
    open: false, message: "", severity: "success"
  });

  // ── Queries & Mutations ──────────────────────────────────────────────────

  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: async () =>
      (await apiClient.get<CustomerDto[]>("/customers")).data,
  });

  const create = useMutation({
    mutationFn: async () => apiClient.post("/customers", form),
    onSuccess: () => {
      setForm({ code: "", name: "", phone: "" });
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSnack({ open: true, message: "Müşteri başarıyla eklendi.", severity: "success" });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || "Müşteri eklenirken bir hata oluştu.";
      setSnack({ open: true, message: msg, severity: "error" });
    }
  });

  const update = useMutation({
    mutationFn: async () =>
      apiClient.put(`/customers/${editTarget!.id}`, editForm),
    onSuccess: () => {
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSnack({ open: true, message: "Müşteri bilgileri güncellendi.", severity: "success" });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || "Müşteri güncellenirken bir hata oluştu.";
      setSnack({ open: true, message: msg, severity: "error" });
    }
  });

  const remove = useMutation({
    mutationFn: async () =>
      apiClient.delete(`/customers/${deleteTarget!.id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSnack({ open: true, message: "Müşteri başarıyla silindi.", severity: "success" });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || "Müşteri silinirken bir hata oluştu.";
      setSnack({ open: true, message: msg, severity: "error" });
    }
  });

  // ── Filtreleme ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const all = customersQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term) ||
        (c.phone ?? "").toLowerCase().includes(term)
    );
  }, [customersQuery.data, search]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  function openEdit(customer: CustomerDto) {
    setEditTarget(customer);
    setEditForm({ code: customer.code, name: customer.name, phone: customer.phone ?? "" });
  }

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate();
  }

  function openDelete(customer: CustomerDto) {
    setDeleteTarget(customer);
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
        {canManage && (
          <Button
            variant="contained"
            color="primary"
            startIcon={isFormOpen ? <CloseIcon /> : <AddIcon />}
            onClick={() => setIsFormOpen(!isFormOpen)}
          >
            {isFormOpen ? "Vazgeç" : "Müşteri Ekle"}
          </Button>
        )}
      </Box>

      {/* Expandable Create Form */}
      <Collapse in={isFormOpen}>
        <Paper component="form" onSubmit={handleCreateSubmit} sx={{ p: 3, borderRadius: 2 }}>
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

      {/* Search / Filter Bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <TextField
          placeholder="Kod, ad veya telefon ile ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ maxWidth: 380, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: "text.disabled" }} />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch("")}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        {search && (
          <Typography variant="body2" color="text.secondary">
            {filtered.length} / {customersQuery.data?.length ?? 0} sonuç
          </Typography>
        )}
      </Box>

      {/* Customer Table */}
      <CustomerTable
        customers={filtered}
        onEdit={openEdit}
        onDelete={openDelete}
        canManage={canManage}
        isLoading={customersQuery.isLoading}
      />

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Müşteriyi Düzenle</DialogTitle>
        <Box component="form" onSubmit={handleEditSubmit}>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <TextField
                label="Müşteri Kodu"
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Müşteri Adı"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Telefon Numarası"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button variant="outlined" onClick={() => setEditTarget(null)}>
              Vazgeç
            </Button>
            <Button type="submit" variant="contained" disabled={update.isPending}>
              {update.isPending ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Müşteriyi Sil</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{deleteTarget?.name}</strong> adlı müşteriyi silmek istediğinizden emin misiniz?
            Bu işlem geri alınamaz.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>
            Vazgeç
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? "Siliniyor..." : "Evet, Sil"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          sx={{ borderRadius: 2, fontWeight: 600 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
