import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
  Snackbar
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import { apiClient } from "../api/apiClient";
import { useAuth } from "../auth/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

type UserDto = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type CreateUserRequest = {
  username: string;
  email?: string;
  password: string;
  role: string;
};

type UpdateUserRequest = {
  username: string;
  email?: string;
  role: string;
  isActive: boolean;
  newPassword?: string;
};

// ─── API helpers ─────────────────────────────────────────────────────────────

const fetchUsers = async (): Promise<UserDto[]> => {
  const { data } = await apiClient.get<UserDto[]>("/users");
  return data;
};

const createUser = async (req: CreateUserRequest): Promise<UserDto> => {
  const { data } = await apiClient.post<UserDto>("/users", req);
  return data;
};

const updateUser = async ({ id, req }: { id: string; req: UpdateUserRequest }): Promise<void> => {
  await apiClient.put(`/users/${id}`, req);
};

const deleteUser = async (id: string): Promise<void> => {
  await apiClient.delete(`/users/${id}`);
};

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ROLES = ["Admin", "Manager", "Staff"] as const;

function RoleChip({ role }: { role: string }) {
  const map: Record<string, { label: string; color: "error" | "warning" | "info"; icon: React.ReactNode }> = {
    Admin: { label: "Admin", color: "error", icon: <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 14 }} /> },
    Manager: { label: "Yönetici", color: "warning", icon: <ManageAccountsOutlinedIcon sx={{ fontSize: 14 }} /> },
    Staff: { label: "Personel", color: "info", icon: <BadgeOutlinedIcon sx={{ fontSize: 14 }} /> }
  };
  const cfg = map[role] ?? map["Staff"];
  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size="small"
      icon={<>{cfg.icon}</>}
      sx={{
        height: 24,
        fontWeight: 700,
        fontSize: "0.75rem",
        borderRadius: "12px",
        px: 0.5,
        "& .MuiChip-icon": {
          ml: 0.5,
          mr: -0.25
        },
        "& .MuiChip-label": {
          px: 1
        }
      }}
    />
  );
}

// ─── User Dialog ─────────────────────────────────────────────────────────────

type DialogMode = "create" | "edit";

