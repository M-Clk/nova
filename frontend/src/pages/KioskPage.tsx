import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Fade,
  Chip,
  Button,
  useTheme
} from "@mui/material";
import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import { useAuth } from "../auth/AuthContext";
import { apiClient } from "../api/apiClient";
import { useNavigate } from "react-router-dom";
import type { PosProductDto } from "../api/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const IDLE_TIMEOUT_MS = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────

type KioskState = "idle" | "loading" | "found" | "notfound" | "error";

// ─── Price Formatter ──────────────────────────────────────────────────────────

function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2
  }).format(value);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KioskPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [state, setState] = useState<KioskState>("idle");
  const [product, setProduct] = useState<PosProductDto | null>(null);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Keep focus on hidden input ──────────────────────────────────────────

  const reFocus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    reFocus();
  }, [reFocus]);

  // ─── Idle reset ───────────────────────────────────────────────────────────

  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setState("idle");
      setProduct(null);
      setBarcodeBuffer("");
      reFocus();
    }, IDLE_TIMEOUT_MS);
  }, [reFocus]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // ─── Barcode lookup ───────────────────────────────────────────────────────

  const handleBarcodeLookup = useCallback(
    async (barcode: string) => {
      if (!barcode.trim()) return;
      setState("loading");
      setProduct(null);

      try {
        const { data } = await apiClient.get<PosProductDto>(
          `/products/barcode/${encodeURIComponent(barcode.trim())}`
        );
        setProduct(data);
        setState("found");
        startIdleTimer();
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setState("notfound");
        } else {
          setState("error");
        }
        startIdleTimer();
      }
    },
    [startIdleTimer]
  );

  // ─── Keyboard handler ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const value = barcodeBuffer.trim();
        setBarcodeBuffer("");
        if (value) handleBarcodeLookup(value);
      }
    },
    [barcodeBuffer, handleBarcodeLookup]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBarcodeBuffer(e.target.value);
    },
    []
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  // ─── Colours ─────────────────────────────────────────────────────────────

  const isDark = theme.palette.mode === "dark";
  const gradientBg = isDark
    ? "linear-gradient(160deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)"
    : "linear-gradient(160deg, #eef2ff 0%, #ede9fe 60%, #f0f4ff 100%)";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Box
      onClick={reFocus}
      sx={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: gradientBg,
        position: "relative",
        userSelect: "none",
        overflow: "hidden"
      }}
    >
      {/* Gizli barkod input */}
      <input
        ref={inputRef}
        value={barcodeBuffer}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={reFocus}
        style={{
          position: "absolute",
          opacity: 0,
          width: 1,
          height: 1,
          pointerEvents: "none"
        }}
        aria-label="Barkod girişi"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {/* Arka plan dekor halkaları */}
      <Box sx={{
        position: "absolute", width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
        top: "-150px", left: "-150px", pointerEvents: "none"
      }} />
      <Box sx={{
        position: "absolute", width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)",
        bottom: "-100px", right: "-100px", pointerEvents: "none"
      }} />

      {/* Logo — üst orta */}
      <Box sx={{
        position: "absolute", top: 32, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 1.5
      }}>
        <Box
          component="img"
          src="/logo.png"
          alt="Nova"
          sx={{
            width: 40, height: 40, objectFit: "contain",
            borderRadius: 1.5, boxShadow: "0 4px 16px rgba(99,102,241,0.35)"
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <Typography sx={{
          fontWeight: 800, fontSize: "1.3rem", letterSpacing: "-0.03em",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
        }}>
          Nova
        </Typography>
      </Box>

      {/* ─── Ana içerik ─── */}
      <Box sx={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 4, px: 4, width: "100%", maxWidth: 800
      }}>

        {/* ─── IDLE ─── */}
        {state === "idle" && (
          <Fade in timeout={500}>
            <Box sx={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <Box sx={{
                width: 160, height: 160, borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.18))",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "3px solid rgba(99,102,241,0.25)",
                animation: "pulse 2.5s ease-in-out infinite",
                boxShadow: "0 0 0 0 rgba(99,102,241,0.3)"
              }}>
                <QrCodeScannerOutlinedIcon sx={{ fontSize: 80, color: "primary.main" }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: "2.4rem", letterSpacing: "-0.03em", color: "text.primary", lineHeight: 1.2, mb: 1.5 }}>
                  Fiyat Öğrenmek İçin
                </Typography>
                <Typography sx={{ fontSize: "1.4rem", color: "text.secondary", fontWeight: 500 }}>
                  Ürünü barkod okuyucuya okutunuz
                </Typography>
              </Box>
            </Box>
          </Fade>
        )}

        {/* ─── LOADING ─── */}
        {state === "loading" && (
          <Fade in timeout={300}>
            <Box sx={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <CircularProgress size={80} thickness={3} />
              <Typography sx={{ fontSize: "1.5rem", color: "text.secondary", fontWeight: 500 }}>
                Ürün aranıyor…
              </Typography>
            </Box>
          </Fade>
        )}

        {/* ─── FOUND ─── */}
        {state === "found" && product && (
          <Fade in timeout={400}>
            <Box sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 64, color: "success.main" }} />

              {/* Ürün adı */}
              <Typography sx={{
                fontWeight: 800, fontSize: "2.8rem", textAlign: "center",
                lineHeight: 1.2, color: "text.primary", letterSpacing: "-0.03em"
              }}>
                {product.name}
              </Typography>

              {/* Fiyat kutusu */}
              <Box sx={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                borderRadius: 4, px: 8, py: 3,
                boxShadow: "0 16px 48px rgba(99,102,241,0.4)"
              }}>
                <Typography sx={{
                  fontWeight: 900, fontSize: "4rem", color: "#fff",
                  letterSpacing: "-0.04em", lineHeight: 1
                }}>
                  {formatPrice(product.salePrice)}
                </Typography>
              </Box>

              {/* Barkod */}
              <Chip
                label={`Barkod: ${product.barcode}`}
                variant="outlined"
                sx={{
                  color: "text.secondary", borderColor: "divider",
                  fontSize: "1rem", height: 36, px: 1
                }}
              />

              <Typography sx={{ color: "text.disabled", fontSize: "1rem" }}>
                Başka bir ürün için tekrar okutunuz
              </Typography>
            </Box>
          </Fade>
        )}

        {/* ─── NOT FOUND ─── */}
        {state === "notfound" && (
          <Fade in timeout={300}>
            <Box sx={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <ErrorOutlineIcon sx={{ fontSize: 80, color: "warning.main" }} />
              <Typography sx={{ fontSize: "2.4rem", fontWeight: 800, color: "text.primary", letterSpacing: "-0.02em" }}>
                Ürün Bulunamadı
              </Typography>
              <Typography sx={{ fontSize: "1.3rem", color: "text.secondary" }}>
                Bu barkoda ait ürün sistemde kayıtlı değil.
              </Typography>
              <Typography sx={{ color: "text.disabled", fontSize: "1rem", mt: 1 }}>
                Başka bir ürün okutabilirsiniz
              </Typography>
            </Box>
          </Fade>
        )}

        {/* ─── ERROR ─── */}
        {state === "error" && (
          <Fade in timeout={300}>
            <Box sx={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <ErrorOutlineIcon sx={{ fontSize: 80, color: "error.main" }} />
              <Typography sx={{ fontSize: "2.4rem", fontWeight: 800, color: "text.primary", letterSpacing: "-0.02em" }}>
                Bağlantı Hatası
              </Typography>
              <Typography sx={{ fontSize: "1.3rem", color: "text.secondary" }}>
                Sunucuya ulaşılamıyor. Lütfen personeli çağırınız.
              </Typography>
            </Box>
          </Fade>
        )}
      </Box>

      {/* Çıkış butonu — sağ alt köşe */}
      <Button
        id="kiosk-logout-button"
        onClick={handleLogout}
        variant="text"
        color="inherit"
        size="small"
        startIcon={<LogoutOutlinedIcon sx={{ fontSize: "0.85rem !important" }} />}
        sx={{
          position: "absolute", bottom: 20, right: 24,
          color: "text.disabled", textTransform: "none",
          fontSize: "0.78rem", fontWeight: 500, opacity: 0.5,
          "&:hover": { opacity: 1, color: "error.main" },
          transition: "all 0.2s"
        }}
      >
        Çıkış Yap
      </Button>

      {/* Pulse animasyon */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(99,102,241,0.3); }
          50% { transform: scale(1.03); box-shadow: 0 0 0 20px rgba(99,102,241,0); }
        }
      `}</style>
    </Box>
  );
}
