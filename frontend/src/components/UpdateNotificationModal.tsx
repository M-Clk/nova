import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Stack,
  Button,
  Chip,
  IconButton,
  Divider,
  Alert,
  Tooltip,
  useTheme
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import NewReleasesRoundedIcon from "@mui/icons-material/NewReleasesRounded";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import UpdateRoundedIcon from "@mui/icons-material/UpdateRounded";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useLicense } from "../context/LicenseContext";
import { apiClient } from "../api/apiClient";
import { UpdateCheckResponse } from "../api/types";

export function UpdateNotificationModal() {
  const { user } = useAuth();
  const { isLicenseValid, isChecking: isCheckingLicense } = useLicense();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [isDismissed, setIsDismissed] = useState(false);

  // Güncelleme kontrol sorgusu
  // Kullanıcı giriş yapmış ve lisans kontrolü geçmişse çalışır
  const { data: updateInfo, isLoading } = useQuery<UpdateCheckResponse>({
    queryKey: ["app-update-check"],
    queryFn: async () => (await apiClient.get<UpdateCheckResponse>("/system/check-update")).data,
    enabled: !!user && user.role !== "Kiosk" && !isCheckingLicense && isLicenseValid,
    staleTime: 10 * 60 * 1000, // 10 dakika önbellek
    refetchOnWindowFocus: false
  });

  const latestVersion = updateInfo?.latestVersion || "";

  // Oturum boyunca bir kere kapatıldıysa veya kullanıcı tarafından yoksayıldıysa kontrol et
  useEffect(() => {
    if (latestVersion) {
      const sessionDismissed = sessionStorage.getItem(`nova_dismissed_update_${latestVersion}`);
      const permanentIgnored = localStorage.getItem(`nova_ignored_update_${latestVersion}`);
      if (sessionDismissed === "true" || permanentIgnored === "true") {
        setIsDismissed(true);
      }
    }
  }, [latestVersion]);

  // Kullanıcı zaten Ayarlar > Sistem Güncelleme sekmesindeyse modalı açma
  const isAlreadyOnUpdatePage =
    location.pathname === "/settings" &&
    (location.search.includes("tab=system") || location.search.includes("tab=update"));

  const shouldOpen =
    !!user &&
    user.role !== "Kiosk" &&
    isLicenseValid &&
    !isCheckingLicense &&
    !isLoading &&
    !isDismissed &&
    !isAlreadyOnUpdatePage &&
    !!updateInfo?.updateAvailable &&
    !!latestVersion;

  const handleDismiss = () => {
    if (latestVersion) {
      sessionStorage.setItem(`nova_dismissed_update_${latestVersion}`, "true");
    }
    setIsDismissed(true);
  };

  const handleGoToUpdate = () => {
    handleDismiss();
    navigate("/settings?tab=system");
  };

  if (!shouldOpen || !updateInfo) {
    return null;
  }

  const isAdmin = user?.role === "Admin";
  const pendingReleases = updateInfo.pendingReleases || [];

  return (
    <Dialog
      open={true}
      onClose={handleDismiss}
      maxWidth="sm"
      fullWidth
      scroll="body"
      PaperProps={{
        sx: {
          borderRadius: 4,
          boxShadow: isDark
            ? "0 24px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(245, 158, 11, 0.15)"
            : "0 24px 60px rgba(15, 23, 42, 0.25), 0 0 30px rgba(245, 158, 11, 0.12)",
          bgcolor: "background.paper",
          overflow: "hidden",
          border: 1,
          borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "rgba(245, 158, 11, 0.25)",
          position: "relative"
        }
      }}
      sx={{
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        zIndex: 1300
      }}
    >
      {/* Üst Gradyan Çizgi */}
      <Box
        sx={{
          height: 6,
          background: "linear-gradient(90deg, #F59E0B 0%, #EC4899 50%, #6366F1 100%)"
        }}
      />

      <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
        {/* Başlık ve Kapat Butonu */}
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2.5 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 3,
                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(245, 158, 11, 0.4)",
                flexShrink: 0
              }}
            >
              <RocketLaunchRoundedIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                <Typography variant="h6" fontWeight={800} letterSpacing="-0.02em" color="text.primary">
                  Yeni Güncelleme Mevcut!
                </Typography>
                <Chip
                  size="small"
                  label={`v${updateInfo.latestVersion}`}
                  color="warning"
                  sx={{
                    fontWeight: 800,
                    fontSize: "0.75rem",
                    height: 24,
                    boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)"
                  }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
                Nova ERP için daha yeni ve iyileştirilmiş bir sürüm yayınlandı.
              </Typography>
            </Box>
          </Stack>

          <Tooltip title="Kapat">
            <IconButton
              onClick={handleDismiss}
              size="small"
              sx={{
                color: "text.secondary",
                "&:hover": { bgcolor: "action.hover", color: "text.primary" }
              }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Versiyon Karşılaştırma ve Tarih Kartı */}
        <Box
          sx={{
            p: 2,
            borderRadius: 3,
            bgcolor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(15, 23, 42, 0.03)",
            border: 1,
            borderColor: "divider",
            mb: 3
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                  Mevcut Sürüm
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`v${updateInfo.currentVersion}`}
                  sx={{ fontWeight: 700, fontSize: "0.75rem", height: 24, mt: 0.3 }}
                />
              </Box>

              <ArrowForwardRoundedIcon color="action" sx={{ fontSize: 18, mt: 1.5 }} />

              <Box>
                <Typography variant="caption" color="warning.main" fontWeight={700} display="block">
                  Yeni Sürüm
                </Typography>
                <Chip
                  size="small"
                  color="warning"
                  label={`v${updateInfo.latestVersion}`}
                  sx={{ fontWeight: 800, fontSize: "0.75rem", height: 24, mt: 0.3 }}
                />
              </Box>
            </Stack>

            {updateInfo.releaseDate && (
              <Stack direction="row" alignItems="center" spacing={0.8} sx={{ color: "text.secondary", pt: { xs: 0.5, sm: 0 } }}>
                <CalendarTodayRoundedIcon sx={{ fontSize: 15 }} />
                <Typography variant="caption" fontWeight={600}>
                  {updateInfo.releaseDate}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>

        {/* Sürüm Değişiklik Notları */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <NewReleasesRoundedIcon color="warning" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={700} color="text.primary">
              {pendingReleases.length > 1
                ? `Yüklenecek Sürüm Notları (${pendingReleases.length} Sürüm)`
                : "Sürüm Notları ve Yenilikler"}
            </Typography>
          </Stack>

          <Box
            sx={{
              maxHeight: 220,
              overflowY: "auto",
              pr: 0.5,
              "&::-webkit-scrollbar": { width: 6 },
              "&::-webkit-scrollbar-thumb": {
                bgcolor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                borderRadius: 3
              }
            }}
          >
            {pendingReleases.length > 0 ? (
              <Stack spacing={1.5}>
                {pendingReleases.map((rel, idx) => (
                  <Box
                    key={rel.version}
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      bgcolor: idx === 0
                        ? (isDark ? "rgba(245, 158, 11, 0.08)" : "rgba(245, 158, 11, 0.06)")
                        : (isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)"),
                      border: 1,
                      borderColor: idx === 0
                        ? (isDark ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.2)")
                        : "divider"
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip
                          label={`v${rel.version}`}
                          size="small"
                          color={idx === 0 ? "warning" : "default"}
                          sx={{ fontWeight: 700, height: 22, fontSize: "0.72rem" }}
                        />
                        {idx === 0 && (
                          <Chip
                            label="En Yeni"
                            size="small"
                            variant="outlined"
                            color="warning"
                            sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }}
                          />
                        )}
                      </Stack>
                      {rel.releaseDate && (
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          {rel.releaseDate}
                        </Typography>
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", pl: 0.5, fontSize: "0.85rem", lineHeight: 1.5 }}>
                      {rel.releaseNotes}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : updateInfo.releaseNotes ? (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  bgcolor: isDark ? "rgba(245, 158, 11, 0.08)" : "rgba(245, 158, 11, 0.06)",
                  border: 1,
                  borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.2)"
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  {updateInfo.releaseNotes}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Detaylı sürüm notu bulunamadı.
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Bilgilendirme ve Aksiyon Butonları */}
        {isAdmin ? (
          <Stack spacing={2}>
            <Alert
              severity="info"
              icon={<SecurityOutlinedIcon fontSize="inherit" />}
              sx={{
                borderRadius: 2.5,
                fontSize: "0.82rem",
                "& .MuiAlert-message": { lineHeight: 1.4 }
              }}
            >
              Güncelleme öncesinde veri tabanı yedeği otomatik olarak alınır.
            </Alert>

            <Stack direction={{ xs: "column-reverse", sm: "row" }} alignItems="center" justifyContent="flex-end" spacing={1.5}>
              <Button
                variant="outlined"
                color="inherit"
                onClick={handleDismiss}
                fullWidth={false}
                sx={{
                  borderRadius: 2.5,
                  textTransform: "none",
                  fontWeight: 600,
                  px: 2.5,
                  py: 1,
                  color: "text.secondary",
                  borderColor: "divider",
                  "&:hover": { borderColor: "text.primary" }
                }}
              >
                Daha Sonra Hatırlat
              </Button>

              <Button
                variant="contained"
                color="warning"
                onClick={handleGoToUpdate}
                endIcon={<ArrowForwardRoundedIcon />}
                startIcon={<UpdateRoundedIcon />}
                sx={{
                  borderRadius: 2.5,
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  px: 3,
                  py: 1,
                  boxShadow: "0 6px 20px rgba(245, 158, 11, 0.4)",
                  background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                  "&:hover": {
                    background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)",
                    boxShadow: "0 8px 24px rgba(245, 158, 11, 0.5)"
                  }
                }}
              >
                Güncelleme Ekranına Git
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Alert severity="warning" sx={{ borderRadius: 2.5, fontSize: "0.82rem" }}>
              Nova ERP'nin yeni bir sürümü yayınlandı. Sistemi güncellemek için lütfen <strong>Sistem Yöneticisi (Admin)</strong> ile iletişime geçiniz.
            </Alert>

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                onClick={handleDismiss}
                sx={{
                  borderRadius: 2.5,
                  textTransform: "none",
                  fontWeight: 600,
                  px: 3,
                  py: 0.9
                }}
              >
                Anladım
              </Button>
            </Box>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