interface UserDialogProps {
  open: boolean;
  mode: DialogMode;
  editUser: UserDto | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

function UserDialog({ open, mode, editUser, onClose, onSaved }: UserDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = mode === "edit";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<string>("Staff");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Populate fields when editing
  React.useEffect(() => {
    if (open && isEdit && editUser) {
      setUsername(editUser.username);
      setEmail(editUser.email || "");
      setRole(editUser.role);
      setIsActive(editUser.isActive);
      setPassword("");
    } else if (open && !isEdit) {
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("Staff");
      setIsActive(true);
    }
    setError(null);
  }, [open, isEdit, editUser]);

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onSaved("Kullanıcı başarıyla oluşturuldu.");
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err?.response?.data?.error ?? "Bir hata oluştu.");
    }
  });

  const updateMutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onSaved("Kullanıcı bilgileri güncellendi.");
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err?.response?.data?.error ?? "Bir hata oluştu.");
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEdit) {
      if (!password || password.length < 6) {
        setError("Şifre en az 6 karakter olmalıdır.");
        return;
      }
      createMutation.mutate({ username, email: email || undefined, password, role });
    } else {
      if (password && password.length < 6) {
        setError("Yeni şifre en az 6 karakter olmalıdır.");
        return;
      }
      updateMutation.mutate({
        id: editUser!.id,
        req: { username, email: email || undefined, role, isActive, newPassword: password || undefined }
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, backgroundImage: "none" } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PersonAddOutlinedIcon color="primary" />
          {isEdit ? "Kullanıcı Düzenle" : "Yeni Personel Ekle"}
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <TextField
            id="user-username"
            label="Kullanıcı Adı"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            fullWidth
            disabled={isPending}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          />

          <TextField
            id="user-email"
            label="E-posta Adresi"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            disabled={isPending}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          />

          <TextField
            id="user-password"
            label={isEdit ? "Yeni Şifre (boş bırakılırsa değişmez)" : "Şifre"}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!isEdit}
            fullWidth
            disabled={isPending}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword((s) => !s)} size="small" tabIndex={-1}>
                    {showPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          />

          <FormControl fullWidth required>
            <InputLabel id="user-role-label">Rol</InputLabel>
            <Select
              labelId="user-role-label"
              id="user-role"
              value={role}
              label="Rol"
              onChange={(e) => setRole(e.target.value)}
              disabled={isPending}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", alignItems: "center", py: 0.25 }}>
                  <RoleChip role={selected as string} />
                </Box>
              )}
              sx={{
                borderRadius: 2,
                "& .MuiSelect-select": {
                  display: "flex",
                  alignItems: "center",
                  py: 1.25,
                  minHeight: "auto !important"
                }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    borderRadius: 2,
                    mt: 0.5,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                    "& .MuiMenuItem-root": {
                      py: 1,
                      px: 2,
                      borderRadius: 1,
                      mx: 0.5,
                      my: 0.25
                    }
                  }
                }
              }}
            >
              {ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  <RoleChip role={r} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {isEdit && (
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={isPending}
                  color="success"
                />
              }
              label={
                <Typography variant="body2" fontWeight={500}>
                  {isActive ? "Aktif" : "Pasif"}
                </Typography>
              }
            />
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={onClose} disabled={isPending} sx={{ borderRadius: 2, textTransform: "none" }}>
            İptal
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isPending || !username}
            startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700, px: 3 }}
          >
            {isEdit ? "Güncelle" : "Oluştur"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

// ─── Delete Confirmation ──────────────────────────────────────────────────────

function DeleteDialog({
  open,
  user,
  onClose,
  onDeleted
}: {
  open: boolean;
  user: UserDto | null;
  onClose: () => void;
  onDeleted: (msg: string) => void;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onDeleted("Kullanıcı silindi.");
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      onDeleted("Hata: " + (err?.response?.data?.error ?? "Silinemedi."));
      onClose();
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, backgroundImage: "none" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Kullanıcıyı Sil</DialogTitle>
      <DialogContent>
        <Typography>
          <strong>{user?.username}</strong> kullanıcısını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, textTransform: "none" }}>
          İptal
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => user && deleteMutation.mutate(user.id)}
          disabled={deleteMutation.isPending}
          startIcon={deleteMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
        >
          Sil
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "Admin";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [deleteDialogUser, setDeleteDialogUser] = useState<UserDto | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success"
  });

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers
  });

  const openCreate = () => {
    setDialogMode("create");
    setEditUser(null);
    setDialogOpen(true);
  };

  const openEdit = (user: UserDto) => {
    setDialogMode("edit");
    setEditUser(user);
    setDialogOpen(true);
  };

  const showSnackbar = (message: string, severity: "success" | "error" = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ borderRadius: 2 }}>
        Kullanıcılar yüklenemedi.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} letterSpacing="-0.02em">
            Personel Yönetimi
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {users.length} kullanıcı kayıtlı
          </Typography>
        </Box>
        {isAdmin && (
          <Button
            id="add-user-button"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 700,
              px: 3,
              py: 1.2,
              boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
              "&:hover": { boxShadow: "0 6px 20px rgba(99,102,241,0.45)", transform: "translateY(-1px)" },
              transition: "all 0.2s ease"
            }}
          >
            Yeni Personel
          </Button>
        )}
      </Box>

      {/* Table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden"
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                Kullanıcı
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                E-posta
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                Rol
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                Durum
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                Oluşturulma
              </TableCell>
              {isAdmin && (
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                  İşlemler
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow
                key={u.id}
                hover
                sx={{
                  "&:last-child td": { borderBottom: 0 },
                  opacity: u.isActive ? 1 : 0.55,
                  transition: "background 0.15s ease"
                }}
              >
                {/* Username */}
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        bgcolor: "primary.main",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {u.username}
                      </Typography>
                      {u.username === "admin" && (
                        <Typography variant="caption" color="text.secondary">
                          Sistem yöneticisi
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>

                {/* Email */}
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {u.email}
                  </Typography>
                </TableCell>

                {/* Role */}
                <TableCell>
                  <RoleChip role={u.role} />
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Chip
                    label={u.isActive ? "Aktif" : "Pasif"}
                    color={u.isActive ? "success" : "default"}
                    size="small"
                    variant={u.isActive ? "filled" : "outlined"}
                    sx={{ fontWeight: 600, fontSize: "0.72rem" }}
                  />
                </TableCell>

                {/* Created At */}
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(u.createdAt).toLocaleDateString("tr-TR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    })}
                  </Typography>
                </TableCell>

                {/* Actions */}
                {isAdmin && (
                  <TableCell align="right">
                    <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
                      <Tooltip title="Düzenle">
                        <IconButton
                          size="small"
                          onClick={() => openEdit(u)}
                          sx={{ color: "primary.main", "&:hover": { bgcolor: "primary.main", color: "#fff" }, transition: "all 0.15s" }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sil">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => setDeleteDialogUser(u)}
                            disabled={u.username === "admin"}
                            sx={{ color: "error.main", "&:hover": { bgcolor: "error.main", color: "#fff" }, transition: "all 0.15s" }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialogs */}
      <UserDialog
        open={dialogOpen}
        mode={dialogMode}
        editUser={editUser}
        onClose={() => setDialogOpen(false)}
        onSaved={(msg) => showSnackbar(msg)}
      />

      <DeleteDialog
        open={deleteDialogUser !== null}
        user={deleteDialogUser}
        onClose={() => setDeleteDialogUser(null)}
        onDeleted={(msg) => showSnackbar(msg, msg.startsWith("Hata") ? "error" : "success")}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
