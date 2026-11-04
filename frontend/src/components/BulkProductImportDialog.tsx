import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Stack,
  Grid,
  Paper,
  Alert,
  Divider,
  Chip,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl,
  FormLabel,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  InputLabel,
  Switch,
  Tabs,
  Tab,
  TextField,
  Autocomplete,
  Checkbox
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import SyncAltOutlinedIcon from "@mui/icons-material/SyncAltOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PostAddOutlinedIcon from "@mui/icons-material/PostAddOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import { apiClient } from "../api/apiClient";
import {
  ProductImportPreviewResult,
  ProductImportPreviewItem,
  ProductImportCommitRequest,
  ProductImportResult,
  ReferenceDataDto
} from "../api/types";

interface BulkProductImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkProductImportDialog: React.FC<BulkProductImportDialogProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0=Dosya Seç, 1=Önizleme & Ayar, 2=Sonuç
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [rawViewerOpen, setRawViewerOpen] = useState<boolean>(false);

  // Gelişmiş Ayarlar & Eşleştirme State'leri
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [barcodeCol, setBarcodeCol] = useState<number | null>(null);
  const [nameCol, setNameCol] = useState<number | null>(null);
  const [salePriceCol, setSalePriceCol] = useState<number | null>(null);
  const [purchasePriceCol, setPurchasePriceCol] = useState<number | null>(null);
  const [sanitizeBarcode, setSanitizeBarcode] = useState<boolean>(true);
  const [settingsTab, setSettingsTab] = useState<"mapping" | "productInfo" | "duplicate">("mapping");

  // Ürün Bilgileri (toplu atama) State'leri
  const [overrideBrand, setOverrideBrand] = useState<string>("");
  const [overrideCategory, setOverrideCategory] = useState<string>("");
  const [overrideMinStock, setOverrideMinStock] = useState<string>("");
  const [overrideInitialStock, setOverrideInitialStock] = useState<string>("");
  const [applyBrandCategoryToExisting, setApplyBrandCategoryToExisting] = useState<boolean>(false);

  const { data: referenceData } = useQuery({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data,
    enabled: open
  });
  const brandOptions = (referenceData?.brands ?? []).map(b => b.name).filter(Boolean);
  const categoryOptions = (referenceData?.categories ?? []).map(c => c.name).filter(Boolean);
  const trBrand = overrideBrand.trim();
  const trCategory = overrideCategory.trim();
  const isNewBrand = !!trBrand && !brandOptions.some(b => b.toLocaleLowerCase("tr") === trBrand.toLocaleLowerCase("tr"));
  const isNewCategory = !!trCategory && !categoryOptions.some(c => c.toLocaleLowerCase("tr") === trCategory.toLocaleLowerCase("tr"));
  const activeOverrideCount =
    (trBrand ? 1 : 0) + (trCategory ? 1 : 0) + (overrideMinStock.trim() ? 1 : 0) + (overrideInitialStock.trim() ? 1 : 0);

  /** Toplu atamanın bu satıra uygulanıp uygulanmayacağı (yeni ürünler her zaman, mevcutlar yalnızca anahtar açıksa) */
  const overrideAppliesTo = (status: string) =>
    status === "New" || ((status === "Existing" || status === "Unchanged") && applyBrandCategoryToExisting && duplicateAction !== "skip");

  const toColLetter = (n?: number | null) => {
    if (!n || n < 1) return "—";
    let s = "";
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  const [duplicateAction, setDuplicateAction] = useState<"update" | "skip" | "fail">("update");
  const [filterStatus, setFilterStatus] = useState<"all" | "New" | "Existing" | "Unchanged" | "Error">("all");
  const [previewResult, setPreviewResult] = useState<ProductImportPreviewResult | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [commitResult, setCommitResult] = useState<ProductImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep(0);
    setFile(null);
    setIsDragging(false);
    setIsLoadingPreview(false);
    setIsCommitting(false);
    setSelectedSheet("");
    setBarcodeCol(null);
    setNameCol(null);
    setSalePriceCol(null);
    setPurchasePriceCol(null);
    setSanitizeBarcode(true);
    setSettingsTab("mapping");
    setOverrideBrand("");
    setOverrideCategory("");
    setOverrideMinStock("");
    setOverrideInitialStock("");
    setApplyBrandCategoryToExisting(false);
    setDuplicateAction("update");
    setFilterStatus("all");
    setPreviewResult(null);
    setSelectedRowKeys(new Set());
    setCommitResult(null);
    setErrorMessage(null);
    setRawViewerOpen(false);
  };

  const handleClose = () => {
    if (isLoadingPreview || isCommitting) return;
    resetState();
    onClose();
  };

  // ─── 1. Örnek Şablonu İndir ─────────────────────────────────────────────
  const downloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const res = await apiClient.get("/products/import-template", {
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `urun_yukleme_sablonu_${new Date().toISOString().split("T")[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setErrorMessage("Şablon dosyası indirilemedi. Lütfen bağlantınızı kontrol edin.");
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // ─── 2. Dosya Yükle & Önizleme Al ──────────────────────────────────────
  const fetchPreview = async (
    targetFile: File,
    options?: {
      sheetName?: string;
      barcodeCol?: number | null;
      nameCol?: number | null;
      salePriceCol?: number | null;
      purchasePriceCol?: number | null;
      sanitizeBarcode?: boolean;
    }
  ) => {
    setIsLoadingPreview(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", targetFile);

      const params = new URLSearchParams();
      if (options?.sheetName) params.append("sheetName", options.sheetName);
      if (options?.barcodeCol) params.append("barcodeCol", options.barcodeCol.toString());
      if (options?.nameCol) params.append("nameCol", options.nameCol.toString());
      if (options?.salePriceCol) params.append("salePriceCol", options.salePriceCol.toString());
      if (options?.purchasePriceCol) params.append("purchasePriceCol", options.purchasePriceCol.toString());
      if (options?.sanitizeBarcode !== undefined) params.append("sanitizeBarcode", options.sanitizeBarcode.toString());

      const url = `/products/import-preview${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await apiClient.post<ProductImportPreviewResult>(url, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setPreviewResult(res.data);
      const initialSelected = new Set<string>();
      res.data.rows.forEach((r, idx) => {
        if (r.status !== "Error") {
          initialSelected.add(`${r.sheetName || ""}_${r.rowNumber}_${idx}`);
        }
      });
      setSelectedRowKeys(initialSelected);
      setSelectedSheet(res.data.selectedSheet || options?.sheetName || "");
      setBarcodeCol(res.data.detectedColumns?.barcodeCol ?? null);
      setNameCol(res.data.detectedColumns?.nameCol ?? null);
      setSalePriceCol(res.data.detectedColumns?.salePriceCol ?? null);
      setPurchasePriceCol(res.data.detectedColumns?.purchasePriceCol ?? null);
      setStep(1);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.error || "Excel dosyası analiz edilirken hata oluştu.");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".xlsx")) {
      setErrorMessage("Lütfen yalnızca Excel (.xlsx) dosyası yükleyin.");
      return;
    }

    setFile(selectedFile);
    setSelectedSheet("");
    fetchPreview(selectedFile, { sanitizeBarcode: true });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleSheetChange = (newSheet: string) => {
    if (!file || newSheet === selectedSheet) return;
    setSelectedSheet(newSheet);
    // Farklı bir sayfaya geçildiğinde manuel sütun seçimlerini sıfırla ki yeni sayfanın sütunları otomatik algılansın
    setBarcodeCol(null);
    setNameCol(null);
    setSalePriceCol(null);
    setPurchasePriceCol(null);
    fetchPreview(file, {
      sheetName: newSheet || undefined,
      sanitizeBarcode
    });
  };

  const handleApplyCustomMapping = () => {
    if (!file) return;
    fetchPreview(file, {
      sheetName: selectedSheet || undefined,
      barcodeCol,
      nameCol,
      salePriceCol,
      purchasePriceCol,
      sanitizeBarcode
    });
  };


  // Her satırı orijinal indeksini koruyarak sarıyoruz
  const rowsWithIndex = useMemo(() => {
    return (previewResult?.rows ?? []).map((r, idx) => ({ ...r, originalIndex: idx }));
  }, [previewResult]);

  // Filtrelenmiş önizleme satırları
  const displayedRows = useMemo(() => {
    if (filterStatus === "all") return rowsWithIndex;
    return rowsWithIndex.filter(r => r.status === filterStatus);
  }, [rowsWithIndex, filterStatus]);

  // Toplam seçili geçerli (hata olmayan) satır sayısı
  const selectedCount = useMemo(() => {
    if (!previewResult) return 0;
    return previewResult.rows.filter((r, idx) => {
      if (r.status === "Error") return false;
      const key = `${r.sheetName || ""}_${r.rowNumber}_${idx}`;
      return selectedRowKeys.has(key);
    }).length;
  }, [previewResult, selectedRowKeys]);

  // Görüntülenen geçerli (hata olmayan) satırlar
  const displayedValidRows = useMemo(() => {
    return displayedRows.filter(r => r.status !== "Error");
  }, [displayedRows]);

  // Görüntülenen satırların tümü seçili mi / bir kısmı mı seçili
  const allDisplayedSelected = displayedValidRows.length > 0 && displayedValidRows.every(r => {
    const key = `${r.sheetName || ""}_${r.rowNumber}_${r.originalIndex}`;
    return selectedRowKeys.has(key);
  });

  const someDisplayedSelected = displayedValidRows.some(r => {
    const key = `${r.sheetName || ""}_${r.rowNumber}_${r.originalIndex}`;
    return selectedRowKeys.has(key);
  });

  const toggleSelectAllDisplayed = () => {
    const next = new Set(selectedRowKeys);
    if (allDisplayedSelected) {
      displayedValidRows.forEach(r => {
        const key = `${r.sheetName || ""}_${r.rowNumber}_${r.originalIndex}`;
        next.delete(key);
      });
    } else {
      displayedValidRows.forEach(r => {
        const key = `${r.sheetName || ""}_${r.rowNumber}_${r.originalIndex}`;
        next.add(key);
      });
    }
    setSelectedRowKeys(next);
  };

  const toggleRowSelection = (originalIndex: number, rowNumber: number, sheetName?: string | null) => {
    const key = `${sheetName || ""}_${rowNumber}_${originalIndex}`;
    const next = new Set(selectedRowKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedRowKeys(next);
  };

  const selectAllValid = () => {
    if (!previewResult) return;
    const all = new Set<string>();
    previewResult.rows.forEach((r, idx) => {
      if (r.status !== "Error") {
        all.add(`${r.sheetName || ""}_${r.rowNumber}_${idx}`);
      }
    });
    setSelectedRowKeys(all);
  };

  const deselectAllValid = () => {
    setSelectedRowKeys(new Set());
  };

  // ─── 3. Kaydet & Onayla ────────────────────────────────────────────────
  const handleCommit = async () => {
    if (!previewResult) return;

    // Hata olan satırları filtrele ve yalnızca kullanıcının SEÇTİĞİ satırları al
    const targetRows = previewResult.rows.filter((r, idx) => {
      const key = `${r.sheetName || ""}_${r.rowNumber}_${idx}`;
      return r.status !== "Error" && selectedRowKeys.has(key);
    });

    if (targetRows.length === 0) {
      setErrorMessage("Kaydedilmek üzere en az bir ürün seçmelisiniz. Lütfen tablodaki seçim kutucuklarını kontrol edin.");
      return;
    }

    if (duplicateAction === "fail") {
      const existingInSelected = targetRows.filter(r => r.status === "Existing").length;
      if (existingInSelected > 0) {
        setErrorMessage("Mevcut ürün davranışı 'Hata Ver' olarak seçildi ancak seçili listede fiyatı güncellenecek ürünler var.");
        return;
      }
    }

    setIsCommitting(true);
    setErrorMessage(null);

    const brandOv = overrideBrand.trim();
    const categoryOv = overrideCategory.trim();
    const minStockOv = overrideMinStock.trim() !== "" ? Math.max(0, Number(overrideMinStock)) : null;
    const initialStockOv = overrideInitialStock.trim() !== "" ? Math.max(0, Number(overrideInitialStock)) : null;

    const payload: ProductImportCommitRequest = {
      duplicateAction,
      applyBrandCategoryToExisting: applyBrandCategoryToExisting && (!!brandOv || !!categoryOv),
      items: targetRows.map(r => {
        const isNewRow = r.status === "New";
        return {
          code: r.code,
          barcode: r.barcode,
          name: r.name,
          // Yeni ürünlerde: toplu atama > Excel/kural motoru önerisi. Mevcut ürünlerde yalnızca toplu atama gönderilir.
          categoryName: isNewRow
            ? (categoryOv || r.categoryName || r.suggestedCategoryName || undefined)
            : (categoryOv || undefined),
          brandName: isNewRow
            ? (brandOv || r.brandName || r.suggestedBrandName || undefined)
            : (brandOv || undefined),
          unitCode: r.unitCode || "ADET",
          purchasePrice: r.purchasePrice,
          salePrice: r.salePrice,
          minStock: isNewRow && minStockOv !== null ? minStockOv : r.minStock,
          initialStock: isNewRow && initialStockOv !== null ? initialStockOv : r.initialStock
        };
      })
    };

    try {
      const res = await apiClient.post<ProductImportResult>("/products/import-commit", payload);
      setCommitResult(res.data);
      setStep(2);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.error || "Toplu ürün yükleme kaydedilirken hata oluştu.");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: "92vh" } }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, mr: 2 }}>
            <PostAddOutlinedIcon color="primary" sx={{ fontSize: 30, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
                  Akıllı Ürün ve Fiyat İçe Aktarma
                </Typography>
                {step >= 1 && file && (
                  <Tooltip title="Orijinal Excel tablosunu incelemek için tıklayın">
                    <Chip
                      icon={<TableChartOutlinedIcon fontSize="small" />}
                      label={file.name}
                      size="small"
                      color="primary"
                      variant="outlined"
                      onClick={() => setRawViewerOpen(true)}
                      sx={{
                        fontWeight: 700,
                        maxWidth: { xs: 200, sm: 340, md: 450 },
                        cursor: "pointer",
                        "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
                      }}
                    />
                  </Tooltip>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Tedarikçi Excel listelerinden barkod, ad ve fiyatları otomatik tespit edin; varsa güncelleyin, yoksa ekleyin.
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={handleClose} size="small" disabled={isLoadingPreview || isCommitting}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 3, overflowY: "auto" }}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          )}

          {/* ══════════════════════════════════════════════════════════════════
            ADIM 0: DOSYA YÜKLEME & ŞABLON
            ══════════════════════════════════════════════════════════════════ */}
          {step === 0 && (
            <Stack spacing={3}>
              {/* Rehber & Şablon İndir Kartı */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  bgcolor: "background.default",
                  borderStyle: "dashed",
                  borderColor: "primary.main"
                }}
              >
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <AutoAwesomeOutlinedIcon fontSize="small" /> Akıllı Tedarikçi Excel Algılama
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      • Sabit bir şablona bağlı kalmanıza gerek yoktur; <strong>Barkod (ISBN)</strong>, <strong>Ürün Adı</strong> ve <strong>Fiyat</strong> alanları otomatik tespit edilir.<br />
                      • Mevcut ürünlerin fiyatları güncellenir, yeni ürünler eksik alanları varsayılan kurallarla doldurularak sisteme kaydedilir.<br />
                      • Çok sayfalı Excel dosyalarında (Örn. Newton, More&More) istediğiniz sayfayı seçip içe aktarabilirsiniz.
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={isDownloadingTemplate ? <CircularProgress size={16} /> : <FileDownloadOutlinedIcon />}
                    onClick={downloadTemplate}
                    disabled={isDownloadingTemplate}
                    sx={{ whiteSpace: "nowrap", borderRadius: 2, fontWeight: 700, px: 2.5, py: 1 }}
                  >
                    {isDownloadingTemplate ? "İndiriliyor..." : "Örnek Şablon (.xlsx)"}
                  </Button>
                </Stack>
              </Paper>

              {/* Dosya Sürükle & Bırak Alanı */}
              <Box
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  border: "2px dashed",
                  borderColor: isDragging ? "primary.main" : "divider",
                  bgcolor: isDragging ? "action.hover" : "background.paper",
                  borderRadius: 3,
                  p: 6,
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                  "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                {isLoadingPreview ? (
                  <Stack spacing={2} alignItems="center">
                    <CircularProgress size={44} />
                    <Typography variant="body1" fontWeight={600}>
                      Excel dosyası taranıyor ve ürünler doğrulanıyor...
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Sayfalar, başlıklar, barkodlar ve fiyat sütunları yapay sezgisel algoritma ile taranıyor.
                    </Typography>
                  </Stack>
                ) : (
                  <Stack spacing={1.5} alignItems="center">
                    <Box sx={{ p: 2, borderRadius: "50%", bgcolor: "primary.50", color: "primary.main", display: "inline-flex" }}>
                      <CloudUploadOutlinedIcon sx={{ fontSize: 48 }} />
                    </Box>
                    <Typography variant="h6" fontWeight={700}>
                      Tedarikçi Excel (.xlsx) dosyasını buraya sürükleyin
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      veya bilgisayarınızdan seçmek için tıklayın
                    </Typography>
                    <Chip label="Yalnızca .xlsx formatı desteklenir" size="small" variant="outlined" sx={{ mt: 1 }} />
                  </Stack>
                )}
              </Box>
            </Stack>
          )}

          {/* ══════════════════════════════════════════════════════════════════
            ADIM 1: ÖNİZLEME & ÇAKIŞMA AYARI
            ══════════════════════════════════════════════════════════════════ */}
          {step === 1 && previewResult && (
            <Stack spacing={2}>
              {/* Yüklü Dosya Bilgi & İndirme Barı */}
              {file && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    px: 2,
                    borderRadius: 2,
                    bgcolor: (theme) => (theme.palette.mode === "dark" ? "background.paper" : "#f8fafc"),
                    borderColor: "primary.light",
                    borderWidth: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 1.5
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                    <Box
                      sx={{
                        bgcolor: "success.main",
                        color: "common.white",
                        borderRadius: 1.5,
                        p: 0.8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      <DescriptionOutlinedIcon fontSize="small" />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: "text.primary", wordBreak: "break-all" }}>
                          {file.name}
                        </Typography>
                        <Chip
                          label={formatFileSize(file.size)}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: "0.72rem", fontWeight: 700 }}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        İşlenen Tedarikçi Excel Dosyası • Orijinal satır ve sütunları görmek için tabloyu inceleyebilirsiniz.
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={<TableChartOutlinedIcon />}
                      onClick={() => setRawViewerOpen(true)}
                      sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none", px: 2, py: 0.6 }}
                    >
                      Orijinal Tabloyu İncele
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      startIcon={<ArrowBackIcon />}
                      onClick={() => setStep(0)}
                      sx={{ borderRadius: 2, fontWeight: 600, textTransform: "none", py: 0.6 }}
                    >
                      Farklı Dosya Seç
                    </Button>
                  </Stack>
                </Paper>
              )}

              {/* Sayfa (Sheet) Seçici ve Sütun Yapılandırma Barı */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    {previewResult.availableSheets && previewResult.availableSheets.length > 1 && (
                      <FormControl size="small" sx={{ minWidth: 260 }}>
                        <InputLabel id="sheet-select-label">Aktarılacak Sayfa</InputLabel>
                        <Select
                          labelId="sheet-select-label"
                          value={selectedSheet || ""}
                          label="Aktarılacak Sayfa"
                          onChange={(e) => handleSheetChange(e.target.value)}
                          disabled={isLoadingPreview}
                        >
                          <MenuItem value="">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <LayersOutlinedIcon fontSize="small" color="primary" />
                              <Typography variant="body2" fontWeight={700}>
                                Tüm Sayfalar ({previewResult.availableSheets.length} Sayfa)
                              </Typography>
                            </Stack>
                          </MenuItem>
                          <Divider sx={{ my: 0.5 }} />
                          {previewResult.availableSheets.map((s) => (
                            <MenuItem key={s} value={s}>
                              <Typography variant="body2">
                                📄 Yalnızca: <strong>{s}</strong>
                              </Typography>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}


                    <Chip
                      icon={<AutoAwesomeOutlinedIcon fontSize="small" />}
                      label={`Otomatik Tespit: Barkod (${toColLetter(previewResult.detectedColumns.barcodeCol)}), Ad (${toColLetter(previewResult.detectedColumns.nameCol)}), Satış (${toColLetter(previewResult.detectedColumns.salePriceCol)})${previewResult.detectedColumns.purchasePriceCol ? `, Alış (${toColLetter(previewResult.detectedColumns.purchasePriceCol)})` : ""}`}
                      color="primary"
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                  </Stack>
                </Stack>

                {/* Ayar Sekmeleri */}
                <Tabs
                  value={settingsTab}
                  onChange={(_, v) => setSettingsTab(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ mt: 1.5, borderBottom: 1, borderColor: "divider", minHeight: 42, "& .MuiTab-root": { minHeight: 42, textTransform: "none", fontWeight: 600 } }}
                >
                  <Tab value="mapping" icon={<ViewColumnOutlinedIcon fontSize="small" />} iconPosition="start" label="Sütun Eşleştirme" />
                  <Tab
                    value="productInfo"
                    icon={<SellOutlinedIcon fontSize="small" />}
                    iconPosition="start"
                    label={
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <span>Ürün Bilgileri</span>
                        {activeOverrideCount > 0 && (
                          <Chip label={activeOverrideCount} size="small" color="primary" sx={{ height: 18, fontSize: "0.7rem", fontWeight: 700 }} />
                        )}
                      </Stack>
                    }
                  />
                  <Tab value="duplicate" icon={<SyncAltOutlinedIcon fontSize="small" />} iconPosition="start" label="Mevcut Ürün Davranışı" />
                </Tabs>

                {/* SEKME 1: Sütun Eşleştirme */}
                {settingsTab === "mapping" && (
                  <Box sx={{ pt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel id="barcode-col-select-label">Barkod / Kod Sütunu</InputLabel>
                          <Select
                            labelId="barcode-col-select-label"
                            value={barcodeCol ?? ""}
                            label="Barkod / Kod Sütunu"
                            onChange={(e) => setBarcodeCol(Number(e.target.value) || null)}
                            renderValue={(selected) => {
                              if (!selected) return <em>Seçiniz</em>;
                              const col = previewResult.availableColumns.find(c => (c.index ?? c.columnNumber) === selected);
                              const letter = col?.letter ?? `${selected}`;
                              return <strong>Sütun {letter}</strong>;
                            }}
                          >
                            {previewResult.availableColumns.map((col) => {
                              const colIdx = col.index ?? col.columnNumber;
                              const colLetter = col.letter ?? `${colIdx}`;
                              const sample = col.sampleValue ? col.sampleValue.trim() : "";
                              return (
                                <MenuItem key={colIdx} value={colIdx} sx={{ py: 0.75 }}>
                                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 2 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 65, color: "primary.main" }}>
                                      Sütun {colLetter}
                                    </Typography>
                                    {sample && (
                                      <Typography variant="caption" sx={{ color: "text.secondary", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sample}>
                                        Örn: {sample}
                                      </Typography>
                                    )}
                                  </Box>
                                </MenuItem>
                              );
                            })}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel id="name-col-select-label">Ürün Adı Sütunu</InputLabel>
                          <Select
                            labelId="name-col-select-label"
                            value={nameCol ?? ""}
                            label="Ürün Adı Sütunu"
                            onChange={(e) => setNameCol(Number(e.target.value) || null)}
                            renderValue={(selected) => {
                              if (!selected) return <em>Seçiniz</em>;
                              const col = previewResult.availableColumns.find(c => (c.index ?? c.columnNumber) === selected);
                              const letter = col?.letter ?? `${selected}`;
                              return <strong>Sütun {letter}</strong>;
                            }}
                          >
                            {previewResult.availableColumns.map((col) => {
                              const colIdx = col.index ?? col.columnNumber;
                              const colLetter = col.letter ?? `${colIdx}`;
                              const sample = col.sampleValue ? col.sampleValue.trim() : "";
                              return (
                                <MenuItem key={colIdx} value={colIdx} sx={{ py: 0.75 }}>
                                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 2 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 65, color: "primary.main" }}>
                                      Sütun {colLetter}
                                    </Typography>
                                    {sample && (
                                      <Typography variant="caption" sx={{ color: "text.secondary", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sample}>
                                        Örn: {sample}
                                      </Typography>
                                    )}
                                  </Box>
                                </MenuItem>
                              );
                            })}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel id="sale-price-col-select-label">Satış / Liste Fiyatı Sütunu</InputLabel>
                          <Select
                            labelId="sale-price-col-select-label"
                            value={salePriceCol ?? ""}
                            label="Satış / Liste Fiyatı Sütunu"
                            onChange={(e) => setSalePriceCol(Number(e.target.value) || null)}
                            renderValue={(selected) => {
                              if (!selected) return <em>Seçiniz</em>;
                              const col = previewResult.availableColumns.find(c => (c.index ?? c.columnNumber) === selected);
                              const letter = col?.letter ?? `${selected}`;
                              return <strong>Sütun {letter}</strong>;
                            }}
                          >
                            {previewResult.availableColumns.map((col) => {
                              const colIdx = col.index ?? col.columnNumber;
                              const colLetter = col.letter ?? `${colIdx}`;
                              const sample = col.sampleValue ? col.sampleValue.trim() : "";
                              return (
                                <MenuItem key={colIdx} value={colIdx} sx={{ py: 0.75 }}>
                                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 2 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 65, color: "primary.main" }}>
                                      Sütun {colLetter}
                                    </Typography>
                                    {sample && (
                                      <Typography variant="caption" sx={{ color: "text.secondary", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sample}>
                                        Örn: {sample}
                                      </Typography>
                                    )}
                                  </Box>
                                </MenuItem>
                              );
                            })}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel id="purchase-price-col-select-label">Alış / Bayi Fiyatı Sütunu (Opsiyonel)</InputLabel>
                          <Select
                            labelId="purchase-price-col-select-label"
                            value={purchasePriceCol ?? ""}
                            label="Alış / Bayi Fiyatı Sütunu (Opsiyonel)"
                            onChange={(e) => setPurchasePriceCol(Number(e.target.value) || null)}
                            renderValue={(selected) => {
                              if (!selected) return <em>Seçilmedi (Boş)</em>;
                              const col = previewResult.availableColumns.find(c => (c.index ?? c.columnNumber) === selected);
                              const letter = col?.letter ?? `${selected}`;
                              return <strong>Sütun {letter}</strong>;
                            }}
                          >
                            <MenuItem value=""><em>Seçilmedi (Boş)</em></MenuItem>
                            {previewResult.availableColumns.map((col) => {
                              const colIdx = col.index ?? col.columnNumber;
                              const colLetter = col.letter ?? `${colIdx}`;
                              const sample = col.sampleValue ? col.sampleValue.trim() : "";
                              return (
                                <MenuItem key={colIdx} value={colIdx} sx={{ py: 0.75 }}>
                                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 2 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 65, color: "primary.main" }}>
                                      Sütun {colLetter}
                                    </Typography>
                                    {sample && (
                                      <Typography variant="caption" sx={{ color: "text.secondary", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sample}>
                                        Örn: {sample}
                                      </Typography>
                                    )}
                                  </Box>
                                </MenuItem>
                              );
                            })}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>

                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={sanitizeBarcode}
                            onChange={(e) => setSanitizeBarcode(e.target.checked)}
                            size="small"
                          />
                        }
                        label={
                          <Typography variant="body2">
                            Barkoddaki tire ve boşlukları temizle (Örn: 978-625-... ➔ 978625...)
                          </Typography>
                        }
                      />

                      <Button
                        variant="contained"
                        size="small"
                        startIcon={isLoadingPreview ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
                        onClick={handleApplyCustomMapping}
                        disabled={isLoadingPreview}
                        sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none" }}
                      >
                        Yeniden Tara
                      </Button>
                    </Stack>
                  </Box>
                )}

                {/* SEKME 2: Ürün Bilgileri (Toplu Atama) */}
                {settingsTab === "productInfo" && (
                  <Box sx={{ pt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Autocomplete
                          freeSolo
                          size="small"
                          options={brandOptions}
                          inputValue={overrideBrand}
                          onInputChange={(_, v) => setOverrideBrand(v)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Marka / Yayınevi"
                              placeholder="Seçin veya yeni yazın"
                              helperText={isNewBrand ? "✨ Yeni marka olarak oluşturulacak" : " "}
                              FormHelperTextProps={{ sx: { color: isNewBrand ? "success.main" : undefined, fontWeight: 600, mx: 0.5 } }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Autocomplete
                          freeSolo
                          size="small"
                          options={categoryOptions}
                          inputValue={overrideCategory}
                          onInputChange={(_, v) => setOverrideCategory(v)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Kategori"
                              placeholder="Seçin veya yeni yazın"
                              helperText={isNewCategory ? "✨ Yeni kategori olarak oluşturulacak" : " "}
                              FormHelperTextProps={{ sx: { color: isNewCategory ? "success.main" : undefined, fontWeight: 600, mx: 0.5 } }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Min. Stok"
                          placeholder="Varsayılan"
                          value={overrideMinStock}
                          onChange={(e) => setOverrideMinStock(e.target.value)}
                          inputProps={{ min: 0 }}
                          helperText="Yalnızca yeni ürünler"
                        />
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Başlangıç Stoğu"
                          placeholder="Varsayılan"
                          value={overrideInitialStock}
                          onChange={(e) => setOverrideInitialStock(e.target.value)}
                          inputProps={{ min: 0 }}
                          helperText="Yalnızca yeni ürünler"
                        />
                      </Grid>
                    </Grid>

                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between" sx={{ mt: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={applyBrandCategoryToExisting}
                            onChange={(e) => setApplyBrandCategoryToExisting(e.target.checked)}
                            disabled={duplicateAction === "skip" || (!overrideBrand.trim() && !overrideCategory.trim())}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              Mevcut ürünlerin marka ve kategorisini de güncelle
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Kapalıyken yalnızca yeni eklenecek ürünlere uygulanır
                              {duplicateAction === "skip" ? " ('Mevcut Olanları Atla' seçiliyken kullanılamaz)" : ""}
                            </Typography>
                          </Box>
                        }
                      />
                      {activeOverrideCount > 0 && (
                        <Button
                          size="small"
                          color="inherit"
                          onClick={() => {
                            setOverrideBrand("");
                            setOverrideCategory("");
                            setOverrideMinStock("");
                            setOverrideInitialStock("");
                            setApplyBrandCategoryToExisting(false);
                          }}
                          sx={{ textTransform: "none", fontWeight: 600 }}
                        >
                          Temizle
                        </Button>
                      )}
                    </Stack>

                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      Boş bırakılan alanlarda Excel'deki veri, akıllı kural motoru veya Ayarlar'daki varsayılan değerler kullanılır.
                    </Typography>
                  </Box>
                )}

                {/* SEKME 3: Mevcut Ürün Davranışı */}
                {settingsTab === "duplicate" && (
                  <Box sx={{ pt: 2 }}>
                    <FormControl component="fieldset">
                      <FormLabel component="legend" sx={{ fontWeight: 600, fontSize: "0.82rem", color: "text.secondary", mb: 0.5 }}>
                        Sistemde kayıtlı barkod ile çakışırsa:
                      </FormLabel>
                      <RadioGroup
                        row
                        value={duplicateAction}
                        onChange={(e) => {
                          const v = e.target.value as "update" | "skip" | "fail";
                          setDuplicateAction(v);
                          if (v === "skip") setApplyBrandCategoryToExisting(false);
                        }}
                      >
                        <FormControlLabel
                          value="update"
                          control={<Radio size="small" color="primary" />}
                          label={
                            <Box>
                              <Typography variant="body2" fontWeight={600}>Fiyatları Güncelle</Typography>
                              <Typography variant="caption" color="text.secondary">Ad ve fiyatları Excel'deki güncel değerlerle günceller</Typography>
                            </Box>
                          }
                          sx={{ mr: 4 }}
                        />
                        <FormControlLabel
                          value="skip"
                          control={<Radio size="small" color="primary" />}
                          label={
                            <Box>
                              <Typography variant="body2" fontWeight={600}>Mevcut Olanları Atla</Typography>
                              <Typography variant="caption" color="text.secondary">Mevcut ürünlere dokunmaz, yalnızca yeni ürünleri ekler</Typography>
                            </Box>
                          }
                          sx={{ mr: 4 }}
                        />
                        <FormControlLabel
                          value="fail"
                          control={<Radio size="small" color="error" />}
                          label={
                            <Box>
                              <Typography variant="body2" fontWeight={600} color="error.main">Hata Ver ve Durdur</Typography>
                              <Typography variant="caption" color="text.secondary">Çakışma varsa işlemi tamamen durdurur</Typography>
                            </Box>
                          }
                        />
                      </RadioGroup>
                    </FormControl>
                  </Box>
                )}
              </Paper>

              {/* Tablo Filtreleri & Liste Başlığı */}
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.paper" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
                  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle2" fontWeight={800}>
                      Önizleme Listesi ({displayedRows.length} Satır Gösteriliyor
                      {selectedSheet ? ` — Sayfa: ${selectedSheet}` : previewResult.availableSheets && previewResult.availableSheets.length > 1 ? ` — Tüm Sayfalar (${previewResult.availableSheets.length})` : ""})
                    </Typography>
                    <Chip
                      label={`Seçili: ${selectedCount} / ${previewResult.rows.filter(r => r.status !== "Error").length}`}
                      size="small"
                      color={selectedCount > 0 ? "primary" : "default"}
                      variant={selectedCount > 0 ? "filled" : "outlined"}
                      sx={{ fontWeight: 700, height: 24 }}
                    />
                    {selectedCount < previewResult.rows.filter(r => r.status !== "Error").length && (
                      <Button
                        size="small"
                        onClick={selectAllValid}
                        sx={{ textTransform: "none", py: 0, px: 1, minHeight: 24, fontSize: "0.75rem", fontWeight: 700 }}
                      >
                        Tümünü Seç
                      </Button>
                    )}
                    {selectedCount > 0 && (
                      <Button
                        size="small"
                        color="inherit"
                        onClick={deselectAllValid}
                        sx={{ textTransform: "none", py: 0, px: 1, minHeight: 24, fontSize: "0.75rem", color: "text.secondary" }}
                      >
                        Seçimi Temizle
                      </Button>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    <Chip
                      label={`Tümü (${previewResult.totalRows})`}
                      size="small"
                      variant={filterStatus === "all" ? "filled" : "outlined"}
                      color="default"
                      onClick={() => setFilterStatus("all")}
                      sx={{ fontWeight: 700 }}
                    />
                    <Chip
                      label={`Yeni (${previewResult.newCount})`}
                      size="small"
                      variant={filterStatus === "New" ? "filled" : "outlined"}
                      color="success"
                      onClick={() => setFilterStatus("New")}
                      sx={{ fontWeight: 700 }}
                    />
                    <Chip
                      label={`Fiyatı Değişecek (${previewResult.existingCount})`}
                      size="small"
                      variant={filterStatus === "Existing" ? "filled" : "outlined"}
                      color="warning"
                      onClick={() => setFilterStatus("Existing")}
                      sx={{ fontWeight: 700 }}
                    />
                    {(previewResult.unchangedCount ?? 0) > 0 && (
                      <Chip
                        label={`Fiyatı Aynı (${previewResult.unchangedCount})`}
                        size="small"
                        variant={filterStatus === "Unchanged" ? "filled" : "outlined"}
                        color="info"
                        onClick={() => setFilterStatus("Unchanged")}
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                    {previewResult.errorCount > 0 && (
                      <Chip
                        label={`Hatalı (${previewResult.errorCount})`}
                        size="small"
                        variant={filterStatus === "Error" ? "filled" : "outlined"}
                        color="error"
                        onClick={() => setFilterStatus("Error")}
                        sx={{ fontWeight: 800 }}
                      />
                    )}
                  </Stack>
                </Stack>
              </Paper>

              {/* Önizleme Tablosu */}
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500, borderRadius: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ width: 44 }}>
                        <Tooltip title={allDisplayedSelected ? "Görüntülenenlerin Seçimini Kaldır" : "Görüntülenenlerin Tümünü Seç"}>
                          <span>
                            <Checkbox
                              size="small"
                              indeterminate={someDisplayedSelected && !allDisplayedSelected}
                              checked={allDisplayedSelected && displayedValidRows.length > 0}
                              onChange={toggleSelectAllDisplayed}
                              disabled={displayedValidRows.length === 0}
                            />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 50 }}>Satır</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Barkod / Kod</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Ürün Adı</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Kategori</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Marka</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Alış Fiyatı</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Satış Fiyatı</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 130 }} align="center">Durum</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayedRows.map((r) => {
                      const isNew = r.status === "New";
                      const isExisting = r.status === "Existing";
                      const isUnchanged = r.status === "Unchanged";
                      const isError = r.status === "Error";
                      const rowKey = `${r.sheetName || ""}_${r.rowNumber}_${r.originalIndex}`;
                      const isSelected = selectedRowKeys.has(rowKey);

                      const hasSalePriceDiff = isExisting && r.oldSalePrice !== null && r.oldSalePrice !== undefined && r.oldSalePrice !== r.salePrice;
                      const isSalePriceIncrease = hasSalePriceDiff && (r.salePrice > (r.oldSalePrice ?? 0));

                      const hasPurchasePriceDiff = isExisting && r.oldPurchasePrice !== null && r.oldPurchasePrice !== undefined && r.oldPurchasePrice > 0 && r.oldPurchasePrice !== r.purchasePrice;

                      return (
                        <TableRow
                          key={rowKey}
                          sx={{
                            bgcolor: isError
                              ? "error.50"
                              : !isSelected
                                ? "action.hover"
                                : isExisting
                                  ? "warning.50"
                                  : undefined,
                            opacity: !isSelected && !isError ? 0.6 : 1,
                            transition: "opacity 0.2s, background-color 0.2s",
                            "&:hover": { bgcolor: "action.hover" }
                          }}
                        >
                          <TableCell padding="checkbox">
                            {isError ? (
                              <Tooltip title="Hatalı satırlar içeri aktarılamaz">
                                <span>
                                  <Checkbox size="small" disabled checked={false} />
                                </span>
                              </Tooltip>
                            ) : (
                              <Checkbox
                                size="small"
                                checked={isSelected}
                                onChange={() => toggleRowSelection(r.originalIndex, r.rowNumber, r.sheetName)}
                                color="primary"
                              />
                            )}
                          </TableCell>
                          <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                            {r.rowNumber}
                            {previewResult.availableSheets && previewResult.availableSheets.length > 1 && !selectedSheet && r.sheetName && (
                              <Chip
                                label={r.sheetName}
                                size="small"
                                variant="outlined"
                                sx={{ ml: 0.75, height: 18, fontSize: "0.68rem" }}
                              />
                            )}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontFamily: "monospace" }}>{r.barcode || r.code || "—"}</TableCell>
                          <TableCell sx={{ maxWidth: 240 }}>
                            <Typography
                              variant="body2"
                              noWrap
                              title={r.name}
                              sx={{ textDecoration: !isSelected && !isError ? "line-through" : "none" }}
                            >
                              {r.name || "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {trCategory && overrideAppliesTo(r.status) ? (
                              <Tooltip title="Ürün Bilgileri sekmesinden toplu atandı">
                                <Chip label={trCategory} size="small" color="primary" sx={{ height: 20, fontSize: "0.72rem", fontWeight: 600 }} />
                              </Tooltip>
                            ) : r.categoryName ? (
                              r.categoryName
                            ) : r.suggestedCategoryName ? (
                              <Tooltip title="Akıllı kural motoru tarafından otomatik tespit edildi">
                                <Chip label={r.suggestedCategoryName} size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: "0.72rem" }} />
                              </Tooltip>
                            ) : (
                              <Typography variant="caption" color="text.secondary">Genel</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {trBrand && overrideAppliesTo(r.status) ? (
                              <Tooltip title="Ürün Bilgileri sekmesinden toplu atandı">
                                <Chip label={trBrand} size="small" color="primary" sx={{ height: 20, fontSize: "0.72rem", fontWeight: 600 }} />
                              </Tooltip>
                            ) : r.brandName ? (
                              r.brandName
                            ) : r.suggestedBrandName ? (
                              <Tooltip title="Akıllı kural motoru tarafından otomatik tespit edildi">
                                <Chip label={r.suggestedBrandName} size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: "0.72rem" }} />
                              </Tooltip>
                            ) : (
                              <Typography variant="caption" color="text.secondary">Genel</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {hasPurchasePriceDiff ? (
                              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                <Typography variant="caption" sx={{ textDecoration: "line-through", color: "text.secondary" }}>
                                  ₺{(r.oldPurchasePrice ?? 0).toFixed(2)}
                                </Typography>
                                <Typography variant="body2" fontWeight={700}>
                                  ₺{r.purchasePrice.toFixed(2)}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="body2">
                                {r.purchasePrice > 0 ? `₺${r.purchasePrice.toFixed(2)}` : "—"}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {hasSalePriceDiff ? (
                              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                <Typography variant="caption" sx={{ textDecoration: "line-through", color: "text.secondary" }}>
                                  ₺{(r.oldSalePrice ?? 0).toFixed(2)}
                                </Typography>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                  {isSalePriceIncrease ? (
                                    <TrendingUpIcon sx={{ fontSize: 16, color: "success.main" }} />
                                  ) : (
                                    <TrendingDownIcon sx={{ fontSize: 16, color: "error.main" }} />
                                  )}
                                  <Typography variant="body2" fontWeight={800} color={isSalePriceIncrease ? "success.dark" : "error.dark"}>
                                    ₺{r.salePrice.toFixed(2)}
                                  </Typography>
                                </Box>
                              </Box>
                            ) : (
                              <Typography variant="body2" fontWeight={700}>
                                ₺{r.salePrice.toFixed(2)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {isError ? (
                              <Tooltip title={r.errorMessage || "Hatalı Satır"}>
                                <Chip label="Hata" size="small" color="error" sx={{ fontWeight: 700, height: 22 }} />
                              </Tooltip>
                            ) : !isSelected ? (
                              <Tooltip title="Bu ürün içe aktarma işlemine dahil edilmeyecek">
                                <Chip label="Hariç Tutuldu" size="small" variant="outlined" sx={{ fontWeight: 600, height: 22, color: "text.disabled", borderColor: "divider" }} />
                              </Tooltip>
                            ) : isNew ? (
                              <Chip label="Yeni" size="small" color="success" sx={{ fontWeight: 700, height: 22 }} />
                            ) : isExisting ? (
                              <Tooltip title={r.errorMessage || "Fiyat değişimi tespit edildi"}>
                                <Chip label="Fiyat Değişecek" size="small" color="warning" sx={{ fontWeight: 700, height: 22 }} />
                              </Tooltip>
                            ) : isUnchanged ? (
                              <Tooltip title="Fiyat sistemdeki mevcut fiyatla aynı">
                                <Chip label="Fiyatı Aynı" size="small" color="default" sx={{ fontWeight: 600, height: 22 }} />
                              </Tooltip>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {previewResult.errorCount > 0 && (
                <Alert severity="warning" sx={{ borderRadius: 2 }} icon={<WarningAmberOutlinedIcon />}>
                  Toplam <strong>{previewResult.errorCount}</strong> satırda hata tespit edildi (barkod veya fiyat okunamadı).
                  Yüklemeyi onaylarsanız hatalı satırlar atlanacak ve yalnızca geçerli satırlar işlenecektir.
                </Alert>
              )}
            </Stack>
          )}

          {/* ══════════════════════════════════════════════════════════════════
            ADIM 2: İŞLEM SONUCU
            ══════════════════════════════════════════════════════════════════ */}
          {step === 2 && commitResult && (
            <Stack spacing={3} alignItems="center" sx={{ py: 3 }}>
              <Box sx={{ p: 2, borderRadius: "50%", bgcolor: "success.50", color: "success.main" }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 64 }} />
              </Box>

              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h5" fontWeight={800}>
                  İçe Aktarma Tamamlandı!
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {file ? <strong>{file.name}</strong> : "Tedarikçi Excel"} dosyasındaki ürün ve fiyat güncellemeleri veritabanına başarıyla aktarıldı.
                </Typography>
              </Box>

              <Grid container spacing={2} sx={{ maxWidth: 520 }}>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: "center", borderRadius: 2, bgcolor: "success.50", borderColor: "success.main" }}>
                    <Typography variant="h4" fontWeight={800} color="success.main">{commitResult.insertedCount}</Typography>
                    <Typography variant="caption" color="success.dark" fontWeight={700}>Yeni Eklendi</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: "center", borderRadius: 2, bgcolor: "info.50", borderColor: "info.main" }}>
                    <Typography variant="h4" fontWeight={800} color="info.main">{commitResult.updatedCount}</Typography>
                    <Typography variant="caption" color="info.dark" fontWeight={700}>Fiyatı Güncellendi</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: "center", borderRadius: 2 }}>
                    <Typography variant="h4" fontWeight={800} color="text.secondary">{commitResult.skippedCount}</Typography>
                    <Typography variant="caption" color="text.secondary">Atlandı</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          {step === 0 && (
            <Button variant="outlined" onClick={handleClose} sx={{ borderRadius: 2 }}>
              İptal
            </Button>
          )}

          {step === 1 && (
            <>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => { setStep(0); setFile(null); setPreviewResult(null); setSelectedRowKeys(new Set()); }}
                disabled={isCommitting}
                sx={{ borderRadius: 2 }}
              >
                Farklı Dosya Seç
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleCommit}
                disabled={isCommitting || !previewResult || selectedCount === 0}
                startIcon={isCommitting ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlineIcon />}
                sx={{ borderRadius: 2, fontWeight: 700, px: 3 }}
              >
                {isCommitting
                  ? "Kaydediliyor..."
                  : `Yüklemeyi Onayla (${selectedCount} Ürün${selectedSheet ? ` — ${selectedSheet}` : ""})`}
              </Button>
            </>
          )}

          {step === 2 && (
            <Button variant="contained" color="primary" onClick={handleClose} sx={{ borderRadius: 2, px: 4, fontWeight: 700 }}>
              Tamam
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════
        ORİJİNAL EXCEL TABLOSU ÖNİZLEME PENCERESİ (İNDİRMEDEN İNCELEME)
        ══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={rawViewerOpen}
        onClose={() => setRawViewerOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: "92vh" } }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ bgcolor: "success.main", color: "common.white", borderRadius: 1.5, p: 0.75, display: "flex" }}>
              <TableChartOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
                Orijinal Excel Tablosu Önizleme
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {file?.name} • Boyut: {formatFileSize(file?.size)}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={() => setRawViewerOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Kontrol & Lejant Çubuğu */}
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "center" }}>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                {previewResult?.availableSheets && previewResult.availableSheets.length > 1 && (
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="raw-sheet-select-label">Görüntülenen Sayfa</InputLabel>
                    <Select
                      labelId="raw-sheet-select-label"
                      value={selectedSheet || previewResult.availableSheets[0] || ""}
                      label="Görüntülenen Sayfa"
                      onChange={(e) => handleSheetChange(e.target.value)}
                      disabled={isLoadingPreview}
                    >
                      {previewResult.availableSheets.map((s) => (
                        <MenuItem key={s} value={s}>
                          📄 <strong>{s}</strong>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <Typography variant="body2" color="text.secondary">
                  Sayfanın ilk <strong>{previewResult?.rawRows?.length ?? 0}</strong> satırı ham hücre biçiminde görüntülenmektedir.
                </Typography>
              </Stack>

              {/* Sütun Lejantı */}
              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  Eşleşen Sütunlar:
                </Typography>
                <Chip label="Barkod" size="small" color="primary" sx={{ height: 22, fontWeight: 700 }} />
                <Chip label="Ürün Adı" size="small" color="secondary" sx={{ height: 22, fontWeight: 700 }} />
                <Chip label="Satış Fiyatı" size="small" color="warning" sx={{ height: 22, fontWeight: 700 }} />
                {(purchasePriceCol ?? previewResult?.detectedColumns?.purchasePriceCol) && (
                  <Chip label="Alış Fiyatı" size="small" color="info" sx={{ height: 22, fontWeight: 700 }} />
                )}
              </Stack>
            </Stack>
          </Paper>

          {/* Excel Izgarası (Grid Table) */}
          {isLoadingPreview ? (
            <Box sx={{ p: 6, textAlign: "center" }}>
              <CircularProgress size={36} />
              <Typography variant="body2" sx={{ mt: 1.5 }}>
                Excel sayfası yükleniyor...
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 540, borderRadius: 2 }}>
              <Table size="small" stickyHeader sx={{ "& td, & th": { borderRight: 1, borderColor: "divider" } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, bgcolor: "grey.200", width: 55, textAlign: "center", color: "text.primary" }}>
                      #
                    </TableCell>
                    {(previewResult?.availableColumns ?? []).map((col) => {
                      const colIdx = col.index ?? (col as any).columnNumber;
                      const isBarcode = colIdx === (barcodeCol ?? previewResult?.detectedColumns?.barcodeCol);
                      const isName = colIdx === (nameCol ?? previewResult?.detectedColumns?.nameCol);
                      const isSale = colIdx === (salePriceCol ?? previewResult?.detectedColumns?.salePriceCol);
                      const isPurchase = colIdx === (purchasePriceCol ?? previewResult?.detectedColumns?.purchasePriceCol);

                      return (
                        <TableCell
                          key={colIdx}
                          sx={{
                            fontWeight: 800,
                            bgcolor: isBarcode ? "primary.50" : isName ? "secondary.50" : isSale ? "warning.50" : isPurchase ? "info.50" : "grey.100",
                            minWidth: 140,
                            textAlign: "left"
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            <Typography variant="body2" fontWeight={800}>
                              Sütun {col.letter}
                            </Typography>
                            {isBarcode && <Chip label="Barkod" size="small" color="primary" sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />}
                            {isName && <Chip label="Ürün Adı" size="small" color="secondary" sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />}
                            {isSale && <Chip label="Satış" size="small" color="warning" sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />}
                            {isPurchase && <Chip label="Alış" size="small" color="info" sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />}
                          </Stack>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(previewResult?.rawRows ?? []).map((row) => (
                    <TableRow key={row.rowNumber} hover>
                      <TableCell sx={{ fontWeight: 700, bgcolor: "grey.100", color: "text.secondary", textAlign: "center", userSelect: "none" }}>
                        {row.rowNumber}
                      </TableCell>
                      {row.cells.map((cellText, cellIdx) => {
                        const colNumber = previewResult?.availableColumns?.[cellIdx]?.index ?? (cellIdx + 1);
                        const isBarcode = colNumber === (barcodeCol ?? previewResult?.detectedColumns?.barcodeCol);
                        const isName = colNumber === (nameCol ?? previewResult?.detectedColumns?.nameCol);
                        const isSale = colNumber === (salePriceCol ?? previewResult?.detectedColumns?.salePriceCol);
                        const isPurchase = colNumber === (purchasePriceCol ?? previewResult?.detectedColumns?.purchasePriceCol);

                        return (
                          <TableCell
                            key={cellIdx}
                            sx={{
                              bgcolor: isBarcode ? "primary.50" : isName ? "secondary.50" : isSale ? "warning.50" : isPurchase ? "info.50" : undefined,
                              maxWidth: 280,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontFamily: isBarcode ? "monospace" : "inherit",
                              fontWeight: isBarcode || isSale ? 700 : 400
                            }}
                            title={cellText}
                          >
                            {cellText || <span style={{ color: "#bbb" }}>—</span>}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button
            variant="contained"
            onClick={() => setRawViewerOpen(false)}
            sx={{ borderRadius: 2, fontWeight: 700, px: 3 }}
          >
            Kapat
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
