import { FormEvent, useState, useRef, useEffect, useMemo, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stack, Typography, Grid, Box, Chip, Paper,
  Button, TextField, MenuItem, Collapse, Alert, Snackbar,
  Autocomplete, InputAdornment, IconButton,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  TablePagination
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { apiClient } from "../api/apiClient";
import {
  CurrentStockDto, StockMovementDto, ProductDto,
  ReferenceDataDto, AddStockMovementRequest, PaginatedListDto
} from "../api/types";
import { DataTable } from "../components/DataTable";
import { useAuth } from "../auth/AuthContext";

const fmt = (amount: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);

// Movement types allowed for manual entry
const MANUAL_MOVEMENT_TYPES = [
  { value: 1, label: "Satın Alma (Stok Girişi)" },
  { value: 3, label: "İade Giriş" },
  { value: 5, label: "Stok Sayımı" },
  { value: 6, label: "Transfer Giriş" },
];

const ALL_MOVEMENT_TYPES = [
  { value: 1, label: "Satın Alma" },
  { value: 2, label: "Satış" },
  { value: 3, label: "İade Giriş" },
  { value: 4, label: "İade Çıkış" },
  { value: 5, label: "Stok Sayımı" },
  { value: 6, label: "Transfer Giriş" },
  { value: 7, label: "Transfer Çıkış" },
];

export function StockMovementsPage() {
  const { user } = useAuth();
  const canManage = user?.role === "Admin" || user?.role === "Manager";
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" }>({
    open: false, message: "", severity: "success"
  });
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  // Current Stock filter states
  const [currentBarcodeVal, setCurrentBarcodeVal] = useState("");
  const [currentNameVal, setCurrentNameVal] = useState("");
  const [currentBarcodeSearch, setCurrentBarcodeSearch] = useState("");
  const [currentNameSearch, setCurrentNameSearch] = useState("");
  const [currentWarehouse, setCurrentWarehouse] = useState("");

  // Movement Ledger filter states
  const [movementBarcodeVal, setMovementBarcodeVal] = useState("");
  const [movementNameVal, setMovementNameVal] = useState("");
  const [movementBarcodeSearch, setMovementBarcodeSearch] = useState("");
  const [movementNameSearch, setMovementNameSearch] = useState("");
  const [movementWarehouse, setMovementWarehouse] = useState("");
  const [movementType, setMovementType] = useState("all");
  const [movementStatus, setMovementStatus] = useState("all");

  // Pagination states for Stock Movements
  const [movementPage, setMovementPage] = useState(0);
  const [movementRowsPerPage, setMovementRowsPerPage] = useState(25);

  // Pagination states for Current Stock
  const [currentPage, setCurrentPage] = useState(0);
  const [currentRowsPerPage, setCurrentRowsPerPage] = useState(25);

  // Reset page when filters change
  useEffect(() => {
    setMovementPage(0);
  }, [movementBarcodeSearch, movementNameSearch, movementWarehouse, movementType, movementStatus]);

  // Reset page when current filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [currentBarcodeSearch, currentNameSearch, currentWarehouse]);

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
    queryKey: ["stock-current", currentPage, currentRowsPerPage, currentBarcodeSearch, currentNameSearch, currentWarehouse],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedListDto<CurrentStockDto>>("/stock/current", {
        params: {
          page: currentPage + 1, // backend is 1-indexed
          pageSize: currentRowsPerPage,
          barcode: currentBarcodeSearch || undefined,
          productName: currentNameSearch || undefined,
          warehouseName: currentWarehouse || undefined
        }
      });
      return response.data;
    }
  });
  const movements = useQuery({
    queryKey: ["stock-movements", movementPage, movementRowsPerPage, movementBarcodeSearch, movementNameSearch, movementWarehouse, movementType, movementStatus],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedListDto<StockMovementDto>>("/stock/movements", {
        params: {
          page: movementPage + 1, // backend is 1-indexed
          pageSize: movementRowsPerPage,
          barcode: movementBarcodeSearch || undefined,
          productName: movementNameSearch || undefined,
          warehouseName: movementWarehouse || undefined,
          type: movementType !== "all" ? movementType : undefined,
          status: movementStatus !== "all" ? movementStatus : undefined
        }
      });
      return response.data;
    }
  });
  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await apiClient.get<ProductDto[]>("/products")).data
  });
  const references = useQuery({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data
  });

  useEffect(() => {
    if (references.data?.warehouses && references.data.warehouses.length > 0 && !form.warehouseId) {
      setForm(f => ({
        ...f,
        warehouseId: references.data.warehouses[0].id
      }));
    }
  }, [references.data, form.warehouseId]);

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

  const cancelMovement = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/stock/movements/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-current"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      setSnack({ open: true, message: "Stok hareketi başarıyla iptal edildi.", severity: "success" });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "İptal işlemi sırasında bir hata oluştu.";
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

  const renderCell = (content: ReactNode, isCancelled: boolean, isPrimary: boolean = false) => {
    if (isCancelled) {
      return (
        <Typography
          variant="body2"
          sx={{
            textDecoration: "line-through",
            color: "text.secondary",
            fontWeight: isPrimary ? 700 : 400
          }}
        >
          {content}
        </Typography>
      );
    }
    return content;
  };

  const formatQuantity = (type: number, quantity: number, isCancelled: boolean) => {
    const isInward = [1, 3, 6].includes(type);
    const isOutward = [2, 4, 7].includes(type);
    const color = isCancelled
      ? "text.secondary"
      : isInward
        ? "success.main"
        : isOutward
          ? "error.main"
          : "text.primary";
    const prefix = isInward ? "+" : isOutward ? "-" : "";
    return (
      <Typography
        color={color}
        variant="body2"
        fontWeight={750}
        sx={{ textDecoration: isCancelled ? "line-through" : "none" }}
      >
        {prefix}{quantity.toFixed(2)}
      </Typography>
    );
  };

  const selectedProduct = products.data?.find(p => p.id === form.productId);

  // Current stock level items from the paginated API response
  const filteredCurrent = useMemo(() => {
    return current.data?.items ?? [];
  }, [current.data]);

  const handleClearCurrentFilters = () => {
    setCurrentBarcodeVal("");
    setCurrentNameVal("");
    setCurrentBarcodeSearch("");
    setCurrentNameSearch("");
    setCurrentWarehouse("");
  };

  const handleClearMovementFilters = () => {
    setMovementBarcodeVal("");
    setMovementNameVal("");
    setMovementBarcodeSearch("");
    setMovementNameSearch("");
    setMovementWarehouse("");
    setMovementType("all");
    setMovementStatus("all");
  };

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
          {canManage && (
            <Button
              variant="contained"
              color="primary"
              startIcon={isFormOpen ? <CloseIcon /> : <AddIcon />}
              onClick={() => setIsFormOpen(o => !o)}
            >
              {isFormOpen ? "Vazgeç" : "Stok Hareketi Ekle"}
            </Button>
          )}
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

        {/* Current Stock Filters */}
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Barcode Search */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Barkod Ara"
                placeholder="Barkod yazıp Enter'a basın…"
                value={currentBarcodeVal}
                onChange={e => setCurrentBarcodeVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setCurrentBarcodeSearch(currentBarcodeVal);
                  }
                }}
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <QrCodeScannerIcon fontSize="small" sx={{ color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                  endAdornment: currentBarcodeVal ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => {
                        setCurrentBarcodeVal("");
                        setCurrentBarcodeSearch("");
                      }}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>
            {/* Product Name Search */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Ürün İsmi"
                placeholder="Ürün ismi yazıp Enter'a basın…"
                value={currentNameVal}
                onChange={e => setCurrentNameVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setCurrentNameSearch(currentNameVal);
                  }
                }}
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                  endAdornment: currentNameVal ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => {
                        setCurrentNameVal("");
                        setCurrentNameSearch("");
                      }}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>
            {/* Warehouse Select */}
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                select
                label="Depo"
                value={currentWarehouse}
                onChange={e => setCurrentWarehouse(e.target.value)}
                size="small"
                fullWidth
              >
                <MenuItem value=""><em>Tüm Depolar</em></MenuItem>
                {(references.data?.warehouses ?? []).map(w => (
                  <MenuItem key={w.id} value={w.name}>{w.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            {/* Clear Button */}
            <Grid item xs={12} sm={6} md={1.5} sx={{ display: "flex", justifyContent: "flex-end" }}>
              {(currentBarcodeVal || currentNameVal || currentWarehouse) && (
                <Button 
                  variant="text" 
                  size="small" 
                  startIcon={<ClearIcon />} 
                  onClick={handleClearCurrentFilters}
                  sx={{ textTransform: "none" }}
                >
                  Temizle
                </Button>
              )}
            </Grid>
          </Grid>
        </Paper>

        <DataTable
          columns={["Barkod", "Ürün Kodu", "Ürün Adı", "Depo Adı", "Mevcut Miktar"]}
          rows={filteredCurrent.map(s => [
            s.productBarcode || <span style={{ opacity: 0.5 }}>—</span>,
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

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={current.data?.totalCount ?? 0}
          rowsPerPage={currentRowsPerPage}
          page={currentPage}
          onPageChange={(_, newPage) => setCurrentPage(newPage)}
          onRowsPerPageChange={(e) => {
            setCurrentRowsPerPage(parseInt(e.target.value, 10));
            setCurrentPage(0);
          }}
          labelRowsPerPage="Sayfa başına satır:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
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

        {/* Ledger Filters */}
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Barcode Search */}
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                label="Barkod Ara"
                placeholder="Barkod yazıp Enter'a basın…"
                value={movementBarcodeVal}
                onChange={e => setMovementBarcodeVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setMovementBarcodeSearch(movementBarcodeVal);
                  }
                }}
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <QrCodeScannerIcon fontSize="small" sx={{ color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                  endAdornment: movementBarcodeVal ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => {
                        setMovementBarcodeVal("");
                        setMovementBarcodeSearch("");
                      }}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>
            {/* Product Name Search */}
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                label="Ürün İsmi"
                placeholder="Ürün ismi yazıp Enter'a basın…"
                value={movementNameVal}
                onChange={e => setMovementNameVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setMovementNameSearch(movementNameVal);
                  }
                }}
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                  endAdornment: movementNameVal ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => {
                        setMovementNameVal("");
                        setMovementNameSearch("");
                      }}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                label="Depo"
                value={movementWarehouse}
                onChange={e => setMovementWarehouse(e.target.value)}
                size="small"
                fullWidth
              >
                <MenuItem value=""><em>Tüm Depolar</em></MenuItem>
                {(references.data?.warehouses ?? []).map(w => (
                  <MenuItem key={w.id} value={w.name}>{w.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                label="Hareket Tipi"
                value={movementType}
                onChange={e => setMovementType(e.target.value)}
                size="small"
                fullWidth
              >
                <MenuItem value="all">Tümü (Tip)</MenuItem>
                {ALL_MOVEMENT_TYPES.map(t => (
                  <MenuItem key={t.value} value={String(t.value)}>{t.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                label="Durum"
                value={movementStatus}
                onChange={e => setMovementStatus(e.target.value)}
                size="small"
                fullWidth
              >
                <MenuItem value="all">Tümü (Durum)</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="cancelled">İptal Edilmiş</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={12} md={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
              {(movementBarcodeVal || movementNameVal || movementWarehouse || movementType !== "all" || movementStatus !== "all") && (
                <Button 
                  variant="text" 
                  size="small" 
                  startIcon={<ClearIcon />} 
                  onClick={handleClearMovementFilters}
                  sx={{ textTransform: "none" }}
                >
                  Temizle
                </Button>
              )}
            </Grid>
          </Grid>
        </Paper>

        <DataTable
          columns={canManage ? ["Barkod", "Ürün Kodu", "Ürün Adı", "Depo", "Hareket Tipi", "Miktar", "Birim Fiyat", "Referans", "Tarih", "İşlemler"] : ["Barkod", "Ürün Kodu", "Ürün Adı", "Depo", "Hareket Tipi", "Miktar", "Birim Fiyat", "Referans", "Tarih"]}
          rows={(movements.data?.items ?? []).map(m => {
            const isManual = m.referenceType === "MANUAL";
            const row = [
              renderCell(m.productBarcode || <span style={{ opacity: 0.5 }}>—</span>, m.isCancelled),
              renderCell(<Typography variant="body2" fontWeight={700} color="primary.main">{m.productCode}</Typography>, m.isCancelled, true),
              renderCell(m.productName, m.isCancelled),
              renderCell(m.warehouseName, m.isCancelled),
              m.isCancelled ? (
                <Chip label="İptal Edildi" color="default" size="small" sx={{ fontWeight: 600, minWidth: 110, textDecoration: "line-through" }} />
              ) : (
                getMovementTypeBadge(m.type)
              ),
              formatQuantity(m.type, m.quantity, m.isCancelled),
              renderCell(fmt(m.unitPrice), m.isCancelled),
              m.isCancelled ? (
                <Chip label="İptal" size="small" variant="outlined" color="error" sx={{ fontSize: "0.7rem" }} />
              ) : m.referenceType ? (
                <Chip label={m.referenceType} size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
              ) : (
                <span style={{ opacity: 0.5 }}>—</span>
              ),
              renderCell(new Date(m.createdAt).toLocaleString("tr-TR"), m.isCancelled)
            ];
            if (canManage) {
              row.push(
                !m.isCancelled && isManual ? (
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    onClick={() => setCancelTargetId(m.id)}
                    disabled={cancelMovement.isPending}
                  >
                    İptal Et
                  </Button>
                ) : ("")
              );
            }
            return row;
          })}
        />

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={movements.data?.totalCount ?? 0}
          rowsPerPage={movementRowsPerPage}
          page={movementPage}
          onPageChange={(_, newPage) => setMovementPage(newPage)}
          onRowsPerPageChange={(e) => {
            setMovementRowsPerPage(parseInt(e.target.value, 10));
            setMovementPage(0);
          }}
          labelRowsPerPage="Sayfa başına satır:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
        />
      </Box>

      {/* Cancellation Confirmation Dialog */}
      <Dialog
        open={Boolean(cancelTargetId)}
        onClose={() => setCancelTargetId(null)}
      >
        <DialogTitle fontWeight={700}>Stok Hareketini İptal Et</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Bu stok hareketini iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz ve depo stok seviyesi buna göre güncellenecektir.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCancelTargetId(null)} variant="outlined">
            Vazgeç
          </Button>
          <Button
            onClick={() => {
              if (cancelTargetId) {
                cancelMovement.mutate(cancelTargetId);
                setCancelTargetId(null);
              }
            }}
            color="error"
            variant="contained"
            disabled={cancelMovement.isPending}
            autoFocus
          >
            {cancelMovement.isPending ? "İptal Ediliyor..." : "Hareketi İptal Et"}
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
