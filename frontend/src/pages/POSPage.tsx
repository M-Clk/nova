import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Badge,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";
import type {
  CartItem,
  PosProductDto,
  TerminalDto,
  PosCheckoutResult,
  PosCheckoutRequest,
} from "../api/types";
import { useCart } from "../context/CartContext";

// ─── API helpers ─────────────────────────────────────────────────────────────

const fetchTerminals = async (): Promise<TerminalDto[]> => {
  const { data } = await apiClient.get<TerminalDto[]>("/pos/terminals");
  return data;
};

const fetchProductByBarcode = async (barcode: string): Promise<PosProductDto | null> => {
  try {
    const { data } = await apiClient.get<PosProductDto>(`/products/barcode/${encodeURIComponent(barcode)}`);
    return data;
  } catch {
    return null;
  }
};

const checkout = async (request: PosCheckoutRequest): Promise<PosCheckoutResult> => {
  const { data } = await apiClient.post<PosCheckoutResult>("/pos/checkout", request);
  return data;
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (amount: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);

// ─── Component ───────────────────────────────────────────────────────────────

export function POSPage() {
  const {
    cart,
    selectedTerminalId,
    setSelectedTerminalId,
    addToCart,
    updateQty,
    removeItem,
    clearCart,
  } = useCart();

  const [barcodeInput, setBarcodeInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" }>({
    open: false,
    message: "",
    severity: "success",
  });
  const [lastSale, setLastSale] = useState<PosCheckoutResult | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const { data: terminals = [], isLoading: terminalsLoading } = useQuery({
    queryKey: ["pos-terminals"],
    queryFn: fetchTerminals,
  });

  // Auto-select first terminal
  useEffect(() => {
    if (terminals.length > 0 && !selectedTerminalId) {
      setSelectedTerminalId(terminals[0].id);
    }
  }, [terminals, selectedTerminalId, setSelectedTerminalId]);

  // Auto-focus barcode input on mount
  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  // Re-focus barcode when user returns to tab
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setTimeout(() => barcodeRef.current?.focus(), 50);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Global click listener to keep focus on barcode input unless clicking an interactive element
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const isInteractive =
        target.tagName === "INPUT" ||
        target.tagName === "BUTTON" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        target.closest("button") ||
        target.closest("a") ||
        target.closest("[role='combobox']") ||
        target.closest("[role='listbox']") ||
        target.closest("[role='option']") ||
        target.closest(".MuiMenuItem-root") ||
        target.closest(".MuiSelect-select") ||
        target.closest(".MuiPopover-root") ||
        target.closest(".MuiMenu-root") ||
        target.closest(".MuiDialog-root");

      if (!isInteractive) {
        setTimeout(() => {
          barcodeRef.current?.focus();
        }, 30);
      }
    };

    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        barcodeRef.current?.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelSale();
      } else if (e.key === "F12") {
        e.preventDefault();
        if (cart.length > 0 && selectedTerminalId) {
          handleCheckout();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, selectedTerminalId]);

  const showSnack = (message: string, severity: "success" | "error" | "warning") => {
    setSnack({ open: true, message, severity });
  };

  const checkoutMutation = useMutation({
    mutationFn: checkout,
    onSuccess: (result) => {
      setLastSale(result);
      clearCart();
      setBarcodeInput("");
      showSnack(`✓ Satış tamamlandı! Fiş No: ${result.saleNo}`, "success");
      setTimeout(() => barcodeRef.current?.focus(), 100);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Satış tamamlanırken hata oluştu.";
      showSnack(msg, "error");
      setTimeout(() => barcodeRef.current?.focus(), 100);
    },
  });

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isScanning) return; // Prevent concurrent scans

    const code = barcodeInput.trim();
    if (!code) return;

    setIsScanning(true);
    setBarcodeInput("");

    const product = await fetchProductByBarcode(code);
    setIsScanning(false);

    if (product) {
      addToCart(product);
    } else {
      showSnack(`Barkod bulunamadı: ${code}`, "warning");
    }

    barcodeRef.current?.focus();
  };

  const handleCancelSale = () => {
    clearCart();
    setBarcodeInput("");
    setLastSale(null);
    barcodeRef.current?.focus();
  };

  const handleCheckout = () => {
    if (!selectedTerminalId) {
      showSnack("Lütfen bir kasa seçiniz.", "warning");
      return;
    }
    if (cart.length === 0) {
      showSnack("Sepet boş.", "warning");
      return;
    }
    checkoutMutation.mutate({
      customerId: null,
      terminalId: selectedTerminalId,
      items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });
  };

  // Totals
  const subtotal = cart.reduce((sum, i) => sum + i.lineTotal, 0);
  const discount = 0;
  const total = subtotal - discount;
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const selectedTerminal = terminals.find((t) => t.id === selectedTerminalId);

  return (
    <Box
      sx={{
        display: "flex",
        height: "100%",
        minHeight: "calc(100vh - 130px)",
        gap: 2,
        flexDirection: { xs: "column", lg: "row" },
      }}
    >
      {/* ─── Left Panel: Barcode + Cart ─── */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        {/* Barcode Input */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            background: (theme) =>
              theme.palette.mode === "dark"
                ? "linear-gradient(135deg, #1a1f35 0%, #111827 100%)"
                : "linear-gradient(135deg, #f0f4ff 0%, #ffffff 100%)",
            border: "1px solid",
            borderColor: "primary.main",
            boxShadow: (theme) =>
              theme.palette.mode === "dark"
                ? "0 0 0 1px rgba(99,102,241,0.15), 0 8px 32px rgba(99,102,241,0.08)"
                : "0 0 0 1px rgba(79,70,229,0.12), 0 8px 32px rgba(79,70,229,0.06)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <QrCodeScannerIcon color="primary" sx={{ fontSize: 28 }} />
            <Typography variant="subtitle1" fontWeight={700} color="primary">
              Barkod Okuyucu
            </Typography>
            {isScanning && <CircularProgress size={18} color="primary" />}
          </Box>

          <Box
            component="form"
            onSubmit={handleBarcodeSubmit}
            sx={{ display: "flex", gap: 1.5 }}
          >
            <TextField
              inputRef={barcodeRef}
              fullWidth
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Barkod okutun veya yazın, Enter'a basın..."
              autoComplete="off"
              inputProps={{
                id: "pos-barcode-input",
                style: { fontSize: "1.1rem", letterSpacing: "0.05em", fontFamily: "monospace" },
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  "& fieldset": { borderColor: "primary.main", borderWidth: 2 },
                  "&:hover fieldset": { borderColor: "primary.light" },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              id="pos-barcode-submit"
              disabled={isScanning || !barcodeInput.trim()}
              sx={{ px: 3, borderRadius: 2, minWidth: 60 }}
            >
              <AddIcon />
            </Button>
          </Box>

          <Box sx={{ mt: 1.5, display: "flex", gap: 2, flexWrap: "wrap" }}>
            {[
              { key: "F2", label: "Barkoda Odaklan" },
              { key: "F12", label: "Ödeme Al" },
              { key: "ESC", label: "İptal Et" },
            ].map((shortcut) => (
              <Box key={shortcut.key} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                <Chip
                  icon={<KeyboardIcon sx={{ fontSize: "14px !important" }} />}
                  label={shortcut.key}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ fontSize: "0.7rem", fontFamily: "monospace", fontWeight: 700, height: 22 }}
                />
                <Typography variant="caption" color="text.secondary">{shortcut.label}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        {/* Cart Table */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            borderRadius: 3,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              px: 2.5,
              py: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Badge badgeContent={itemCount} color="primary" max={99}>
                <ShoppingCartIcon color="action" />
              </Badge>
              <Typography variant="subtitle1" fontWeight={700}>
                Sepet
              </Typography>
            </Box>
            {cart.length > 0 && (
              <Chip
                label={`${cart.length} çeşit ürün`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>

          {cart.length === 0 ? (
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                py: 8,
                color: "text.secondary",
              }}
            >
              <ShoppingCartIcon sx={{ fontSize: 64, opacity: 0.2 }} />
              <Typography variant="body1" color="text.secondary">
                Sepet boş — barkod okutarak ürün ekleyin
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ flex: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Ürün</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, width: 120 }}>Miktar</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 110 }}>Birim Fiyat</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 120 }}>Toplam</TableCell>
                    <TableCell align="center" sx={{ width: 48 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.map((item, idx) => (
                    <TableRow
                      key={item.productId}
                      sx={{
                        animation: "fadeSlideIn 0.2s ease",
                        "@keyframes fadeSlideIn": {
                          from: { opacity: 0, transform: "translateY(-6px)" },
                          to: { opacity: 1, transform: "translateY(0)" },
                        },
                        backgroundColor: idx % 2 === 0 ? "transparent" : "action.hover",
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                          {item.barcode}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 0.5,
                          }}
                        >
                          <IconButton
                            size="small"
                            id={`pos-dec-${item.productId}`}
                            onClick={() => { updateQty(item.productId, -1); setTimeout(() => barcodeRef.current?.focus(), 50); }}
                            sx={{ width: 26, height: 26 }}
                          >
                            <RemoveIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ minWidth: 28, textAlign: "center" }}
                          >
                            {item.quantity}
                          </Typography>
                          <IconButton
                            size="small"
                            id={`pos-inc-${item.productId}`}
                            onClick={() => { updateQty(item.productId, 1); setTimeout(() => barcodeRef.current?.focus(), 50); }}
                            sx={{ width: 26, height: 26 }}
                          >
                            <AddIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{fmt(item.unitPrice)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          {fmt(item.lineTotal)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Ürünü Kaldır">
                          <IconButton
                            size="small"
                            id={`pos-remove-${item.productId}`}
                            onClick={() => { removeItem(item.productId); setTimeout(() => barcodeRef.current?.focus(), 50); }}
                            color="error"
                            sx={{ width: 26, height: 26 }}
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* ─── Right Panel: Summary & Payment ─── */}
      <Box
        sx={{
          width: { xs: "100%", lg: 340 },
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {/* Terminal Selector */}
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <PointOfSaleIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>
              Kasa Seçimi
            </Typography>
          </Box>
          <FormControl fullWidth size="small" disabled={terminalsLoading}>
            <InputLabel id="pos-terminal-label">Kasa</InputLabel>
            <Select
              labelId="pos-terminal-label"
              id="pos-terminal-select"
              value={selectedTerminalId}
              label="Kasa"
              onChange={(e) => setSelectedTerminalId(e.target.value)}
            >
              {terminals.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedTerminal && (
            <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
              <Chip
                label="Aktif"
                color="success"
                size="small"
                sx={{ height: 20, fontSize: "0.7rem" }}
              />
              <Typography variant="caption" color="text.secondary">
                {selectedTerminal.code}
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Order Summary */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            flex: 1,
            background: (theme) =>
              theme.palette.mode === "dark"
                ? "linear-gradient(180deg, #111827 0%, #0d1321 100%)"
                : "linear-gradient(180deg, #ffffff 0%, #f8faff 100%)",
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Sipariş Özeti
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Ara Toplam ({itemCount} ürün)
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {fmt(subtotal)}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" color="text.secondary">
                İndirim
              </Typography>
              <Typography variant="body2" fontWeight={600} color="success.main">
                -{fmt(discount)}
              </Typography>
            </Box>

            <Divider sx={{ my: 0.5 }} />

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                p: 1.5,
                borderRadius: 2,
                backgroundColor: "primary.main",
                color: "white",
              }}
            >
              <Typography variant="h6" fontWeight={800} sx={{ color: "white" }}>
                TOPLAM
              </Typography>
              <Typography variant="h5" fontWeight={800} sx={{ color: "white", letterSpacing: "-0.02em" }}>
                {fmt(total)}
              </Typography>
            </Box>
          </Box>

          {/* Last sale info */}
          {lastSale && (
            <Alert
              severity="success"
              icon={<CheckCircleOutlineIcon />}
              sx={{ mt: 2, borderRadius: 2, fontSize: "0.8rem" }}
            >
              <strong>{lastSale.saleNo}</strong> — {fmt(lastSale.netAmount)}
            </Alert>
          )}
        </Paper>

        {/* Payment Buttons */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Button
            id="pos-checkout-btn"
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            startIcon={
              checkoutMutation.isPending ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <CheckCircleOutlineIcon />
              )
            }
            onClick={handleCheckout}
            disabled={cart.length === 0 || !selectedTerminalId || checkoutMutation.isPending}
            sx={{
              py: 2,
              fontSize: "1.05rem",
              fontWeight: 800,
              borderRadius: 3,
              letterSpacing: "0.02em",
              boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
              "&:hover": {
                boxShadow: "0 6px 28px rgba(99,102,241,0.5)",
                transform: "translateY(-1px)",
              },
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {checkoutMutation.isPending ? "İşleniyor..." : "ÖDEME AL  (F12)"}
          </Button>

          <Button
            id="pos-cancel-btn"
            variant="outlined"
            color="error"
            size="large"
            fullWidth
            startIcon={<CancelOutlinedIcon />}
            onClick={handleCancelSale}
            disabled={cart.length === 0 && !lastSale}
            sx={{
              py: 1.5,
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: 3,
              borderWidth: 2,
              "&:hover": { borderWidth: 2 },
            }}
          >
            SATIŞI İPTAL ET  (ESC)
          </Button>
        </Box>
      </Box>

      {/* Snackbar notifications */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => {
          setSnack((s) => ({ ...s, open: false }));
          setTimeout(() => barcodeRef.current?.focus(), 50);
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          variant="filled"
          sx={{ borderRadius: 2, minWidth: 320, fontWeight: 600 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
