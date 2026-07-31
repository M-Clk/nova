import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";
import type {
  DiscountDto,
  CreateDiscountRequest,
  UpdateDiscountRequest,
  LookupDto,
  ProductDto,
  ReferenceDataDto,
} from "../api/types";

// ─── API Helpers ────────────────────────────────────────────────────────────

const fetchDiscounts = async (): Promise<DiscountDto[]> => {
  const { data } = await apiClient.get<DiscountDto[]>("/discounts");
  return data;
};

const fetchReferenceData = async (): Promise<ReferenceDataDto> => {
  const { data } = await apiClient.get<ReferenceDataDto>("/referencedata");
  return data;
};

const fetchProducts = async (): Promise<ProductDto[]> => {
  const { data } = await apiClient.get<ProductDto[]>("/products");
  return data;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const SCOPE_LABELS: Record<number, string> = { 0: "Tümü", 1: "Kategori", 2: "Marka", 3: "Ürün" };
const TYPE_LABELS: Record<number, string> = { 0: "Yüzde (%)", 1: "Tutar (₺)" };
const DAY_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

const fmt = (amount: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);

// ─── Types ──────────────────────────────────────────────────────────────────

interface DiscountForm {
  name: string;
  scope: number;
  targetId: string | null;
  type: number;
  value: string;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  priority: string;
  isActive: boolean;
}

const emptyForm: DiscountForm = {
  name: "",
  scope: 0,
  targetId: null,
  type: 0,
  value: "",
  startDate: "",
  endDate: "",
  daysOfWeek: [],
  startTime: "",
  endTime: "",
  priority: "0",
  isActive: true,
};

function dtoToForm(dto: DiscountDto): DiscountForm {
  return {
    name: dto.name,
    scope: dto.scope,
    targetId: dto.targetId,
    type: dto.type,
    value: String(dto.value),
    startDate: dto.startDate ? dto.startDate.slice(0, 16) : "",
    endDate: dto.endDate ? dto.endDate.slice(0, 16) : "",
    daysOfWeek: dto.daysOfWeek
      ? dto.daysOfWeek.split(",").map(Number).filter((n) => !isNaN(n))
      : [],
    startTime: dto.startTime ?? "",
    endTime: dto.endTime ?? "",
    priority: String(dto.priority),
    isActive: dto.isActive,
  };
}

function formToCreateRequest(form: DiscountForm): CreateDiscountRequest {
  return {
    name: form.name.trim(),
    scope: form.scope,
    targetId: form.scope === 0 ? null : form.targetId,
    type: form.type,
    value: parseFloat(form.value) || 0,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    daysOfWeek: form.daysOfWeek.length > 0 ? form.daysOfWeek.sort().join(",") : null,
    startTime: form.startTime || null,
    endTime: form.endTime || null,
    priority: parseInt(form.priority) || 0,
  };
}

function formToUpdateRequest(form: DiscountForm): UpdateDiscountRequest {
  return {
    ...formToCreateRequest(form),
    isActive: form.isActive,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DiscountsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DiscountForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });
  const [filterScope, setFilterScope] = useState<number | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ["discounts"],
    queryFn: fetchDiscounts,
  });

  const { data: refData } = useQuery({
    queryKey: ["referenceData"],
    queryFn: fetchReferenceData,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-for-discounts"],
    queryFn: fetchProducts,
  });

  const createMutation = useMutation({
    mutationFn: (req: CreateDiscountRequest) => apiClient.post("/discounts", req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      setDialogOpen(false);
      showSnack("İndirim oluşturuldu.", "success");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Hata oluştu.";
      showSnack(msg, "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateDiscountRequest }) =>
      apiClient.put(`/discounts/${id}`, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      setDialogOpen(false);
      showSnack("İndirim güncellendi.", "success");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Hata oluştu.";
      showSnack(msg, "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/discounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      setDeleteConfirm(null);
      showSnack("İndirim silindi.", "success");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Hata oluştu.";
      showSnack(msg, "error");
    },
  });

  const showSnack = (message: string, severity: "success" | "error") => {
    setSnack({ open: true, message, severity });
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (d: DiscountDto) => {
    setEditingId(d.id);
    setForm(dtoToForm(d));
    setDialogOpen(true);
  };

  const handleToggleActive = (d: DiscountDto) => {
    updateMutation.mutate({
      id: d.id,
      req: {
        name: d.name,
        scope: d.scope,
        targetId: d.targetId,
        type: d.type,
        value: d.value,
        startDate: d.startDate,
        endDate: d.endDate,
        daysOfWeek: d.daysOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        isActive: !d.isActive,
        priority: d.priority,
      },
    });
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      showSnack("İndirim adı boş olamaz.", "error");
      return;
    }
    if (!form.value || parseFloat(form.value) <= 0) {
      showSnack("İndirim değeri sıfırdan büyük olmalıdır.", "error");
      return;
    }
    if (form.scope !== 0 && !form.targetId) {
      showSnack("Lütfen hedef seçiniz.", "error");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, req: formToUpdateRequest(form) });
    } else {
      createMutation.mutate(formToCreateRequest(form));
    }
  };

  // ── Target options based on scope ──
  const targetOptions = useMemo((): { id: string; label: string }[] => {
    if (form.scope === 1) {
      return (refData?.categories ?? []).map((c: LookupDto) => ({ id: c.id, label: c.name }));
    }
    if (form.scope === 2) {
      return (refData?.brands ?? []).map((b: LookupDto) => ({ id: b.id, label: b.name }));
    }
    if (form.scope === 3) {
      return products.map((p) => ({ id: p.id, label: `${p.code} — ${p.name}` }));
    }
    return [];
  }, [form.scope, refData, products]);

  // ── Filtered discounts ──
  const filteredDiscounts = useMemo(() => {
    return discounts.filter((d) => {
      if (filterScope !== "all" && d.scope !== filterScope) return false;
      if (filterStatus === "active" && !d.isActive) return false;
      if (filterStatus === "inactive" && d.isActive) return false;
      return true;
    });
  }, [discounts, filterScope, filterStatus]);

  const getStatusChip = (d: DiscountDto) => {
    if (!d.isActive) {
      return <Chip label="Pasif" size="small" sx={{ height: 22, fontSize: "0.7rem" }} />;
    }
    if (d.endDate && new Date(d.endDate) < new Date()) {
      return <Chip label="Süresi Dolmuş" size="small" color="error" variant="outlined" sx={{ height: 22, fontSize: "0.7rem" }} />;
    }
    if (d.startDate && new Date(d.startDate) > new Date()) {
      return <Chip label="Başlamamış" size="small" color="info" variant="outlined" sx={{ height: 22, fontSize: "0.7rem" }} />;
    }
    if (d.isCurrentlyApplicable) {
      return <Chip label="Aktif" size="small" color="success" sx={{ height: 22, fontSize: "0.7rem" }} />;
    }
    return <Chip label="Zamanlama Dışı" size="small" color="warning" variant="outlined" sx={{ height: 22, fontSize: "0.7rem" }} />;
  };

  const formatSchedule = (d: DiscountDto) => {
    const parts: string[] = [];
    if (d.daysOfWeek) {
      const days = d.daysOfWeek.split(",").map(Number);
      parts.push(days.map((n) => DAY_LABELS[n] ?? "?").join(", "));
    }
    if (d.startTime || d.endTime) {
      parts.push(`${d.startTime ?? "00:00"} - ${d.endTime ?? "23:59"}`);
    }
    return parts.join(" · ") || "7/24";
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <LocalOfferIcon color="primary" sx={{ fontSize: 28 }} />
          <Typography variant="h5" fontWeight={800} letterSpacing="-0.02em">
            İndirimler
          </Typography>
          <Chip label={`${discounts.length} kayıt`} size="small" variant="outlined" />
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
          id="discount-create-btn"
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none" }}
        >
          Yeni İndirim
        </Button>
      </Box>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 3, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Kapsam</InputLabel>
          <Select
            value={filterScope}
            label="Kapsam"
            onChange={(e) => setFilterScope(e.target.value as number | "all")}
          >
            <MenuItem value="all">Tümü</MenuItem>
            <MenuItem value={0}>Tüm Ürünler</MenuItem>
            <MenuItem value={1}>Kategori</MenuItem>
            <MenuItem value={2}>Marka</MenuItem>
            <MenuItem value={3}>Ürün</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Durum</InputLabel>
          <Select
            value={filterStatus}
            label="Durum"
            onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
          >
            <MenuItem value="all">Tümü</MenuItem>
            <MenuItem value="active">Aktif</MenuItem>
            <MenuItem value="inactive">Pasif</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: "hidden" }}>
        {isLoading ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <CircularProgress />
          </Box>
        ) : filteredDiscounts.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <LocalOfferIcon sx={{ fontSize: 64, opacity: 0.15, mb: 2 }} />
            <Typography color="text.secondary">Henüz indirim tanımlanmamış.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>İndirim Adı</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Kapsam</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Hedef</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Tip / Değer</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Zamanlama</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tarih Aralığı</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Durum</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 130 }}>İşlemler</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDiscounts.map((d) => (
                  <TableRow
                    key={d.id}
                    hover
                    sx={{
                      opacity: d.isActive ? 1 : 0.55,
                      transition: "opacity 0.2s",
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{d.name}</Typography>
                      <Typography variant="caption" color="text.secondary">Öncelik: {d.priority}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={d.scopeName} size="small" variant="outlined" sx={{ height: 22, fontSize: "0.7rem" }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{d.targetName ?? "—"}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight={700} color="primary.main">
                        {d.type === 0 ? `%${d.value}` : fmt(d.value)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{formatSchedule(d)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {d.startDate ? new Date(d.startDate).toLocaleDateString("tr-TR") : "—"}
                        {" → "}
                        {d.endDate ? new Date(d.endDate).toLocaleDateString("tr-TR") : "Süresiz"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{getStatusChip(d)}</TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                        <Tooltip title={d.isActive ? "Pasifleştir" : "Aktifleştir"}>
                          <IconButton
                            size="small"
                            color={d.isActive ? "warning" : "success"}
                            onClick={() => handleToggleActive(d)}
                            disabled={updateMutation.isPending}
                          >
                            {d.isActive ? <PauseIcon sx={{ fontSize: 16 }} /> : <PlayArrowIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Düzenle">
                          <IconButton size="small" onClick={() => handleOpenEdit(d)}>
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Sil">
                          <IconButton size="small" color="error" onClick={() => setDeleteConfirm(d.id)}>
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ─── Create/Edit Dialog ─── */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingId ? "İndirim Düzenle" : "Yeni İndirim Oluştur"}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: "16px !important" }}>
          {/* İndirim Adı */}
          <TextField
            label="İndirim Adı"
            fullWidth
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Yaz Kampanyası, Samsung %10..."
            size="small"
          />

          {/* Kapsam */}
          <FormControl fullWidth size="small">
            <InputLabel>Kapsam</InputLabel>
            <Select
              value={form.scope}
              label="Kapsam"
              onChange={(e) => setForm({ ...form, scope: Number(e.target.value), targetId: null })}
            >
              {Object.entries(SCOPE_LABELS).map(([val, label]) => (
                <MenuItem key={val} value={Number(val)}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Hedef seçici (scope != All) */}
          {form.scope !== 0 && (
            <Autocomplete
              options={targetOptions}
              getOptionLabel={(o) => o.label}
              value={targetOptions.find((o) => o.id === form.targetId) ?? null}
              onChange={(_, v) => setForm({ ...form, targetId: v?.id ?? null })}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={`${SCOPE_LABELS[form.scope]} Seçin`}
                  size="small"
                />
              )}
              size="small"
              isOptionEqualToValue={(o, v) => o.id === v.id}
            />
          )}

          {/* Tip & Değer */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <FormControl sx={{ width: 160 }} size="small">
              <InputLabel>Tip</InputLabel>
              <Select
                value={form.type}
                label="Tip"
                onChange={(e) => setForm({ ...form, type: Number(e.target.value) })}
              >
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <MenuItem key={val} value={Number(val)}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={form.type === 0 ? "Yüzde (%)" : "Tutar (₺)"}
              value={form.value}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || /^\d*\.?\d*$/.test(val)) setForm({ ...form, value: val });
              }}
              size="small"
              sx={{ flex: 1 }}
              inputProps={{ style: { textAlign: "right", fontWeight: 700 } }}
            />
          </Box>

          {/* Tarih Aralığı */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Başlangıç Tarihi"
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={{ flex: 1 }}
              helperText="Boş = hemen başlar"
            />
            <TextField
              label="Bitiş Tarihi"
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={{ flex: 1 }}
              helperText="Boş = süresiz"
            />
          </Box>

          {/* Günler */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
              Geçerli Günler (boş = her gün)
            </Typography>
            <ToggleButtonGroup
              value={form.daysOfWeek}
              onChange={(_, newDays: number[]) => setForm({ ...form, daysOfWeek: newDays })}
              size="small"
              sx={{ flexWrap: "wrap" }}
            >
              {DAY_LABELS.map((label, idx) => (
                <ToggleButton
                  key={idx}
                  value={idx}
                  sx={{
                    px: 1.5,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    borderRadius: "8px !important",
                    mx: 0.3,
                    border: "1px solid",
                    borderColor: "divider",
                    "&.Mui-selected": {
                      backgroundColor: "primary.main",
                      color: "white",
                      "&:hover": { backgroundColor: "primary.dark" },
                    },
                  }}
                >
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Saat Aralığı */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Başlangıç Saati"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={{ flex: 1 }}
              helperText="Boş = gün başından"
            />
            <TextField
              label="Bitiş Saati"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={{ flex: 1 }}
              helperText="Boş = gün sonuna"
            />
          </Box>

          {/* Öncelik */}
          <TextField
            label="Öncelik"
            value={form.priority}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || /^\d*$/.test(val)) setForm({ ...form, priority: val });
            }}
            size="small"
            helperText="Yüksek = daha öncelikli"
            inputProps={{ style: { textAlign: "right" } }}
          />

          {/* Aktif/Pasif */}
          {editingId && (
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  color="primary"
                />
              }
              label={form.isActive ? "Aktif" : "Pasif"}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" sx={{ borderRadius: 2 }}>
            İptal
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            {editingId ? "Güncelle" : "Oluştur"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Delete Confirm Dialog ─── */}
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>İndirimi Sil</DialogTitle>
        <DialogContent>
          <Typography>Bu indirimi silmek istediğinize emin misiniz?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirm(null)} variant="outlined" sx={{ borderRadius: 2 }}>
            İptal
          </Button>
          <Button
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            Sil
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          variant="filled"
          sx={{ borderRadius: 2, fontWeight: 600 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
