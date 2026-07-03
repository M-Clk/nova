import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Dialog,
  Divider,
  IconButton,
  Tooltip
} from "@mui/material";
import KeyIcon from "@mui/icons-material/Key";
import LogoutIcon from "@mui/icons-material/Logout";
import SecurityIcon from "@mui/icons-material/Security";
import { useLicense } from "../context/LicenseContext";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

export function LicenseOverlay() {
  const { isLicenseValid, licenseInfo, isChecking, activate } = useLicense();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (isChecking) {
    return null; // Yükleme sırasında bir şey gösterme
  }

  // Lisans geçerliyse veya kullanıcı login olmamışsa (login sayfasındayken lisans kontrolü engelleyici olmasın)
  // veya kullanıcı bilgisi henüz yüklenmemişse overlay'i gösterme
  if (isLicenseValid || !user) {
    return null;
  }

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const success = await activate(licenseKeyInput.trim());
      if (success) {
        setSuccessMsg("Lisans başarıyla etkinleştirildi! Yönlendiriliyorsunuz...");
        setLicenseKeyInput("");
      } else {
        setErrorMsg("Lisans anahtarı doğrulanamadı. Lütfen geçerli bir anahtar girdiğinizden emin olun.");
      }
    } catch (err) {
      setErrorMsg("Bağlantı hatası oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const isAdmin = user.role === "Admin";

  return (
    <Dialog
      open={true}
      maxWidth="sm"
      fullWidth
      scroll="body"
      PaperProps={{
        sx: {
          borderRadius: 4,
          boxShadow: "0 24px 48px rgba(0, 0, 0, 0.25)",
          bgcolor: "background.paper",
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          position: "relative"
        }
      }}
      sx={{
        backdropFilter: "blur(12px)",
        backgroundColor: "rgba(0, 0, 0, 0.6)"
      }}
    >
      <Box
        sx={{
          height: 6,
          background: "linear-gradient(90deg, #6366F1 0%, #EC4899 100%)"
        }}
      />
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                bgcolor: isAdmin ? "primary.light" : "error.light",
                color: isAdmin ? "primary.main" : "error.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.15)"
              }}
            >
              {isAdmin ? <KeyIcon /> : <SecurityIcon />}
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} letterSpacing="-0.02em" color="text.primary">
                {isAdmin ? "Lisans Aktivasyonu" : "Lisans Süresi Doldu"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {licenseInfo?.customerName ? `${licenseInfo.customerName} adına kayıtlı lisans` : "Nova ERP Lisans Kontrolü"}
              </Typography>
            </Box>
          </Stack>
          <Tooltip title="Çıkış Yap">
            <IconButton onClick={handleLogout} color="error" sx={{ bgcolor: "action.hover" }}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider sx={{ mb: 3 }} />

        {/* Expiration Details or Warning Info */}
        <Box sx={{ mb: 3 }}>
          {licenseInfo?.expirationDate ? (
            <Alert severity="warning" variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
              Lisansınızın geçerlilik süresi <strong>{new Date(licenseInfo.expirationDate).toLocaleDateString()}</strong> tarihinde dolmuştur. Sistem kilitlenmiştir.
            </Alert>
          ) : (
            <Alert severity="error" variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
              Sistemde geçerli bir lisans bulunamadı. Lütfen yeni bir lisans anahtarı girin.
            </Alert>
          )}
        </Box>

        {isAdmin ? (
          /* Admin License Activation Form */
          <Box component="form" onSubmit={handleActivate}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }} color="text.primary">
              Lisans Anahtarı (Base64)
            </Typography>
            <TextField
              placeholder="Lisans anahtarını buraya yapıştırın..."
              multiline
              rows={6}
              fullWidth
              value={licenseKeyInput}
              onChange={(e) => setLicenseKeyInput(e.target.value)}
              disabled={isSubmitting}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 3,
                  fontFamily: "monospace",
                  fontSize: "0.82rem",
                  bgcolor: "action.hover"
                },
                mb: 3
              }}
            />

            {errorMsg && (
              <Alert severity="error" sx={{ borderRadius: 3, mb: 3 }}>
                {errorMsg}
              </Alert>
            )}

            {successMsg && (
              <Alert severity="success" sx={{ borderRadius: 3, mb: 3 }}>
                {successMsg}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isSubmitting || !licenseKeyInput.trim()}
              sx={{
                py: 1.5,
                borderRadius: 3,
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.95rem",
                boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
                background: "linear-gradient(90deg, #6366F1 0%, #4F46E5 100%)",
                "&:hover": {
                  background: "linear-gradient(90deg, #4F46E5 0%, #4338CA 100%)"
                }
              }}
            >
              {isSubmitting ? <CircularProgress size={24} color="inherit" /> : "Lisansı Etkinleştir"}
            </Button>
          </Box>
        ) : (
          /* Non-Admin Locked View */
          <Box sx={{ textAlign: "center", py: 2 }}>
            <Typography variant="body1" sx={{ mb: 3, color: "text.secondary" }}>
              Nova ERP lisansınız sona ermiştir. Uygulamayı kullanmaya devam edebilmek için lütfen sistem yöneticiniz (Admin) ile iletişime geçerek lisansın güncellenmesini isteyin.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              onClick={handleLogout}
              startIcon={<LogoutIcon />}
              sx={{ borderRadius: 2.5, px: 4, py: 1, textTransform: "none", fontWeight: 600 }}
            >
              Farklı Hesapla Giriş Yap / Çıkış
            </Button>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
