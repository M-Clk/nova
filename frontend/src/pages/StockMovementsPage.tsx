import { FormEvent, useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stack, Typography, Grid, Box, Chip, Paper,
  Button, TextField, MenuItem, Collapse, Alert, Snackbar,
  Autocomplete, InputAdornment, IconButton
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import ClearIcon from "@mui/icons-material/Clear";
import { apiClient } from "../api/apiClient";
import {
  CurrentStockDto, StockMovementDto, ProductDto,
  ReferenceDataDto, AddStockMovementRequest
} from "../api/types";
import { DataTable } from "../components/DataTable";

const fmt = (amount: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);

// Movement types allowed for manual entry
const MANUAL_MOVEMENT_TYPES = [
  { value: 1, label: "Satın Alma (Stok Girişi)" },
  { value: 3, label: "İade Giriş" },
  { value: 5, label: "Stok Sayımı" },
  { value: 6, label: "Transfer Giriş" },
];

export function StockMovementsPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" }>({
    open: false, message: "", severity: "success"
  });

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        // Automatically open the form if it's closed, then focus
        setIsFormOpen(true);
        // We wait a tiny bit for the Collapse animation or element render to complete if it's opening
        setTimeout(() => {
          barcodeInputRef.current?.focus();
        }, 100);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const [form, setForm] = useState<AddStockMovementRequest>({
    productId: "",
    warehouseId: "",
    type: 1,
    quantity: 1,
    unitPrice: 0,
  });

  const current = useQuery({
    queryKey: ["stock-current"],
    queryFn: async () => (await apiClient.get<CurrentStockDto[]>("/stock/current")).data
  });
  const movements = useQuery({
    queryKey: ["stock-movements"],
    queryFn: async () => (await apiClient.get<StockMovementDto[]>("/stock/movements")).data
  });
  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await apiClient.get<ProductDto[]>("/products")).data
  });
  const references = useQuery({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data
  });

  const addMovement = useMutation({
    mutationFn: async () => apiClient.post<StockMovementDto>("/stock/movements", form),
    onSuccess: () => {
      setForm({ productId: "", warehouseId: "", type: 1, quantity: 1, unitPrice: 0 });
      setBarcodeSearch("");
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["stock-current"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      setSnack({ open: true, message: "Stok hareketi başarıyla kaydedildi.", severity: "success" });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Kayıt sırasında bir hata oluştu.";
      setSnack({ open: true, message: msg, severity: "error" });
    }
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    addMovement.mutate();
  }

  // Auto-fill unit price when product changes
  const handleProductChange = (productId: string) => {
    const product = products.data?.find(p => p.id === productId);
    setForm(f => ({
      ...f,
      productId,
      unitPrice: product?.purchasePrice ?? 0,
    }));
  };

  // Scan product by barcode
  const handleBarcodeScan = async (barcode: string) => {
    const code = barcode.trim();
    if (!code) return;

    try {
      // Find locally first to avoid network request if already loaded
      const localProduct = products.data?.find(p => p.barcode === code);
      if (localProduct) {
        setForm(f => ({
          ...f,
          productId: localProduct.id,
          unitPrice: localProduct.purchasePrice ?? 0,
        }));
        setBarcodeSearch("");
        setSnack({ open: true, message: `Ürün bulundu: ${localProduct.name}`, severity: "success" });
        return;
      }

      // Fallback to API if not in local list yet
      const { data: posProd } = await apiClient.get<{ id: string; name: string }>(`/products/barcode/${encodeURIComponent(code)}`);
      if (posProd) {
        const { data: fullProduct } = await apiClient.get<ProductDto>(`/products/${posProd.id}`);
        if (fullProduct) {
          // Refetch products list to keep in sync
          queryClient.invalidateQueries({ queryKey: ["products"] });
          setForm(f => ({
            ...f,
            productId: fullProduct.id,
            unitPrice: fullProduct.purchasePrice ?? 0,
          }));
          setBarcodeSearch("");
          setSnack({ open: true, message: `Ürün bulundu: ${fullProduct.name}`, severity: "success" });
        }
      } else {
        setSnack({ open: true, message: `Barkod bulunamadı: ${code}`, severity: "warning" });
      }
    } catch {
      setSnack({ open: true, message: `Barkod bulunamadı veya hata oluştu: ${code}`, severity: "warning" });
    }
  };

  const getMovementTypeBadge = (type: number) => {
    switch (type) {
      case 1: return <Chip label="Satın Alma" color="success" size="small" sx={{ fontWeight: 600, minWidth: 110 }} />;
      case 2: return <Chip label="Satış" color="error" size="small" sx={{ fontWeight: 600, minWidth: 110 }} />;
      case 3: return <Chip label="İade Giriş" color="success" size="small" variant="outlined" sx={{ fontWeight: 600, minWidth: 110 }} />;
      case 4: return <Chip label="İade Çıkış" color="error" size="small" variant="outlined" sx={{ fontWeight: 600, minWidth: 110 }} />;
      case 5: return <Chip label="Stok Sayımı" color="info" size="small" variant="outlined" sx={{ fontWeight: 600, minWidth: 110 }} />;
      case 6: return <Chip label="Transfer Giriş" color="success" size="small" variant="outlined" sx={{ fontWeight: 600, minWidth: 110, borderStyle: "dashed" }} />;
      case 7: return <Chip label="Transfer Çıkış" color="error" size="small" variant="outlined" sx={{ fontWeight: 600, minWidth: 110, borderStyle: "dashed" }} />;
      default: return <Chip label={`Tip ${type}`} size="small" sx={{ minWidth: 110 }} />;
    }
  };

  const formatQuantity = (type: number, quantity: number) => {
    const isInward = [1, 3, 6].includes(type);
    const isOutward = [2, 4, 7].includes(type);
    if (isInward) return <Typography color="success.main" variant="body2" fontWeight={750}>+{quantity.toFixed(2)}</Typography>;
    if (isOutward) return <Typography color="error.main" variant="body2" fontWeight={750}>-{quantity.toFixed(2)}</Typography>;
    return <Typography variant="body2" fontWeight={600}>{quantity.toFixed(2)}</Typography>;
  };

  const selectedProduct = products.data?.find(p => p.id === form.productId);

  return (
    <Stack spacing={4}>
      {/* ── Current Stock ── */}
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Güncel Stok Seviyeleri</Typography>
            <Typography color="text.secondary" variant="body2">
              Depolarınızdaki anlık stok miktarları
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={isFormOpen ? <CloseIcon /> : <AddIcon />}
            onClick={() => setIsFormOpen(o => !o)}
          >
            {isFormOpen ? "Vazgeç" : "Stok Hareketi Ekle"}
          </Button>
        </Box>

        {/* Stock Entry Form */}
        <Collapse in={isFormOpen}>
          <Paper component="form" onSubmit={submit} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
              <WarehouseIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={700}>
                Yeni Stok Hareketi
              </Typography>
              <Chip
                label="Yalnızca giriş tipleri"
                size="small"
                color="info"
                variant="outlined"
                sx={{ ml: 1, fontSize: "0.7rem" }}
              />
            </Box>

            <Grid container spacing={2.5}>
              {/* Barcode Scan Field */}
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  inputRef={barcodeInputRef}
                  label="Barkod Okutun"
                  placeholder="Barkod okutup Enter'a basın..."
                  value={barcodeSearch}
                  onChange={e => setBarcodeSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBarcodeScan(barcodeSearch);
                    }
                  }}
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <QrCodeScannerIcon color="primary" fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: barcodeSearch ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setBarcodeSearch("")}>
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />
              </Grid>

              {/* Product Search (Autocomplete) */}
              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  options={products.data ?? []}
                  getOptionLabel={(option) => `${option.code} — ${option.name} (${option.barcode})`}
                  filterOptions={(options, state) => {
                    const search = state.inputValue.toLowerCase().trim();
                    if (!search) return options.slice(0, 50);
                    return options
                      .filter(
                        (o) =>
                          o.name.toLowerCase().includes(search) ||
                          o.code.toLowerCase().includes(search) ||
                          o.barcode.toLowerCase().includes(search)
                      )
                      .slice(0, 50); // Limit to 50 options to prevent lag
                  }}
                  value={selectedProduct || null}
                  onChange={(_, newValue) => {
                    if (newValue) {
                      handleProductChange(newValue.id);
                    } else {
                      setForm(f => ({ ...f, productId: "", unitPrice: 0 }));
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Ürün Seç / Ara"
                      placeholder="Ürün adı veya kod yazın..."
                      size="small"
                      required
                    />
                  )}
                  noOptionsText="Ürün bulunamadı"
                />
              </Grid>

              {/* Warehouse */}
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  select
                  label="Depo"
                  value={form.warehouseId}
                  onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))}
                  required
                  fullWidth
                  size="small"
                >
                  {(references.data?.warehouses ?? []).map(w => (
                    <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* Movement Type */}
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  select
                  label="Hareket Tipi"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: Number(e.target.value) }))}
                  required
                  fullWidth
                  size="small"
                >
                  {MANUAL_MOVEMENT_TYPES.map(t => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* Quantity */}
              <Grid item xs={12} sm={3} md={4}>
                <TextField
                  label="Miktar"
                  type="number"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: Math.max(0.01, Number(e.target.value)) }))}
                  required
                  fullWidth
                  size="small"
                  inputProps={{ min: 0.01, step: 0.01 }}
                />
              </Grid>

              {/* Unit Price */}
              <Grid item xs={12} sm={3} md={4}>
                <TextField
                  label="Birim Fiyat (₺)"
                  type="number"
                  value={form.unitPrice}
                  onChange={e => setForm(f => ({ ...f, unitPrice: Math.max(0, Number(e.target.value)) }))}
                  fullWidth
                  size="small"
                  inputProps={{ min: 0, step: 0.01 }}
                  helperText={selectedProduct ? `Alış: ₺${selectedProduct.purchasePrice.toFixed(2)}` : ""}
                />
              </Grid>
            </Grid>

            {/* Preview */}
            {form.productId && form.warehouseId && (
              <Box
                sx={{
                  mt: 2.5, p: 2, borderRadius: 1.5,
                  bgcolor: "action.hover",
                  border: "1px dashed", borderColor: "divider",
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", flexWrap: "wrap", gap: 2
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Ürün: <strong>{selectedProduct?.name}</strong> &nbsp;|&nbsp;
                  Tip: <strong>{MANUAL_MOVEMENT_TYPES.find(t => t.value === form.type)?.label}</strong> &nbsp;|&nbsp;
                  Miktar: <strong>{form.quantity}</strong>
                </Typography>
                <Typography variant="h6" fontWeight={800} color="success.main">
                  Toplam: {fmt(form.quantity * form.unitPrice)}
                </Typography>
              </Box>
            )}

            <Box sx={{ mt: 2.5, display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button variant="outlined" onClick={() => setIsFormOpen(false)}>
                Vazgeç
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="success"
                disabled={addMovement.isPending || !form.productId || !form.warehouseId}
                startIcon={<AddIcon />}
              >
                {addMovement.isPending ? "Kaydediliyor..." : "Stok Hareketi Kaydet"}
              </Button>
            </Box>
          </Paper>
        </Collapse>

        <DataTable
          columns={["Ürün Kodu", "Ürün Adı", "Depo Adı", "Mevcut Miktar"]}
          rows={(current.data ?? []).map(s => [
            <Typography variant="body2" fontWeight={700} color="primary.main">{s.productCode}</Typography>,
            s.productName,
            s.warehouseName,
            <Typography
              variant="body2"
              fontWeight={700}
              color={s.quantity <= 0 ? "error.main" : "text.primary"}
            >
              {s.quantity.toFixed(2)}
            </Typography>
          ])}
        />
      </Box>

      {/* ── Stock Movements Ledger ── */}
      <Box>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>
          Stok Hareket Defteri
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 2.5 }}>
          Tüm stok işlemlerinin geçmiş kaydı
        </Typography>
        <DataTable
          columns={["Ürün Kodu", "Ürün Adı", "Depo", "Hareket Tipi", "Miktar", "Birim Fiyat", "Referans", "Tarih"]}
          rows={(movements.data ?? []).map(m => [
            <Typography variant="body2" fontWeight={700} color="primary.main">{m.productCode}</Typography>,
            m.productName,
            m.warehouseName,
            getMovementTypeBadge(m.type),
            formatQuantity(m.type, m.quantity),
            fmt(m.unitPrice),
            m.referenceType
              ? <Chip label={m.referenceType} size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
              : <span style={{ opacity: 0.5 }}>—</span>,
            new Date(m.createdAt).toLocaleString("tr-TR")
          ])}
        />
      </Box>

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
