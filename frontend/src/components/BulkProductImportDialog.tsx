import React, { useState, useRef, useCallback } from "react";
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
  Tooltip
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PostAddOutlinedIcon from "@mui/icons-material/PostAddOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { apiClient } from "../api/apiClient";
import {
  ProductImportPreviewResult,
  ProductImportPreviewItem,
  ProductImportCommitRequest,
  ProductImportResult
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
  const [duplicateAction, setDuplicateAction] = useState<"update" | "skip" | "fail">("update");
  const [filterStatus, setFilterStatus] = useState<"all" | "New" | "Existing" | "Error">("all");
  const [previewResult, setPreviewResult] = useState<ProductImportPreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<ProductImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep(0);
    setFile(null);
    setIsDragging(false);
    setIsLoadingPreview(false);
    setIsCommitting(false);
    setDuplicateAction("update");
    setFilterStatus("all");
    setPreviewResult(null);
    setCommitResult(null);
    setErrorMessage(null);
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

  // ─── 2. Dosya Yükle & Önizleme Al ──────────────────────────────────────
  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".xlsx")) {
      setErrorMessage("Lütfen yalnızca Excel (.xlsx) dosyası yükleyin.");
      return;
    }

    setFile(selectedFile);
    setErrorMessage(null);
    setIsLoadingPreview(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await apiClient.post<ProductImportPreviewResult>(
        "/products/import-preview",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setPreviewResult(res.data);
      setStep(1);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.error || "Excel dosyası analiz edilirken hata oluştu.");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  // ─── 3. Kaydet & Onayla ────────────────────────────────────────────────
  const handleCommit = async () => {
    if (!previewResult) return;

    // Hata olan satırları filtrele
    const validRows = previewResult.rows.filter(r => r.status !== "Error");
    if (validRows.length === 0) {
      setErrorMessage("Kaydedilebilecek geçerli ürün bulunamadı. Lütfen hataları düzeltin.");
      return;
    }

    if (duplicateAction === "fail" && previewResult.existingCount > 0) {
      setErrorMessage("Mevcut ürün davranışı 'Hata Ver' olarak seçildi ancak listede mevcut ürünler var.");
      return;
    }

    setIsCommitting(true);
    setErrorMessage(null);

    const payload: ProductImportCommitRequest = {
      duplicateAction,
      items: validRows.map(r => ({
        code: r.code,
        barcode: r.barcode,
        name: r.name,
        categoryName: r.categoryName || r.suggestedCategoryName || undefined,
        brandName: r.brandName || r.suggestedBrandName || undefined,
        unitCode: r.unitCode || "ADET",
        purchasePrice: r.purchasePrice,
        salePrice: r.salePrice,
        minStock: r.minStock,
        initialStock: r.initialStock
      }))
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

  // Filtrelenmiş önizleme satırları
  const displayedRows = (previewResult?.rows ?? []).filter(r => {
    if (filterStatus === "all") return true;
    return r.status === filterStatus;
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: "90vh" } }}
    >
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <PostAddOutlinedIcon color="primary" sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
              Excel ile Toplu Ürün Yükleme
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Yeni ürünleri sisteme aktarın veya mevcut ürünlerinizi güncelleyin
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
                    <InfoOutlinedIcon fontSize="small" /> Nasıl Çalışır?
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    1. Örnek Excel şablonunu indirin ve ürünlerinizi doldurun.<br />
                    2. <strong>Ürün Kodu</strong> zorunludur (barkod okuyucu ve ana tanımlayıcıdır).<br />
                    3. Kategori ve marka belirtmezseniz akıllı kural motorumuz ürün adından otomatik tamamlar.
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
                  {isDownloadingTemplate ? "İndiriliyor..." : "Örnek Şablonu İndir (.xlsx)"}
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
                    Excel dosyası taranıyor ve doğrulanıyor...
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Kodlar, barkodlar ve kural motoru eşleştirmeleri kontrol ediliyor.
                  </Typography>
                </Stack>
              ) : (
                <Stack spacing={1.5} alignItems="center">
                  <Box sx={{ p: 2, borderRadius: "50%", bgcolor: "primary.50", color: "primary.main", display: "inline-flex" }}>
                    <CloudUploadOutlinedIcon sx={{ fontSize: 48 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={700}>
                    Excel (.xlsx) dosyasını buraya sürükleyin
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    veya bilgisayarınızdan seçmek için tıklayın
                  </Typography>
                  <Chip label="Yalnızca .xlsx formatı" size="small" variant="outlined" sx={{ mt: 1 }} />
                </Stack>
              )}
            </Box>
          </Stack>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ADIM 1: ÖNİZLEME & ÇAKIŞMA AYARI
            ══════════════════════════════════════════════════════════════════ */}
        {step === 1 && previewResult && (
          <Stack spacing={2.5}>
            {/* İstatistik Rozetleri */}
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: 2 }}>
                  <Typography variant="h5" fontWeight={800}>{previewResult.totalRows}</Typography>
                  <Typography variant="caption" color="text.secondary">Toplam Satır</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: 2, bgcolor: "success.50", borderColor: "success.main" }}>
                  <Typography variant="h5" fontWeight={800} color="success.main">{previewResult.newCount}</Typography>
                  <Typography variant="caption" color="success.dark" fontWeight={700}>Yeni Eklenecek</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: 2, bgcolor: "warning.50", borderColor: "warning.main" }}>
                  <Typography variant="h5" fontWeight={800} color="warning.main">{previewResult.existingCount}</Typography>
                  <Typography variant="caption" color="warning.dark" fontWeight={700}>Sistemde Mevcut</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: 2, bgcolor: previewResult.errorCount > 0 ? "error.50" : undefined, borderColor: previewResult.errorCount > 0 ? "error.main" : "divider" }}>
                  <Typography variant="h5" fontWeight={800} color={previewResult.errorCount > 0 ? "error.main" : "text.secondary"}>
                    {previewResult.errorCount}
                  </Typography>
                  <Typography variant="caption" color={previewResult.errorCount > 0 ? "error.dark" : "text.secondary"} fontWeight={previewResult.errorCount > 0 ? 700 : 400}>
                    Hatalı Satır
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Mevcut Ürün Çakışma Davranışı Seçimi */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ fontWeight: 700, fontSize: "0.9rem", color: "text.primary", mb: 1 }}>
                  Mevcut Ürün Davranışı (Sistemde kayıtlı kod/barkod ile çakışırsa):
                </FormLabel>
                <RadioGroup
                  row
                  value={duplicateAction}
                  onChange={(e) => setDuplicateAction(e.target.value as any)}
                >
                  <FormControlLabel
                    value="update"
                    control={<Radio size="small" color="primary" />}
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={600}>Mevcut Olanları Güncelle</Typography>
                        <Typography variant="caption" color="text.secondary">Ad, barkod ve fiyatları Excel'deki verilerle günceller</Typography>
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
                        <Typography variant="caption" color="text.secondary">Mevcut ürünlere dokunmaz, yalnızca yenileri ekler</Typography>
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
                        <Typography variant="caption" color="text.secondary">Çakışma varsa işlemi tamamen iptal eder</Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>
            </Paper>

            {/* Tablo Filtreleri & Liste */}
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2" fontWeight={700}>
                Önizleme Listesi ({displayedRows.length} Satır Gösteriliyor)
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip
                  label="Tümü"
                  size="small"
                  variant={filterStatus === "all" ? "filled" : "outlined"}
                  color="default"
                  onClick={() => setFilterStatus("all")}
                />
                <Chip
                  label={`Yeni (${previewResult.newCount})`}
                  size="small"
                  variant={filterStatus === "New" ? "filled" : "outlined"}
                  color="success"
                  onClick={() => setFilterStatus("New")}
                />
                <Chip
                  label={`Mevcut (${previewResult.existingCount})`}
                  size="small"
                  variant={filterStatus === "Existing" ? "filled" : "outlined"}
                  color="warning"
                  onClick={() => setFilterStatus("Existing")}
                />
                {previewResult.errorCount > 0 && (
                  <Chip
                    label={`Hatalı (${previewResult.errorCount})`}
                    size="small"
                    variant={filterStatus === "Error" ? "filled" : "outlined"}
                    color="error"
                    onClick={() => setFilterStatus("Error")}
                  />
                )}
              </Stack>
            </Stack>

            {/* Önizleme Tablosu */}
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 350, borderRadius: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: 60 }}>Satır</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Ürün Kodu</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Barkod</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Ürün Adı</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Kategori</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Marka</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Alış</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Satış</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Stok</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 100 }} align="center">Durum</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedRows.map((r, idx) => {
                    const isNew = r.status === "New";
                    const isExisting = r.status === "Existing";
                    const isError = r.status === "Error";

                    return (
                      <TableRow
                        key={idx}
                        sx={{
                          bgcolor: isError ? "error.50" : isExisting ? "warning.50" : undefined,
                          "&:hover": { bgcolor: "action.hover" }
                        }}
                      >
                        <TableCell sx={{ color: "text.secondary" }}>{r.rowNumber}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{r.code || "—"}</TableCell>
                        <TableCell sx={{ color: "text.secondary" }}>{r.barcode || "—"}</TableCell>
                        <TableCell sx={{ maxWidth: 220 }}>
                          <Typography variant="body2" noWrap title={r.name}>
                            {r.name || "—"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {r.categoryName ? (
                            r.categoryName
                          ) : r.suggestedCategoryName ? (
                            <Tooltip title="Akıllı kural motoru tarafından otomatik tespit edildi">
                              <Chip label={r.suggestedCategoryName} size="small" color="info" variant="outlined" />
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.secondary">Genel</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.brandName ? (
                            r.brandName
                          ) : r.suggestedBrandName ? (
                            <Tooltip title="Akıllı kural motoru tarafından otomatik tespit edildi">
                              <Chip label={r.suggestedBrandName} size="small" color="secondary" variant="outlined" />
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.secondary">Genel</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">₺{r.purchasePrice.toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>₺{r.salePrice.toFixed(2)}</TableCell>
                        <TableCell align="right">{r.initialStock}</TableCell>
                        <TableCell align="center">
                          {isNew && <Chip label="Yeni" size="small" color="success" sx={{ fontWeight: 700 }} />}
                          {isExisting && (
                            <Tooltip title={r.errorMessage || "Sistemde zaten kayıtlı"}>
                              <Chip label="Mevcut" size="small" color="warning" sx={{ fontWeight: 700 }} />
                            </Tooltip>
                          )}
                          {isError && (
                            <Tooltip title={r.errorMessage || "Hata"}>
                              <Chip label="Hata" size="small" color="error" sx={{ fontWeight: 700 }} />
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {previewResult.errorCount > 0 && (
              <Alert severity="warning" sx={{ borderRadius: 2 }} icon={<WarningAmberOutlinedIcon />}>
                Toplam <strong>{previewResult.errorCount}</strong> satırda hata tespit edildi (zorunlu alan eksikliği veya geçersiz veri).
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
                Toplu Ürün Yükleme Tamamlandı!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Excel dosyanızdaki ürünler veritabanına başarıyla aktarıldı.
              </Typography>
            </Box>

            <Grid container spacing={2} sx={{ maxWidth: 500 }}>
              <Grid item xs={4}>
                <Paper variant="outlined" sx={{ p: 2, textAlign: "center", borderRadius: 2, bgcolor: "success.50", borderColor: "success.main" }}>
                  <Typography variant="h4" fontWeight={800} color="success.main">{commitResult.insertedCount}</Typography>
                  <Typography variant="caption" color="success.dark" fontWeight={700}>Yeni Eklendi</Typography>
                </Paper>
              </Grid>
              <Grid item xs={4}>
                <Paper variant="outlined" sx={{ p: 2, textAlign: "center", borderRadius: 2, bgcolor: "info.50", borderColor: "info.main" }}>
                  <Typography variant="h4" fontWeight={800} color="info.main">{commitResult.updatedCount}</Typography>
                  <Typography variant="caption" color="info.dark" fontWeight={700}>Güncellendi</Typography>
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
              onClick={() => { setStep(0); setFile(null); setPreviewResult(null); }}
              disabled={isCommitting}
              sx={{ borderRadius: 2 }}
            >
              Farklı Dosya Seç
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleCommit}
              disabled={isCommitting || !previewResult || (previewResult.newCount === 0 && previewResult.existingCount === 0)}
              startIcon={isCommitting ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlineIcon />}
              sx={{ borderRadius: 2, fontWeight: 700, px: 3 }}
            >
              {isCommitting
                ? "Kaydediliyor..."
                : `Yüklemeyi Onayla (${previewResult?.rows.filter(r => r.status !== "Error").length ?? 0} Ürün)`}
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
  );
};
