import { FormEvent, useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Button, 
  MenuItem, 
  Paper, 
  Stack, 
  TextField, 
  Typography, 
  Grid,
  Box,
  Collapse,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  InputAdornment,
  Tooltip,
  TablePagination,
  Checkbox,
  Tab,
  Tabs,
  Divider,
  CircularProgress,
  Drawer,
  Stepper,
  Step,
  StepLabel,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import UndoIcon from "@mui/icons-material/Undo";
import HistoryIcon from "@mui/icons-material/History";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ReplayIcon from "@mui/icons-material/Replay";
import { DataTable } from "../components/DataTable";
import { apiClient } from "../api/apiClient";
import { 
  ProductDto, 
  ReferenceDataDto, 
  PaginatedListDto,
  BulkPriceUpdateItem,
  BulkPriceUpdateResult,
  PriceHistoryDto,
  ImportPriceResult
} from "../api/types";
import { useAuth } from "../auth/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductPriceRow = {
  productId: string;
  productName: string;
  productCode: string;
  currentPurchasePrice: number;
  currentSalePrice: number;
  newPurchasePrice: string;
  newSalePrice: string;
};

// Geçmiş drawer'ında batch bazında gruplama
type HistoryBatch = {
  batchId: string;
  changedBy: string;
  createdAt: string;
  items: PriceHistoryDto[];
  isReverted: boolean; // batch'teki tüm kayıtlar reverted mi
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const { user } = useAuth();
  const canManage = user?.role === "Admin" || user?.role === "Manager";
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Search & filter
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Checkbox seçim
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Inline bulk price dialog
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkTab, setBulkTab] = useState(0);
  const [priceRows, setPriceRows] = useState<ProductPriceRow[]>([]);
  const [rateType, setRateType] = useState<"increase" | "decrease">("increase");
  const [rateField, setRateField] = useState<"both" | "purchasePrice" | "salePrice">("salePrice");
  const [rateValue, setRateValue] = useState("10");

  // CSV Import dialog (stepper)
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState(0); // 0=şablon, 1=yükle, 2=sonuç
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportPriceResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fiyat Geçmişi Drawer
  const [historyOpen, setHistoryOpen] = useState(false);

  // Undo snackbar
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ProductDto | null>(null);

  // Snackbar
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" }>({
    open: false, message: "", severity: "success"
  });

  const [isExporting, setIsExporting] = useState(false);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [search, filterBrand, filterCategory, filterStatus]);

  // F2 shortcut
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        if (!isFormOpen) setIsFormOpen(true);
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFormOpen]);

  // Undo cleanup
  useEffect(() => {
    return () => { if (undoTimerRef.current) clearInterval(undoTimerRef.current); };
  }, []);

  const startUndoCountdown = (batchId: string) => {
    setLastBatchId(batchId);
    setUndoCountdown(30);
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    undoTimerRef.current = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev <= 1) { clearInterval(undoTimerRef.current!); setLastBatchId(null); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ─── Queries ────────────────────────────────────────────────────────────────

  const references = useQuery({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data
  });

  const products = useQuery({
    queryKey: ["products", page, rowsPerPage, search, filterBrand, filterCategory, filterStatus],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedListDto<ProductDto>>("/products", {
        params: {
          page: page + 1,
          pageSize: rowsPerPage,
          search: search || undefined,
          brandId: filterBrand || undefined,
          categoryId: filterCategory || undefined,
          isActive: filterStatus === "all" ? undefined : filterStatus === "active"
        }
      });
      return response.data;
    }
  });

  const priceHistory = useQuery({
    queryKey: ["price-history"],
    queryFn: async () => (await apiClient.get<PriceHistoryDto[]>("/products/price-history?limit=100")).data,
    enabled: historyOpen  // sadece drawer açıkken fetch et
  });

  // Geçmiş verisini batch bazında grupla
  const historyBatches: HistoryBatch[] = (() => {
    if (!priceHistory.data) return [];
    const map = new Map<string, HistoryBatch>();
    for (const item of priceHistory.data) {
      if (!map.has(item.batchId)) {
        map.set(item.batchId, {
          batchId: item.batchId,
          changedBy: item.changedBy.replace(/ \(geri alma.*?\)/, ""), // temizle
          createdAt: item.createdAt,
          items: [],
          isReverted: false
        });
      }
      map.get(item.batchId)!.items.push(item);
    }
    // İsReverted: batch'teki tüm kayıtlar revert edilmişse
    for (const batch of map.values()) {
      batch.isReverted = batch.items.every(i => i.isReverted);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  })();

  // ─── Form state ─────────────────────────────────────────────────────────────

  const [form, setForm] = useState({
    code: "", barcode: "", name: "",
    brandId: "", categoryId: "", unitId: "",
    purchasePrice: 0, salePrice: 0, minStock: 0, isActive: true
  });

  useEffect(() => {
    if (references.data && !editingProductId) {
      setForm(prev => ({
        ...prev,
        brandId: prev.brandId || references.data.brands[0]?.id || "",
        categoryId: prev.categoryId || references.data.categories[0]?.id || "",
        unitId: prev.unitId || references.data.units[0]?.id || ""
      }));
    }
  }, [references.data, editingProductId]);

  // ─── Export ──────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await apiClient.get("/products/export", {
        params: {
          search: search || undefined,
          brandId: filterBrand || undefined,
          categoryId: filterCategory || undefined,
          isActive: filterStatus === "all" ? undefined : filterStatus === "active",
          format: "csv"
        },
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const contentDisposition = response.headers["content-disposition"];
      // RFC 6266: önce filename*= (RFC5987) varsa al, yoksa filename="..." al
      const filenameStarMatch = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i);
      const filenameMatch     = contentDisposition?.match(/filename="([^"]+)"/i);
      const filename =
        (filenameStarMatch ? decodeURIComponent(filenameStarMatch[1]) : null) ??
        filenameMatch?.[1] ??
        `urunler_${new Date().toISOString().split("T")[0]}.csv`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSnack({ open: true, message: "Ürünler başarıyla indirildi.", severity: "success" });
    } catch {
      setSnack({ open: true, message: "Ürünler indirilirken hata oluştu.", severity: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Form CRUD Mutations ─────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({
      code: "", barcode: "",
      name: "",
      brandId: references.data?.brands[0]?.id ?? "",
      categoryId: references.data?.categories[0]?.id ?? "",
      unitId: references.data?.units[0]?.id ?? "",
      purchasePrice: 0, salePrice: 0, minStock: 0, isActive: true
    });
    setEditingProductId(null);
    setIsFormOpen(false);
  };

  const create = useMutation({
    mutationFn: () => apiClient.post("/products", {
      code: form.code, barcode: form.barcode, name: form.name,
      brandId: form.brandId, categoryId: form.categoryId, unitId: form.unitId,
      purchasePrice: form.purchasePrice, salePrice: form.salePrice, minStock: form.minStock
    }),
    onSuccess: () => { resetForm(); queryClient.invalidateQueries({ queryKey: ["products"] }); setSnack({ open: true, message: "Ürün başarıyla oluşturuldu.", severity: "success" }); },
    onError: (err: any) => setSnack({ open: true, message: err?.response?.data?.error || "Ürün eklenirken hata oluştu.", severity: "error" })
  });

  const update = useMutation({
    mutationFn: (id: string) => apiClient.put(`/products/${id}`, form),
    onSuccess: () => { resetForm(); queryClient.invalidateQueries({ queryKey: ["products"] }); setSnack({ open: true, message: "Ürün başarıyla güncellendi.", severity: "success" }); },
    onError: (err: any) => setSnack({ open: true, message: err?.response?.data?.error || "Ürün güncellenirken hata oluştu.", severity: "error" })
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/products/${id}`),
    onSuccess: () => { setDeleteTarget(null); queryClient.invalidateQueries({ queryKey: ["products"] }); setSnack({ open: true, message: "Ürün başarıyla silindi.", severity: "success" }); },
    onError: (err: any) => setSnack({ open: true, message: err?.response?.data?.error || "Ürün silinirken bir hata oluştu.", severity: "error" })
  });

  // ─── Bulk Price Mutation ─────────────────────────────────────────────────────

  const bulkPriceUpdate = useMutation({
    mutationFn: async (items: BulkPriceUpdateItem[]) =>
      (await apiClient.post<BulkPriceUpdateResult>("/products/bulk-price-update", { items })).data,
    onSuccess: (result) => {
      setBulkPriceOpen(false);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["price-history"] });
      const msg = result.failedCount > 0
        ? `${result.updatedCount} ürün güncellendi, ${result.failedCount} bulunamadı.`
        : `${result.updatedCount} ürünün fiyatı başarıyla güncellendi.`;
      setSnack({ open: true, message: msg, severity: result.failedCount > 0 ? "warning" : "success" });
      startUndoCountdown(result.batchId);
    },
    onError: (err: any) => setSnack({ open: true, message: err?.response?.data?.error || "Fiyat güncellenirken hata oluştu.", severity: "error" })
  });

  // ─── Revert Mutation ─────────────────────────────────────────────────────────

  const revertBulkUpdate = useMutation({
    mutationFn: async (batchId: string) => { await apiClient.delete(`/products/bulk-price-update/${batchId}`); },
    onSuccess: () => {
      setLastBatchId(null);
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["price-history"] });
      setSnack({ open: true, message: "Fiyat güncellemesi geri alındı.", severity: "success" });
    },
    onError: (err: any) => setSnack({ open: true, message: err?.response?.data?.error || "Geri alma işlemi başarısız oldu.", severity: "error" })
  });

  // ─── CSV Import Mutation ──────────────────────────────────────────────────────

  const importPrices = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post<ImportPriceResult>("/products/import-prices", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return res.data;
    },
    onSuccess: (result) => {
      setImportStep(2);
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["price-history"] });
      if (result.batchId) startUndoCountdown(result.batchId);
    },
    onError: (err: any) => {
      setSnack({ open: true, message: err?.response?.data?.error || "İçe aktarma sırasında hata oluştu.", severity: "error" });
    }
  });

  // ─── Checkbox yönetimi ───────────────────────────────────────────────────────

  const currentPageItems = products.data?.items ?? [];
  const currentPageIds = currentPageItems.map(p => p.id);
  const allPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));
  const somePageSelected = currentPageIds.some(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) currentPageIds.forEach(id => next.delete(id));
      else currentPageIds.forEach(id => next.add(id));
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Inline bulk price dialog ────────────────────────────────────────────────

  const openBulkPriceDialog = () => {
    const sel = currentPageItems.filter(p => selectedIds.has(p.id));
    setPriceRows(sel.map(p => ({
      productId: p.id, productName: p.name, productCode: p.code,
      currentPurchasePrice: p.purchasePrice, currentSalePrice: p.salePrice,
      newPurchasePrice: p.purchasePrice.toFixed(2), newSalePrice: p.salePrice.toFixed(2)
    })));
    setBulkTab(0); setRateType("increase"); setRateField("salePrice"); setRateValue("10");
    setBulkPriceOpen(true);
  };

  const applyRate = () => {
    const rate = parseFloat(rateValue);
    if (isNaN(rate) || rate <= 0) return;
    const multiplier = rateType === "increase" ? 1 + rate / 100 : 1 - rate / 100;
    setPriceRows(prev => prev.map(row => ({
      ...row,
      newPurchasePrice: (rateField === "both" || rateField === "purchasePrice")
        ? (row.currentPurchasePrice * multiplier).toFixed(2) : row.newPurchasePrice,
      newSalePrice: (rateField === "both" || rateField === "salePrice")
        ? (row.currentSalePrice * multiplier).toFixed(2) : row.newSalePrice
    })));
    setBulkTab(0);
  };

  const submitBulkPrice = () => {
    const items: BulkPriceUpdateItem[] = priceRows.map(row => {
      const newP = parseFloat(row.newPurchasePrice);
      const newS = parseFloat(row.newSalePrice);
      return {
        productId: row.productId,
        purchasePrice: (!isNaN(newP) && newP !== row.currentPurchasePrice) ? newP : null,
        salePrice: (!isNaN(newS) && newS !== row.currentSalePrice) ? newS : null
      };
    }).filter(item => item.purchasePrice !== null || item.salePrice !== null);
    if (items.length === 0) { setSnack({ open: true, message: "Hiçbir fiyat değiştirilmedi.", severity: "warning" }); return; }
    bulkPriceUpdate.mutate(items);
  };

  // ─── CSV Import dialog helpers ────────────────────────────────────────────────

  const openImportDialog = () => {
    setImportStep(0);
    setImportFile(null);
    setImportResult(null);
    setImportOpen(true);
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) setImportFile(f);
    else setSnack({ open: true, message: "Lütfen CSV dosyası seçin.", severity: "warning" });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setImportFile(f);
  };

  const handleImportSubmit = () => {
    if (!importFile) return;
    importPrices.mutate(importFile);
  };

  // Mevcut filtrelerle şablon CSV indir (aynı export endpoint'i)
  const downloadTemplate = async () => {
    setIsExporting(true);
    try {
      const response = await apiClient.get("/products/export", {
        params: {
          search: search || undefined,
          brandId: filterBrand || undefined,
          categoryId: filterCategory || undefined,
          isActive: filterStatus === "all" ? undefined : filterStatus === "active",
          format: "csv"
        },
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `fiyat_guncelleme_sablonu_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setSnack({ open: true, message: "Şablon indirilemedi.", severity: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Diğer helpers ───────────────────────────────────────────────────────────

  function startEdit(product: ProductDto) {
    setEditingProductId(product.id);
    setForm({
      code: product.code, barcode: product.barcode || "", name: product.name,
      brandId: product.brandId, categoryId: product.categoryId, unitId: product.unitId,
      purchasePrice: product.purchasePrice, salePrice: product.salePrice,
      minStock: product.minStock, isActive: product.isActive
    });
    setIsFormOpen(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (editingProductId) update.mutate(editingProductId);
    else create.mutate();
  }

  const isPending = create.isPending || update.isPending;

  const handleClearFilters = () => {
    setSearch(""); setFilterBrand(""); setFilterCategory(""); setFilterStatus("all");
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const baseColumns = ["", "Kod", "Barkod", "Ürün Adı", "Marka", "Kategori", "Birim", "Alış", "Satış", "Durum"];
  const columns = canManage ? [...baseColumns, "İşlemler"] : baseColumns;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Stack spacing={3}>

      {/* ── Header Row ── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Ürünler</Typography>
          <Typography color="text.secondary" variant="body2">Stok kalemlerinizi ve fiyatlarınızı yönetin</Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">

          {/* Inline seçim güncelleme */}
          {canManage && selectedIds.size > 0 && (
            <Button variant="contained" color="warning" startIcon={<PriceChangeOutlinedIcon />}
              onClick={openBulkPriceDialog}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700, px: 2.5, py: 1.1 }}>
              Fiyat Güncelle ({selectedIds.size})
            </Button>
          )}

          {/* Fiyat Geçmişi */}
          {canManage && (
            <Tooltip title="Fiyat Değişiklik Geçmişi">
              <IconButton onClick={() => setHistoryOpen(true)}
                sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
                <HistoryIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* CSV Import */}
          {canManage && (
            <Button variant="outlined" size="small" startIcon={<FileUploadOutlinedIcon />}
              onClick={openImportDialog}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, px: 2.5, py: 1.1,
                    transition: "all 0.2s ease", "&:hover": { transform: "translateY(-1px)" } }}>
              Fiyat İçe Aktar
            </Button>
          )}

          <Button variant="outlined" size="small" startIcon={<FileDownloadOutlinedIcon />}
            onClick={handleExport} disabled={isExporting}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, px: 2.5, py: 1.1,
                  transition: "all 0.2s ease", "&:hover": { transform: "translateY(-1px)" } }}>
            {isExporting ? "İndiriliyor..." : "Tüm Ürünleri CSV Olarak İndir"}
          </Button>

          {canManage && (
            <Button variant="contained" color={isFormOpen ? "secondary" : "primary"}
              startIcon={isFormOpen ? <CloseIcon /> : <AddIcon />}
              onClick={() => { if (isFormOpen) resetForm(); else setIsFormOpen(true); }}>
              {isFormOpen ? "Vazgeç" : "Ürün Ekle"}
            </Button>
          )}
        </Stack>
      </Box>

      {/* ── Product Form ── */}
      <Collapse in={isFormOpen}>
        <Paper component="form" onSubmit={submit} sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            {editingProductId ? "Ürün Bilgilerini Güncelle" : "Yeni Ürün Bilgileri"}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="Ürün Kodu" value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })} required fullWidth />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="Barkod" inputRef={barcodeInputRef} value={form.barcode}
                onChange={e => {
                  const val = e.target.value;
                  setForm(prev => ({ ...prev, barcode: val, code: editingProductId ? prev.code : val }));
                }} fullWidth />
            </Grid>
            <Grid item xs={12} sm={12} md={6}>
              <TextField label="Ürün Adı" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} required fullWidth />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField select label="Marka" value={form.brandId}
                onChange={e => setForm({ ...form, brandId: e.target.value })} required fullWidth>
                {(references.data?.brands ?? []).map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField select label="Kategori" value={form.categoryId}
                onChange={e => setForm({ ...form, categoryId: e.target.value })} required fullWidth>
                {(references.data?.categories ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField select label="Ölçü Birimi" value={form.unitId}
                onChange={e => setForm({ ...form, unitId: e.target.value })} required fullWidth>
                {(references.data?.units ?? []).map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <TextField label="Alış Fiyatı (₺)" type="number" value={form.purchasePrice}
                onChange={e => setForm({ ...form, purchasePrice: Number(e.target.value) })} fullWidth />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <TextField label="Satış Fiyatı (₺)" type="number" value={form.salePrice}
                onChange={e => setForm({ ...form, salePrice: Number(e.target.value) })} fullWidth />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <TextField label="Min. Stok Uyarısı" type="number" value={form.minStock}
                onChange={e => setForm({ ...form, minStock: Number(e.target.value) })} fullWidth />
            </Grid>
            {editingProductId && (
              <Grid item xs={12} sm={4} md={3}>
                <TextField select label="Durum" value={form.isActive ? "true" : "false"}
                  onChange={e => setForm({ ...form, isActive: e.target.value === "true" })} fullWidth>
                  <MenuItem value="true">Aktif</MenuItem>
                  <MenuItem value="false">Pasif</MenuItem>
                </TextField>
              </Grid>
            )}
          </Grid>
          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button variant="outlined" onClick={resetForm}>Vazgeç</Button>
            <Button type="submit" variant="contained" disabled={isPending || !references.data}>
              {isPending ? "Kaydediliyor..." : editingProductId ? "Ürünü Güncelle" : "Ürünü Kaydet"}
            </Button>
          </Box>
        </Paper>
      </Collapse>

      {/* ── Filter Bar ── */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField placeholder="Kod, ad veya barkod ile ara…" value={search}
              onChange={e => setSearch(e.target.value)} size="small" fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: "text.disabled" }} /></InputAdornment>,
                endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch("")}><ClearIcon fontSize="small" /></IconButton></InputAdornment> : null
              }} />
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <TextField select label="Marka" value={filterBrand} onChange={e => setFilterBrand(e.target.value)} size="small" fullWidth>
              <MenuItem value=""><em>Tümü</em></MenuItem>
              {(references.data?.brands ?? []).map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <TextField select label="Kategori" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} size="small" fullWidth>
              <MenuItem value=""><em>Tümü</em></MenuItem>
              {(references.data?.categories ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <TextField select label="Durum" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} size="small" fullWidth>
              <MenuItem value="all">Tümü</MenuItem>
              <MenuItem value="active">Aktif</MenuItem>
              <MenuItem value="passive">Pasif</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={12} md={1.5} sx={{ display: "flex", justifyContent: "flex-end" }}>
            {(search || filterBrand || filterCategory || filterStatus !== "all") && (
              <Button variant="text" size="small" startIcon={<ClearIcon />} onClick={handleClearFilters} sx={{ textTransform: "none" }}>
                Temizle
              </Button>
            )}
          </Grid>
        </Grid>
        {selectedIds.size > 0 && (
          <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <Chip label={`${selectedIds.size} ürün seçildi`} size="small" color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
            <Button size="small" variant="text" sx={{ textTransform: "none", fontSize: "0.75rem" }}
              onClick={() => setSelectedIds(new Set())}>
              Seçimi temizle
            </Button>
          </Box>
        )}
      </Paper>

      {/* ── Data Table ── */}
      <DataTable
        isLoading={products.isLoading}
        columns={columns}
        headerOverride={canManage ? (
          <Checkbox size="small" checked={allPageSelected}
            indeterminate={somePageSelected && !allPageSelected}
            onChange={toggleSelectAll} />
        ) : undefined}
        rows={(products.data?.items ?? []).map(p => {
          const row: React.ReactNode[] = [
            canManage ? (
              <Checkbox size="small" checked={selectedIds.has(p.id)}
                onChange={() => toggleSelect(p.id)} onClick={e => e.stopPropagation()} />
            ) : <></>,
            <Typography variant="body2" fontWeight={700} color="primary.main">{p.code}</Typography>,
            p.barcode || <span style={{ opacity: 0.5 }}>-</span>,
            p.name, p.brandName, p.categoryName, p.unitName,
            <Typography variant="body2" sx={{ color: "text.secondary" }}>₺{p.purchasePrice.toFixed(2)}</Typography>,
            <Typography variant="body2" fontWeight={600}>₺{p.salePrice.toFixed(2)}</Typography>,
            <Chip label={p.isActive ? "Aktif" : "Pasif"} color={p.isActive ? "success" : "default"}
              size="small" variant="outlined" sx={{ fontWeight: 600 }} />
          ];
          if (canManage) row.push(
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Tooltip title="Düzenle"><IconButton color="primary" onClick={() => startEdit(p)} size="small"><EditIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Sil"><IconButton color="error" onClick={() => setDeleteTarget(p)} size="small"><DeleteIcon fontSize="small" /></IconButton></Tooltip>
            </Box>
          );
          return row;
        })}
      />

      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]} component="div"
        count={products.data?.totalCount ?? 0} rowsPerPage={rowsPerPage} page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage="Sayfa başına satır:" labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          FİYAT GEÇMİŞİ DRAWER
          ══════════════════════════════════════════════════════════════════ */}
      <Drawer anchor="right" open={historyOpen} onClose={() => setHistoryOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 480 }, p: 0 } }}>
        <Box sx={{ display: "flex", alignItems: "center", px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}>
          <HistoryIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>Fiyat Değişiklik Geçmişi</Typography>
          <IconButton onClick={() => setHistoryOpen(false)}><CloseIcon /></IconButton>
        </Box>

        {priceHistory.isLoading && <LinearProgress />}

        <Box sx={{ overflowY: "auto", flex: 1 }}>
          {historyBatches.length === 0 && !priceHistory.isLoading && (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography color="text.secondary">Henüz fiyat değişikliği yapılmamış.</Typography>
            </Box>
          )}

          {historyBatches.map(batch => (
            <Accordion key={batch.batchId} disableGutters
              sx={{ "&:before": { display: "none" }, borderBottom: 1, borderColor: "divider",
                    opacity: batch.isReverted ? 0.6 : 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}
                sx={{ px: 3, py: 1.5 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    {batch.isReverted
                      ? <Chip label="Geri Alındı" size="small" color="default" variant="outlined" sx={{ fontSize: "0.7rem" }} />
                      : <Chip label={`${batch.items.length} ürün`} size="small" color="primary" variant="outlined" sx={{ fontSize: "0.7rem" }} />
                    }
                    <Typography variant="body2" fontWeight={600}>{batch.changedBy}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">{formatDate(batch.createdAt)}</Typography>
                </Box>
                {/* Geri Al butonu — sadece geri alınmamışsa */}
                {!batch.isReverted && (
                  <Tooltip title="Bu güncellemeyi geri al">
                    <Button
                      size="small" variant="outlined" color="warning"
                      startIcon={revertBulkUpdate.isPending ? <CircularProgress size={14} color="inherit" /> : <ReplayIcon />}
                      disabled={revertBulkUpdate.isPending}
                      onClick={e => { e.stopPropagation(); revertBulkUpdate.mutate(batch.batchId); }}
                      sx={{ mr: 1, textTransform: "none", fontWeight: 600 }}>
                      Geri Al
                    </Button>
                  </Tooltip>
                )}
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pt: 0, pb: 2 }}>
                <List dense disablePadding>
                  {batch.items.map(item => (
                    <ListItem key={item.id} disablePadding sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="body2" fontWeight={600} noWrap sx={{ minWidth: 120 }}>
                              {item.productCode}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1 }}>
                              {item.productName}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: "flex", gap: 2, mt: 0.25 }}>
                            {item.oldSalePrice !== item.newSalePrice && (
                              <Typography variant="caption" color="text.secondary">
                                Satış: <s>₺{item.oldSalePrice.toFixed(2)}</s>{" → "}
                                <strong style={{ color: item.newSalePrice > item.oldSalePrice ? "#2e7d32" : "#c62828" }}>
                                  ₺{item.newSalePrice.toFixed(2)}
                                </strong>
                              </Typography>
                            )}
                            {item.oldPurchasePrice !== item.newPurchasePrice && (
                              <Typography variant="caption" color="text.secondary">
                                Alış: <s>₺{item.oldPurchasePrice.toFixed(2)}</s>{" → "}
                                <strong>₺{item.newPurchasePrice.toFixed(2)}</strong>
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Drawer>

      {/* ══════════════════════════════════════════════════════════════════════
          CSV İMPORT DİALOG (3 ADIMLI STEPPER)
          ══════════════════════════════════════════════════════════════════ */}
      <Dialog open={importOpen} onClose={() => !importPrices.isPending && setImportOpen(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          <FileUploadOutlinedIcon color="primary" />
          CSV ile Toplu Fiyat Güncelleme
        </DialogTitle>
        <Divider />

        <DialogContent sx={{ pt: 3 }}>
          <Stepper activeStep={importStep} sx={{ mb: 3 }}>
            {["Şablonu İndir", "Dosya Yükle", "Sonuç"].map(label => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          {/* Adım 0: Şablon İndir */}
          {importStep === 0 && (
            <Stack spacing={2}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Önce mevcut ürün verilerini CSV şablonu olarak indirin.<br />
                Excel'de <strong>Alış Fiyatı</strong> ve <strong>Satış Fiyatı</strong> kolonlarını düzenleyip kaydedin.
                Diğer kolonlara dokunmayın.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Şu anda uygulanmış filtreler (marka, kategori vb.) şablona yansır.
                Tüm ürünler için sayfadaki filtreleri temizlemeniz yeterli.
              </Typography>
              <Button variant="contained" startIcon={<FileDownloadOutlinedIcon />}
                onClick={downloadTemplate} disabled={isExporting}
                sx={{ alignSelf: "flex-start" }}>
                {isExporting ? "İndiriliyor..." : "Şablonu İndir (.csv)"}
              </Button>
            </Stack>
          )}

          {/* Adım 1: Dosya Yükle */}
          {importStep === 1 && (
            <Stack spacing={2}>
              <Box
                onDragOver={e => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  border: "2px dashed",
                  borderColor: importFile ? "success.main" : "divider",
                  borderRadius: 2, p: 4,
                  textAlign: "center",
                  cursor: "pointer",
                  bgcolor: importFile ? "success.50" : "action.hover",
                  transition: "all 0.2s",
                  "&:hover": { borderColor: "primary.main", bgcolor: "action.selected" }
                }}>
                <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleFileChange} />
                {importFile ? (
                  <>
                    <CheckCircleOutlineIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography fontWeight={600}>{importFile.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(importFile.size / 1024).toFixed(1)} KB — Değiştirmek için tıklayın
                    </Typography>
                  </>
                ) : (
                  <>
                    <FileUploadOutlinedIcon sx={{ fontSize: 40, mb: 1, color: "text.disabled" }} />
                    <Typography fontWeight={600}>CSV dosyasını buraya sürükleyin</Typography>
                    <Typography variant="caption" color="text.secondary">veya seçmek için tıklayın</Typography>
                  </>
                )}
              </Box>
              {importPrices.isPending && <LinearProgress />}
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                <strong>Ürün Kodu</strong> eşleşmeyle güncelleme yapılır.
                Yalnızca değişen fiyatlar kaydedilir, geçmişe yazılır.
              </Alert>
            </Stack>
          )}

          {/* Adım 2: Sonuç */}
          {importStep === 2 && importResult && (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: "center", borderRadius: 2 }}>
                    <Typography variant="h4" fontWeight={800} color="success.main">{importResult.updatedCount}</Typography>
                    <Typography variant="caption" color="text.secondary">Güncellendi</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: "center", borderRadius: 2 }}>
                    <Typography variant="h4" fontWeight={800} color="text.secondary">{importResult.skippedCount}</Typography>
                    <Typography variant="caption" color="text.secondary">Değişmedi (atlandı)</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: "center", borderRadius: 2, borderColor: importResult.errorCount > 0 ? "error.main" : "divider" }}>
                    <Typography variant="h4" fontWeight={800} color={importResult.errorCount > 0 ? "error.main" : "text.secondary"}>{importResult.errorCount}</Typography>
                    <Typography variant="caption" color="text.secondary">Hata</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {importResult.errors.length > 0 && (
                <Box>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                    <ErrorOutlineIcon fontSize="small" color="error" /> Hatalı Satırlar
                  </Typography>
                  <Box sx={{ maxHeight: 200, overflowY: "auto", bgcolor: "action.hover", borderRadius: 1, p: 1.5 }}>
                    {importResult.errors.map((e, i) => (
                      <Typography key={i} variant="caption" display="block" color="error.main" sx={{ mb: 0.5 }}>
                        Satır {e.rowNumber}: {e.reason}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}

              {importResult.updatedCount > 0 && (
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                  {importResult.updatedCount} ürün güncellendi. Geri almak için sağ üstteki <strong>Geçmiş</strong> butonunu kullanabilirsiniz.
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setImportOpen(false)} disabled={importPrices.isPending}>
            {importStep === 2 ? "Kapat" : "İptal"}
          </Button>

          {importStep === 0 && (
            <Button variant="contained" onClick={() => setImportStep(1)}>
              İleri — Dosya Yükle
            </Button>
          )}

          {importStep === 1 && (
            <>
              <Button variant="outlined" onClick={() => setImportStep(0)}>Geri</Button>
              <Button variant="contained" onClick={handleImportSubmit}
                disabled={!importFile || importPrices.isPending}
                startIcon={importPrices.isPending ? <CircularProgress size={16} color="inherit" /> : <FileUploadOutlinedIcon />}>
                {importPrices.isPending ? "Yükleniyor..." : "Yükle ve Güncelle"}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          İNLINE TOPLU FİYAT GÜNCELLEME DİALOG
          ══════════════════════════════════════════════════════════════════ */}
      <Dialog open={bulkPriceOpen} onClose={() => !bulkPriceUpdate.isPending && setBulkPriceOpen(false)}
        maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          <PriceChangeOutlinedIcon color="warning" />
          Toplu Fiyat Güncelleme
          <Typography variant="body2" color="text.secondary" sx={{ ml: "auto", fontWeight: 400 }}>
            {priceRows.length} ürün seçildi
          </Typography>
        </DialogTitle>
        <Divider />
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3 }}>
          <Tabs value={bulkTab} onChange={(_, v) => setBulkTab(v)}>
            <Tab label="Bireysel Düzenleme" id="bulk-tab-0" />
            <Tab label="Oran ile Güncelle" id="bulk-tab-1" />
          </Tabs>
        </Box>
        <DialogContent sx={{ pt: 2 }}>
          {bulkTab === 0 && (
            <Stack spacing={0}>
              <Grid container spacing={1} sx={{ px: 1, py: 0.5, bgcolor: "action.hover", borderRadius: 1, mb: 1 }}>
                {["ÜRÜN", "MEVCUT ALIŞ", "YENİ ALIŞ", "MEVCUT SATIŞ", "YENİ SATIŞ"].map(h => (
                  <Grid item xs={h === "ÜRÜN" ? 4 : 2} key={h}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">{h}</Typography>
                  </Grid>
                ))}
              </Grid>
              <Box sx={{ maxHeight: 400, overflowY: "auto" }}>
                {priceRows.map((row, i) => {
                  const pChanged = parseFloat(row.newPurchasePrice) !== row.currentPurchasePrice;
                  const sChanged = parseFloat(row.newSalePrice) !== row.currentSalePrice;
                  return (
                    <Grid container spacing={1} key={row.productId} alignItems="center"
                      sx={{ px: 1, py: 0.75, borderRadius: 1,
                            bgcolor: (pChanged || sChanged) ? "warning.50" : "transparent",
                            "&:hover": { bgcolor: "action.hover" }, transition: "background 0.2s" }}>
                      <Grid item xs={4}>
                        <Typography variant="body2" fontWeight={600} noWrap>{row.productName}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.productCode}</Typography>
                      </Grid>
                      <Grid item xs={2}>
                        <Typography variant="body2" color="text.secondary">₺{row.currentPurchasePrice.toFixed(2)}</Typography>
                      </Grid>
                      <Grid item xs={2}>
                        <TextField size="small" type="number" value={row.newPurchasePrice}
                          onChange={e => { const v = e.target.value; setPriceRows(p => p.map((r, j) => j === i ? { ...r, newPurchasePrice: v } : r)); }}
                          inputProps={{ min: 0, step: "0.01" }}
                          sx={{ "& .MuiOutlinedInput-root": { bgcolor: pChanged ? "warning.50" : "transparent", "& fieldset": { borderColor: pChanged ? "warning.main" : undefined } } }}
                          InputProps={{ startAdornment: <InputAdornment position="start">₺</InputAdornment> }} />
                      </Grid>
                      <Grid item xs={2}>
                        <Typography variant="body2" color="text.secondary">₺{row.currentSalePrice.toFixed(2)}</Typography>
                      </Grid>
                      <Grid item xs={2}>
                        <TextField size="small" type="number" value={row.newSalePrice}
                          onChange={e => { const v = e.target.value; setPriceRows(p => p.map((r, j) => j === i ? { ...r, newSalePrice: v } : r)); }}
                          inputProps={{ min: 0, step: "0.01" }}
                          sx={{ "& .MuiOutlinedInput-root": { bgcolor: sChanged ? "warning.50" : "transparent", "& fieldset": { borderColor: sChanged ? "warning.main" : undefined } } }}
                          InputProps={{ startAdornment: <InputAdornment position="start">₺</InputAdornment> }} />
                      </Grid>
                    </Grid>
                  );
                })}
              </Box>
            </Stack>
          )}

          {bulkTab === 1 && (
            <Stack spacing={3} sx={{ py: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Seçili <strong>{priceRows.length} ürüne</strong> oran uygulanır.
                Sonucu "Bireysel Düzenleme" sekmesinde inceleyebilirsiniz.
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <TextField select label="İşlem Tipi" value={rateType}
                    onChange={e => setRateType(e.target.value as "increase" | "decrease")} fullWidth>
                    <MenuItem value="increase">Zam Uygula (artır)</MenuItem>
                    <MenuItem value="decrease">İndirim Uygula (azalt)</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField select label="Hangi Fiyat" value={rateField}
                    onChange={e => setRateField(e.target.value as "both" | "purchasePrice" | "salePrice")} fullWidth>
                    <MenuItem value="salePrice">Yalnızca Satış Fiyatı</MenuItem>
                    <MenuItem value="purchasePrice">Yalnızca Alış Fiyatı</MenuItem>
                    <MenuItem value="both">Her İkisi</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Oran (%)" type="number" value={rateValue}
                    onChange={e => setRateValue(e.target.value)} fullWidth
                    inputProps={{ min: 0.01, max: 1000, step: "0.01" }}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
                </Grid>
              </Grid>
              <Button variant="contained" color="warning" onClick={applyRate} startIcon={<PriceChangeOutlinedIcon />}>
                Oranı Uygula ve Önizle
              </Button>
            </Stack>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setBulkPriceOpen(false)} disabled={bulkPriceUpdate.isPending}>İptal</Button>
          <Button variant="contained" color="warning" onClick={submitBulkPrice}
            disabled={bulkPriceUpdate.isPending}
            startIcon={bulkPriceUpdate.isPending ? <CircularProgress size={16} color="inherit" /> : <PriceChangeOutlinedIcon />}>
            {bulkPriceUpdate.isPending ? "Güncelleniyor..." : "Fiyatları Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Sil Onay Dialogu ── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Ürünü Sil</DialogTitle>
        <DialogContent>
          <Typography><strong>{deleteTarget?.name}</strong> adlı ürünü silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Not: Ürüne ait stok hareketleri veya faturalar varsa silme işlemi başarısız olacaktır.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>İptal</Button>
          <Button variant="contained" color="error" disabled={remove.isPending}
            onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}>
            {remove.isPending ? "Siliniyor..." : "Evet, Sil"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar open={snack.open} autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snack.severity} variant="filled"
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          sx={{ borderRadius: 2, fontWeight: 600 }}>
          {snack.message}
        </Alert>
      </Snackbar>

      {/* ── Undo Snackbar ── */}
      <Snackbar open={!!lastBatchId && undoCountdown > 0}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity="info" variant="filled" sx={{ borderRadius: 2, fontWeight: 600, alignItems: "center" }}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ opacity: 0.85 }}>{undoCountdown}s</Typography>
              <Button size="small" color="inherit"
                startIcon={revertBulkUpdate.isPending ? <CircularProgress size={14} color="inherit" /> : <UndoIcon />}
                onClick={() => lastBatchId && revertBulkUpdate.mutate(lastBatchId)}
                disabled={revertBulkUpdate.isPending}
                sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                Geri Al
              </Button>
            </Stack>
          }>
          Fiyatlar güncellendi
        </Alert>
      </Snackbar>

    </Stack>
  );
}
