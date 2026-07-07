import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Switch,
  Divider,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tooltip,
  CircularProgress,
  Alert,
  FormControlLabel,
  FormGroup
} from "@mui/material";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";

import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import KeyIcon from "@mui/icons-material/Key";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";

import { useThemeMode } from "../theme/ThemeContext";
import { useAuth } from "../auth/AuthContext";
import { useLicense } from "../context/LicenseContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";
import {
  TerminalDto,
  CreateTerminalRequest,
  UpdateTerminalRequest,
  WarehouseDto,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  ReferenceDataDto,
  LookupDto,
  CreateLookupRequest,
  UpdateLookupRequest
} from "../api/types";

// ─── Role badge ────────────────────────────────────────────────────────────────

function RoleChip({ role }: { role: string }) {
  const map: Record<string, { label: string; color: "error" | "warning" | "info"; icon: React.ReactNode }> = {
    Admin:   { label: "Admin",    color: "error",   icon: <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 13 }} /> },
    Manager: { label: "Yönetici", color: "warning", icon: <ManageAccountsOutlinedIcon sx={{ fontSize: 13 }} /> },
    Staff:   { label: "Personel", color: "info",    icon: <BadgeOutlinedIcon sx={{ fontSize: 13 }} /> }
  };
  const cfg = map[role] ?? map["Staff"];
  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size="small"
      icon={<>{cfg.icon}</>}
      sx={{
        height: 22,
        fontSize: "0.72rem",
        fontWeight: 700,
        borderRadius: "11px",
        px: 0.5,
        "& .MuiChip-icon": { ml: 0.5, mr: -0.25 },
        "& .MuiChip-label": { px: 0.75 }
      }}
    />
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────────

function SettingsSection({
  title,
  icon,
  children
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 3,
        border: 1,
        borderColor: "divider"
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
        <Avatar
          sx={{
            bgcolor: "action.selected",
            color: "primary.main",
            width: 34,
            height: 34
          }}
        >
          {icon}
        </Avatar>
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
      </Box>
      <Divider sx={{ mb: 2.5 }} />
      {children}
    </Paper>
  );
}

// ─── Depolar Tab ───────────────────────────────────────────────────────────────

function WarehousesTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WarehouseDto | null>(null);
  const [formName, setFormName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WarehouseDto | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { data: warehouses = [], isLoading } = useQuery<WarehouseDto[]>({
    queryKey: ["warehouses-full"],
    queryFn: async () => (await apiClient.get<WarehouseDto[]>("/warehouses")).data
  });

  const openCreate = () => {
    setEditTarget(null);
    setFormName("");
    setErrorMsg("");
    setDialogOpen(true);
  };

  const openEdit = (w: WarehouseDto) => {
    setEditTarget(w);
    setFormName(w.name);
    setErrorMsg("");
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (req: CreateWarehouseRequest) =>
      apiClient.post<WarehouseDto>("/warehouses", req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses-full"] });
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setDialogOpen(false);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Bir hata oluştu.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateWarehouseRequest }) =>
      apiClient.put(`/warehouses/${id}`, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses-full"] });
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setDialogOpen(false);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Bir hata oluştu.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/warehouses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses-full"] });
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Silinemedi.")
  });

  const handleSave = () => {
    if (!formName.trim()) return;
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, req: { name: formName } });
    } else {
      createMutation.mutate({ name: formName });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={openCreate}
          size="small"
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
        >
          Yeni Depo
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.78rem", color: "text.secondary" } }}>
                <TableCell>Depo Adı</TableCell>
                <TableCell align="right">İşlemler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {warehouses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 4, color: "text.disabled" }}>
                    Henüz depo tanımlanmamış.
                  </TableCell>
                </TableRow>
              ) : (
                warehouses.map((w) => (
                  <TableRow key={w.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{w.name}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Düzenle">
                        <IconButton size="small" onClick={() => openEdit(w)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sil">
                        <IconButton size="small" color="error" onClick={() => { setDeleteTarget(w); setErrorMsg(""); }}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{editTarget ? "Depo Düzenle" : "Yeni Depo"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {errorMsg && <Alert severity="error" sx={{ borderRadius: 2 }}>{errorMsg}</Alert>}
            <TextField
              label="Depo Adı"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
              autoFocus
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }}>İptal</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formName.trim() || isSaving}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {isSaving ? <CircularProgress size={18} /> : "Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Depo Sil</DialogTitle>
        <DialogContent>
          {errorMsg && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{errorMsg}</Alert>}
          <Typography>
            <strong>{deleteTarget?.name}</strong> deposunu silmek istediğinize emin misiniz?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Bu depoya bağlı stok hareketi veya kasa varsa silinemez.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: "none" }}>İptal</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {deleteMutation.isPending ? <CircularProgress size={18} /> : "Sil"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Kasalar Tab ───────────────────────────────────────────────────────────────

function TerminalsTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TerminalDto | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formWarehouseId, setFormWarehouseId] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<TerminalDto | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { data: terminals = [], isLoading } = useQuery<TerminalDto[]>({
    queryKey: ["terminals"],
    queryFn: async () => (await apiClient.get<TerminalDto[]>("/terminals")).data
  });

  const { data: warehouses = [] } = useQuery<WarehouseDto[]>({
    queryKey: ["warehouses-full"],
    queryFn: async () => (await apiClient.get<WarehouseDto[]>("/warehouses")).data
  });

  const openCreate = () => {
    setEditTarget(null);
    setFormCode("");
    setFormName("");
    setFormWarehouseId(warehouses[0]?.id ?? "");
    setFormIsActive(true);
    setErrorMsg("");
    setDialogOpen(true);
  };

  const openEdit = (t: TerminalDto) => {
    setEditTarget(t);
    setFormCode(t.code);
    setFormName(t.name);
    setFormWarehouseId(t.warehouseId);
    setFormIsActive(t.isActive);
    setErrorMsg("");
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (req: CreateTerminalRequest) =>
      apiClient.post<TerminalDto>("/terminals", req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terminals"] });
      setDialogOpen(false);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Bir hata oluştu.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateTerminalRequest }) =>
      apiClient.put(`/terminals/${id}`, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terminals"] });
      setDialogOpen(false);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Bir hata oluştu.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/terminals/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terminals"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Silinemedi.")
  });

  const handleSave = () => {
    if (!formCode.trim() || !formName.trim() || !formWarehouseId) return;
    const req = { code: formCode, name: formName, warehouseId: formWarehouseId };
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, req: { ...req, isActive: formIsActive } });
    } else {
      createMutation.mutate(req);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={openCreate}
          size="small"
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
        >
          Yeni Kasa
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.78rem", color: "text.secondary" } }}>
                <TableCell>Kod</TableCell>
                <TableCell>Kasa Adı</TableCell>
                <TableCell>Depo</TableCell>
                <TableCell align="center">Durum</TableCell>
                <TableCell align="right">İşlemler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {terminals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.disabled" }}>
                    Henüz kasa tanımlanmamış.
                  </TableCell>
                </TableRow>
              ) : (
                terminals.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{
                          fontFamily: "monospace",
                          bgcolor: "action.selected",
                          px: 1,
                          py: 0.3,
                          borderRadius: 1
                        }}
                      >
                        {t.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{t.warehouseName}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      {t.isActive ? (
                        <Chip
                          label="Aktif"
                          size="small"
                          color="success"
                          icon={<CheckCircleOutlinedIcon sx={{ fontSize: 13 }} />}
                          sx={{ height: 22, fontSize: "0.72rem", fontWeight: 700 }}
                        />
                      ) : (
                        <Chip
                          label="Pasif"
                          size="small"
                          color="default"
                          icon={<CancelOutlinedIcon sx={{ fontSize: 13 }} />}
                          sx={{ height: 22, fontSize: "0.72rem", fontWeight: 700 }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Düzenle">
                        <IconButton size="small" onClick={() => openEdit(t)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sil">
                        <IconButton size="small" color="error" onClick={() => { setDeleteTarget(t); setErrorMsg(""); }}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{editTarget ? "Kasa Düzenle" : "Yeni Kasa"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {errorMsg && <Alert severity="error" sx={{ borderRadius: 2 }}>{errorMsg}</Alert>}
            <TextField
              label="Kasa Kodu"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value.toUpperCase())}
              fullWidth
              autoFocus
              size="small"
              inputProps={{ maxLength: 10 }}
              helperText="Örn: K01, POS-1"
            />
            <TextField
              label="Kasa Adı"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Depo"
              value={formWarehouseId}
              onChange={(e) => setFormWarehouseId(e.target.value)}
              select
              fullWidth
              size="small"
            >
              {warehouses.map((w) => (
                <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
              ))}
            </TextField>
            {editTarget && (
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={formIsActive ? "Aktif" : "Pasif"}
                />
              </FormGroup>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }}>İptal</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formCode.trim() || !formName.trim() || !formWarehouseId || isSaving}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {isSaving ? <CircularProgress size={18} /> : "Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Kasa Sil</DialogTitle>
        <DialogContent>
          {errorMsg && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{errorMsg}</Alert>}
          <Typography>
            <strong>{deleteTarget?.name}</strong> kasasını silmek istediğinize emin misiniz?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Bu kasaya ait satış kaydı varsa silinemez.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: "none" }}>İptal</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {deleteMutation.isPending ? <CircularProgress size={18} /> : "Sil"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

// ─── Markalar Tab ───────────────────────────────────────────────────────────────

function BrandsTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LookupDto | null>(null);
  const [formName, setFormName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LookupDto | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { data: references, isLoading } = useQuery<ReferenceDataDto>({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data
  });

  const brands = references?.brands ?? [];

  const openCreate = () => {
    setEditTarget(null);
    setFormName("");
    setErrorMsg("");
    setDialogOpen(true);
  };

  const openEdit = (b: LookupDto) => {
    setEditTarget(b);
    setFormName(b.name);
    setErrorMsg("");
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (req: CreateLookupRequest) =>
      apiClient.post<LookupDto>("/reference-data/brands", req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setDialogOpen(false);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Bir hata oluştu.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateLookupRequest }) =>
      apiClient.put(`/reference-data/brands/${id}`, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setDialogOpen(false);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Bir hata oluştu.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/reference-data/brands/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Silinemedi.")
  });

  const handleSave = () => {
    if (!formName.trim()) return;
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, req: { name: formName } });
    } else {
      createMutation.mutate({ name: formName });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={openCreate}
          size="small"
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
        >
          Yeni Marka
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.78rem", color: "text.secondary" } }}>
                <TableCell>Marka Adı</TableCell>
                <TableCell align="right">İşlemler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {brands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 4, color: "text.disabled" }}>
                    Henüz marka tanımlanmamış.
                  </TableCell>
                </TableRow>
              ) : (
                brands.map((b) => (
                  <TableRow key={b.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{b.name}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Düzenle">
                        <IconButton size="small" onClick={() => openEdit(b)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sil">
                        <IconButton size="small" color="error" onClick={() => { setDeleteTarget(b); setErrorMsg(""); }}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{editTarget ? "Marka Düzenle" : "Yeni Marka"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {errorMsg && <Alert severity="error" sx={{ borderRadius: 2 }}>{errorMsg}</Alert>}
            <TextField
              label="Marka Adı"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
              autoFocus
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }}>İptal</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formName.trim() || isSaving}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {isSaving ? <CircularProgress size={18} /> : "Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Marka Sil</DialogTitle>
        <DialogContent>
          {errorMsg && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{errorMsg}</Alert>}
          <Typography>
            <strong>{deleteTarget?.name}</strong> markasını silmek istediğinize emin misiniz?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Bu markaya bağlı ürün varsa silinemez.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: "none" }}>İptal</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {deleteMutation.isPending ? <CircularProgress size={18} /> : "Sil"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Kategoriler Tab ─────────────────────────────────────────────────────────────

function CategoriesTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LookupDto | null>(null);
  const [formName, setFormName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LookupDto | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { data: references, isLoading } = useQuery<ReferenceDataDto>({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data
  });

  const categories = references?.categories ?? [];

  const openCreate = () => {
    setEditTarget(null);
    setFormName("");
    setErrorMsg("");
    setDialogOpen(true);
  };

  const openEdit = (c: LookupDto) => {
    setEditTarget(c);
    setFormName(c.name);
    setErrorMsg("");
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (req: CreateLookupRequest) =>
      apiClient.post<LookupDto>("/reference-data/categories", req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setDialogOpen(false);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Bir hata oluştu.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateLookupRequest }) =>
      apiClient.put(`/reference-data/categories/${id}`, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setDialogOpen(false);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Bir hata oluştu.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/reference-data/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Silinemedi.")
  });

  const handleSave = () => {
    if (!formName.trim()) return;
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, req: { name: formName } });
    } else {
      createMutation.mutate({ name: formName });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={openCreate}
          size="small"
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
        >
          Yeni Kategori
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.78rem", color: "text.secondary" } }}>
                <TableCell>Kategori Adı</TableCell>
                <TableCell align="right">İşlemler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 4, color: "text.disabled" }}>
                    Henüz kategori tanımlanmamış.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Düzenle">
                        <IconButton size="small" onClick={() => openEdit(c)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sil">
                        <IconButton size="small" color="error" onClick={() => { setDeleteTarget(c); setErrorMsg(""); }}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{editTarget ? "Kategori Düzenle" : "Yeni Kategori"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {errorMsg && <Alert severity="error" sx={{ borderRadius: 2 }}>{errorMsg}</Alert>}
            <TextField
              label="Kategori Adı"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
              autoFocus
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }}>İptal</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formName.trim() || isSaving}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {isSaving ? <CircularProgress size={18} /> : "Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Kategori Sil</DialogTitle>
        <DialogContent>
          {errorMsg && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{errorMsg}</Alert>}
          <Typography>
            <strong>{deleteTarget?.name}</strong> kategorisini silmek istediğinize emin misiniz?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Bu kategoriye bağlı ürün veya alt kategori varsa silinemez.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: "none" }}>İptal</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {deleteMutation.isPending ? <CircularProgress size={18} /> : "Sil"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Ölçü Birimleri Tab ─────────────────────────────────────────────────────────

function UnitsTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LookupDto | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LookupDto | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { data: references, isLoading } = useQuery<ReferenceDataDto>({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data
  });

  const units = references?.units ?? [];

  const openCreate = () => {
    setEditTarget(null);
    setFormName("");
    setFormCode("");
    setErrorMsg("");
    setDialogOpen(true);
  };

  const openEdit = (u: LookupDto) => {
    setEditTarget(u);
    setFormName(u.name);
    setFormCode(u.code);
    setErrorMsg("");
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (req: CreateLookupRequest) =>
      apiClient.post<LookupDto>("/reference-data/units", req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setDialogOpen(false);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Bir hata oluştu.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateLookupRequest }) =>
      apiClient.put(`/reference-data/units/${id}`, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setDialogOpen(false);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Bir hata oluştu.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/reference-data/units/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error ?? "Silinemedi.")
  });

  const handleSave = () => {
    if (!formName.trim() || !formCode.trim()) return;
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, req: { name: formName, code: formCode } });
    } else {
      createMutation.mutate({ name: formName, code: formCode });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={openCreate}
          size="small"
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
        >
          Yeni Ölçü Birimi
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.78rem", color: "text.secondary" } }}>
                <TableCell>Birim Kodu</TableCell>
                <TableCell>Birim Adı</TableCell>
                <TableCell align="right">İşlemler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {units.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 4, color: "text.disabled" }}>
                    Henüz ölçü birimi tanımlanmamış.
                  </TableCell>
                </TableRow>
              ) : (
                units.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} sx={{ fontFamily: "monospace" }}>{u.code}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{u.name}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Düzenle">
                        <IconButton size="small" onClick={() => openEdit(u)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sil">
                        <IconButton size="small" color="error" onClick={() => { setDeleteTarget(u); setErrorMsg(""); }}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{editTarget ? "Ölçü Birimini Düzenle" : "Yeni Ölçü Birimi"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {errorMsg && <Alert severity="error" sx={{ borderRadius: 2 }}>{errorMsg}</Alert>}
            <TextField
              label="Birim Kodu"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              fullWidth
              autoFocus
              size="small"
              placeholder="Örn: ADET, KG, L"
            />
            <TextField
              label="Birim Adı"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
              size="small"
              placeholder="Örn: Adet, Kilogram, Litre"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }}>İptal</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formName.trim() || !formCode.trim() || isSaving}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {isSaving ? <CircularProgress size={18} /> : "Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Ölçü Birimi Sil</DialogTitle>
        <DialogContent>
          {errorMsg && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{errorMsg}</Alert>}
          <Typography>
            <strong>{deleteTarget?.name}</strong> ölçü birimini silmek istediğinize emin misiniz?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Bu ölçü birimine atanmış aktif ürün varsa silinemez.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: "none" }}>İptal</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {deleteMutation.isPending ? <CircularProgress size={18} /> : "Sil"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Lisans Tab Content ──────────────────────────────────────────────────────────

function LicenseTabContent() {
  const { licenseInfo, isLicenseValid, activate } = useLicense();
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const success = await activate(licenseKeyInput.trim());
      if (success) {
        setSuccessMsg("Lisans başarıyla güncellendi.");
        setLicenseKeyInput("");
      } else {
        setErrorMsg("Lisans anahtarı doğrulanamadı.");
      }
    } catch (err) {
      setErrorMsg("Bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        {/* Durum Kartı */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>Lisans Durumu</Typography>
            <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
              {isLicenseValid ? "Sistem Aktif ve Lisanslı" : "Lisans Geçersiz / Süresi Dolmuş"}
            </Typography>
          </Box>
          <Chip 
            label={isLicenseValid ? "Aktif" : "Geçersiz"} 
            color={isLicenseValid ? "success" : "error"} 
            size="small" 
            sx={{ fontWeight: 700 }}
          />
        </Stack>

        <Divider />

        {/* Lisans Detayları */}
        {licenseInfo && (
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">Lisans Sahibi (Müşteri)</Typography>
              <Typography variant="body1" fontWeight={600}>{licenseInfo.customerName || "—"}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Son Kullanma Tarihi</Typography>
              <Typography variant="body1" fontWeight={600}>
                {licenseInfo.expirationDate ? new Date(licenseInfo.expirationDate).toLocaleDateString() : "—"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Kullanıcı Sınırı</Typography>
              <Typography variant="body1" fontWeight={600}>{licenseInfo.maxUsers ? `${licenseInfo.maxUsers} Kullanıcı` : "Sınırsız"}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">İzin Verilen Modüller</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                {licenseInfo.allowedFeatures && licenseInfo.allowedFeatures.length > 0 ? (
                  licenseInfo.allowedFeatures.map((f, i) => (
                    <Chip key={i} label={f} size="small" variant="outlined" />
                  ))
                ) : (
                  <Chip label="Tümü" size="small" variant="outlined" />
                )}
              </Stack>
            </Box>
          </Stack>
        )}

        <Divider />

        {/* Lisans Güncelleme Formu */}
        <Box component="form" onSubmit={handleActivate}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Lisansı Güncelle</Typography>
          <TextField
            placeholder="Yeni lisans anahtarını buraya yapıştırın..."
            multiline
            rows={4}
            fullWidth
            value={licenseKeyInput}
            onChange={(e) => setLicenseKeyInput(e.target.value)}
            disabled={isSubmitting}
            size="small"
            sx={{
              "& .MuiOutlinedInput-root": {
                fontFamily: "monospace",
                fontSize: "0.8rem",
                bgcolor: "action.hover"
              },
              mb: 2
            }}
          />

          {errorMsg && <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>{errorMsg}</Alert>}
          {successMsg && <Alert severity="success" sx={{ borderRadius: 2, mb: 2 }}>{successMsg}</Alert>}

          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={isSubmitting || !licenseKeyInput.trim()}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
          >
            {isSubmitting ? <CircularProgress size={20} color="inherit" /> : "Lisans Anahtarını Kaydet"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

// ─── Sistem Tab Content ──────────────────────────────────────────────────────────

interface SystemInfoResponse {
  version: string;
  os: string;
  runtime: string;
  databaseConnected: boolean;
  serverTime: string;
}

interface UpdateCheckResponse {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  releaseDate?: string;
  message: string;
}

function SystemTabContent() {
  const [isCheckingManual, setIsCheckingManual] = useState(false);

  const { data: systemInfo, isLoading: isInfoLoading, refetch: refetchInfo } = useQuery<SystemInfoResponse>({
    queryKey: ["system-info"],
    queryFn: async () => (await apiClient.get<SystemInfoResponse>("/system/info")).data
  });

  const { data: updateInfo, isLoading: isUpdateLoading, refetch: refetchUpdate } = useQuery<UpdateCheckResponse>({
    queryKey: ["system-update-check"],
    queryFn: async () => (await apiClient.get<UpdateCheckResponse>("/system/check-update")).data,
    enabled: true
  });

  const handleCheckUpdates = async () => {
    setIsCheckingManual(true);
    await Promise.all([refetchInfo(), refetchUpdate()]);
    setIsCheckingManual(false);
  };

  const isChecking = isInfoLoading || isUpdateLoading || isCheckingManual;

  return (
    <Box>
      <Stack spacing={3}>
        {/* Durum Kartı */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>Veri Tabanı Bağlantısı</Typography>
            <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
              {isChecking ? "Kontrol ediliyor..." : (systemInfo?.databaseConnected ? "Bağlantı Başarılı" : "Bağlantı Başarısız")}
            </Typography>
          </Box>
          {!isChecking && (
            <Chip 
              label={systemInfo?.databaseConnected ? "Aktif" : "Hata"} 
              color={systemInfo?.databaseConnected ? "success" : "error"} 
              size="small" 
              sx={{ fontWeight: 700 }}
            />
          )}
        </Stack>

        <Divider />

        {/* Detaylı Bilgiler */}
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary">Uygulama Adı</Typography>
            <Typography variant="body1" fontWeight={600}>Nova ERP</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Mevcut Versiyon</Typography>
            <Typography variant="body1" fontWeight={600}>{systemInfo?.version || "—"}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Sunucu İşletim Sistemi</Typography>
            <Typography variant="body1" fontWeight={600}>{systemInfo?.os || "—"}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Sunucu Çalışma Zamanı (.NET)</Typography>
            <Typography variant="body1" fontWeight={600}>{systemInfo?.runtime || "—"}</Typography>
          </Box>
        </Stack>

        <Divider />

        {/* Güncelleme Durumu */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Güncelleme Durumu</Typography>
          
          {isChecking ? (
            <Stack direction="row" alignItems="center" spacing={2} sx={{ py: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">Güncellemeler denetleniyor, lütfen bekleyin...</Typography>
            </Stack>
          ) : updateInfo ? (
            <Stack spacing={2}>
              {updateInfo.updateAvailable ? (
                <>
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    <strong>Yeni Güncelleme Mevcut! ({updateInfo.latestVersion})</strong>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {updateInfo.message}
                    </Typography>
                  </Alert>
                  
                  {updateInfo.releaseDate && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">Yayınlanma Tarihi</Typography>
                      <Typography variant="body2" fontWeight={600}>{updateInfo.releaseDate}</Typography>
                    </Box>
                  )}

                  {updateInfo.releaseNotes && (
                    <Box sx={{ bgcolor: "action.hover", p: 2, borderRadius: 2, border: 1, borderColor: "divider" }}>
                      <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>Sürüm Notları:</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                        {updateInfo.releaseNotes}
                      </Typography>
                    </Box>
                  )}

                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Güncellemeyi uygulamak için lütfen sunucu terminalinde <code>scripts/update-nova.ps1</code> komutunu çalıştırın. Bu işlem veri tabanınızı yedekler ve en son Docker imajlarını otomatik çeker.
                  </Alert>
                </>
              ) : (
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                  Sisteminiz güncel. Herhangi bir güncelleme işlemi gerekmiyor.
                </Alert>
              )}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">Güncelleme bilgisi alınamadı.</Typography>
          )}

          {!isChecking && (
            <Button
              variant="outlined"
              size="small"
              onClick={handleCheckUpdates}
              sx={{ mt: 2, borderRadius: 2, textTransform: "none", fontWeight: 600 }}
            >
              Güncellemeleri Yeniden Denetle
            </Button>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

// ─── Profil Tab Content ──────────────────────────────────────────────────────────

function ProfileTabContent() {
  const { user } = useAuth();
  const theme = useTheme();

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
        <Avatar
          sx={{
            width: 64,
            height: 64,
            bgcolor: "primary.main",
            fontSize: "1.6rem",
            fontWeight: 700,
            boxShadow: `0 4px 14px ${theme.palette.primary.main}55`
          }}
        >
          {user?.username?.charAt(0).toUpperCase() ?? "?"}
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            {user?.username ?? "—"}
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <RoleChip role={user?.role ?? "Staff"} />
          </Box>
        </Box>
      </Box>

      <List disablePadding sx={{ mt: 2.5 }}>
        <ListItem disablePadding sx={{ py: 1 }}>
          <ListItemIcon sx={{ minWidth: 38 }}>
            <BadgeOutlinedIcon fontSize="small" color="action" />
          </ListItemIcon>
          <ListItemText
            primary="Kullanıcı Adı"
            secondary={user?.username ?? "—"}
            primaryTypographyProps={{ variant: "body2", color: "text.secondary", fontWeight: 500 }}
            secondaryTypographyProps={{ variant: "body1", color: "text.primary", fontWeight: 600 }}
          />
        </ListItem>
      </List>
    </Box>
  );
}

// ─── Görünüm Tab Content ────────────────────────────────────────────────────────

function AppearanceTabContent() {
  const { mode, toggleColorMode } = useThemeMode();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        py: 1
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {mode === "dark"
          ? <DarkModeOutlinedIcon color="primary" />
          : <LightModeOutlinedIcon sx={{ color: "#F59E0B" }} />
        }
        <Box>
          <Typography variant="body1" fontWeight={600}>
            {mode === "dark" ? "Koyu Tema" : "Açık Tema"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {mode === "dark"
              ? "Karanlık mod etkin — gözlerinizi yormuyor."
              : "Aydınlık mod etkin — parlak ortamlar için ideal."}
          </Typography>
        </Box>
      </Box>
      <Switch
        checked={mode === "dark"}
        onChange={toggleColorMode}
        color="primary"
        sx={{ "& .MuiSwitch-thumb": { boxShadow: "0 2px 6px rgba(0,0,0,0.3)" } }}
      />
    </Box>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  const tabsConfig = useMemo(() => {
    const list = [
      { 
        label: "Profil", 
        icon: <PersonOutlinedIcon fontSize="small" />, 
        component: <SettingsSection title="Profil Bilgileri" icon={<PersonOutlinedIcon fontSize="small" />}><ProfileTabContent /></SettingsSection> 
      },
      { 
        label: "Görünüm", 
        icon: <PaletteOutlinedIcon fontSize="small" />, 
        component: <SettingsSection title="Görünüm" icon={<PaletteOutlinedIcon fontSize="small" />}><AppearanceTabContent /></SettingsSection> 
      }
    ];

    if (user?.role === "Admin") {
      list.push(
        { 
          label: "Depolar", 
          icon: <BusinessOutlinedIcon fontSize="small" />, 
          component: <SettingsSection title="Depolar" icon={<BusinessOutlinedIcon fontSize="small" />}><WarehousesTab /></SettingsSection> 
        },
        { 
          label: "Kasalar", 
          icon: <PointOfSaleOutlinedIcon fontSize="small" />, 
          component: <SettingsSection title="Kasalar" icon={<PointOfSaleOutlinedIcon fontSize="small" />}><TerminalsTab /></SettingsSection> 
        },
        { 
          label: "Lisans", 
          icon: <KeyIcon fontSize="small" />, 
          component: <SettingsSection title="Lisans Bilgileri" icon={<KeyIcon fontSize="small" />}><LicenseTabContent /></SettingsSection> 
        }
      );

      list.push(
        { 
          label: "Sistem Güncelleme", 
          icon: <SystemUpdateAltIcon fontSize="small" />, 
          component: <SettingsSection title="Sistem Bilgileri ve Güncelleme" icon={<DnsOutlinedIcon fontSize="small" />}><SystemTabContent /></SettingsSection> 
        }
      );
    }

    if (user?.role === "Admin" || user?.role === "Manager") {
      list.push(
        { 
          label: "Kategoriler", 
          icon: <CategoryOutlinedIcon fontSize="small" />, 
          component: <SettingsSection title="Kategoriler" icon={<CategoryOutlinedIcon fontSize="small" />}><CategoriesTab /></SettingsSection> 
        },
        { 
          label: "Markalar", 
          icon: <StarOutlineIcon fontSize="small" />, 
          component: <SettingsSection title="Markalar" icon={<StarOutlineIcon fontSize="small" />}><BrandsTab /></SettingsSection> 
        },
        { 
          label: "Ölçü Birimleri", 
          icon: <Inventory2OutlinedIcon fontSize="small" />, 
          component: <SettingsSection title="Ölçü Birimleri" icon={<Inventory2OutlinedIcon fontSize="small" />}><UnitsTab /></SettingsSection> 
        }
      );
    }

    return list;
  }, [user]);

  return (
    <Stack spacing={3} sx={{ maxWidth: 800 }}>
      {/* Page Header */}
      <Box>
        <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em" sx={{ mb: 0.5 }}>
          Ayarlar
        </Typography>
        <Typography color="text.secondary" variant="body1">
          Kullanıcı tercihlerinizi ve sistem tanımlamalarını buradan yönetebilirsiniz.
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.9rem",
              minHeight: 44
            }
          }}
        >
          {tabsConfig.map((tab: any, index: number) => (
            <Tab key={index} icon={tab.icon} iconPosition="start" label={tab.label} />
          ))}
        </Tabs>
      </Box>

      {/* Render Active Tab Component */}
      {tabsConfig[activeTab]?.component}
    </Stack>
  );
}
