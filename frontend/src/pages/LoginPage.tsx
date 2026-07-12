import React, { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Avatar
} from "@mui/material";
import InventoryOutlinedIcon from "@mui/icons-material/InventoryOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useAuth } from "../auth/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the original page they tried to access or default to "/"
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const loggedInUser = await login(username.trim(), password);
      // Kiosk rolü doğrudan kiosk ekranına yönlendirilir
      if (loggedInUser?.role === "Kiosk") {
        navigate("/kiosk", { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr?.response?.data?.error ??
          "Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        background: (theme) =>
          theme.palette.mode === "dark"
            ? "radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(168,85,247,0.1) 0%, transparent 60%), #0f1117"
            : "radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(168,85,247,0.06) 0%, transparent 60%), #f8f9ff",
        p: 2
      }}
    >
      {/* Glass card */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 4,
          p: 5,
          backdropFilter: "blur(20px)",
          backgroundColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.04)"
              : "rgba(255,255,255,0.80)",
          border: "1px solid",
          borderColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.08)"
              : "rgba(99,102,241,0.15)",
          boxShadow: (theme) =>
            theme.palette.mode === "dark"
              ? "0 25px 60px rgba(0,0,0,0.5)"
              : "0 25px 60px rgba(99,102,241,0.12)",
          display: "flex",
          flexDirection: "column",
          gap: 3
        }}
      >
        {/* Logo + Brand */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <Box
            component="img"
            src="/logo.png"
            alt="Nova Logo"
            sx={{
              width: 96,
              height: 96,
              objectFit: "contain",
              borderRadius: 3,
              boxShadow: "0 8px 24px rgba(99,102,241,0.35)"
            }}
          />
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h5" fontWeight={800} letterSpacing="-0.03em">
              Nova
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Devam etmek için giriş yapın
            </Typography>
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            sx={{ borderRadius: 2, fontSize: "0.875rem" }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Username Field */}
        <TextField
          id="login-username"
          label="Kullanıcı Adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          required
          fullWidth
          disabled={loading}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonOutlinedIcon color="action" fontSize="small" />
              </InputAdornment>
            )
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 3,
              backgroundColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.02)"
                  : "rgba(0, 0, 0, 0.02)",
              transition: "all 0.2s ease-in-out",
              "& fieldset": {
                borderColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.12)"
                    : "rgba(0, 0, 0, 0.12)",
              },
              "&:hover fieldset": {
                borderColor: "primary.light"
              },
              "&.Mui-focused fieldset": {
                borderColor: "primary.main",
                borderWidth: "1px"
              },
              "&.Mui-focused": {
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.04)"
                    : "rgba(0, 0, 0, 0.01)",
                boxShadow: (theme) =>
                  `0 0 0 3px ${
                    theme.palette.mode === "dark"
                      ? "rgba(99, 102, 241, 0.15)"
                      : "rgba(99, 102, 241, 0.08)"
                  }`,
              }
            },
            "& input:-webkit-autofill": {
              WebkitBoxShadow: (theme) =>
                `0 0 0 1000px ${
                  theme.palette.mode === "dark" ? "#161d2b" : "#f3f4f6"
                } inset !important`,
              WebkitTextFillColor: (theme) =>
                theme.palette.mode === "dark" ? "#F3F4F6 !important" : "#111827 !important",
              transition: "background-color 5000s ease-in-out 0s",
              borderRadius: "12px",
            }
          }}
        />

        {/* Password Field */}
        <TextField
          id="login-password"
          label="Şifre"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          fullWidth
          disabled={loading}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlinedIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword((s) => !s)}
                  edge="end"
                  size="small"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <VisibilityOffOutlinedIcon fontSize="small" />
                  ) : (
                    <VisibilityOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 3,
              backgroundColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.02)"
                  : "rgba(0, 0, 0, 0.02)",
              transition: "all 0.2s ease-in-out",
              "& fieldset": {
                borderColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.12)"
                    : "rgba(0, 0, 0, 0.12)",
              },
              "&:hover fieldset": {
                borderColor: "primary.light"
              },
              "&.Mui-focused fieldset": {
                borderColor: "primary.main",
                borderWidth: "1px"
              },
              "&.Mui-focused": {
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.04)"
                    : "rgba(0, 0, 0, 0.01)",
                boxShadow: (theme) =>
                  `0 0 0 3px ${
                    theme.palette.mode === "dark"
                      ? "rgba(99, 102, 241, 0.15)"
                      : "rgba(99, 102, 241, 0.08)"
                  }`,
              }
            },
            "& input:-webkit-autofill": {
              WebkitBoxShadow: (theme) =>
                `0 0 0 1000px ${
                  theme.palette.mode === "dark" ? "#161d2b" : "#f3f4f6"
                } inset !important`,
              WebkitTextFillColor: (theme) =>
                theme.palette.mode === "dark" ? "#F3F4F6 !important" : "#111827 !important",
              transition: "background-color 5000s ease-in-out 0s",
              borderRadius: "12px",
            }
          }}
        />

        {/* Submit */}
        <Button
          id="login-submit"
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
          sx={{
            borderRadius: 3,
            py: 1.6,
            fontWeight: 700,
            fontSize: "1rem",
            textTransform: "none",
            boxShadow: "0 8px 24px rgba(99,102,241,0.35)",
            "&:hover": {
              boxShadow: "0 12px 32px rgba(99,102,241,0.45)",
              transform: "translateY(-1px)"
            },
            transition: "all 0.2s ease"
          }}
        >
          {loading ? <CircularProgress size={22} color="inherit" /> : "Giriş Yap"}
        </Button>

      </Box>
    </Box>
  );
}
