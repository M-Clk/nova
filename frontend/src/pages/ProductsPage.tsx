import { FormEvent, useState, useEffect, useRef, useMemo } from "react";
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
  TablePagination
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { DataTable } from "../components/DataTable";
import { apiClient } from "../api/apiClient";
import { ProductDto, ReferenceDataDto, PaginatedListDto } from "../api/types";
import { useAuth } from "../auth/AuthContext";

export function ProductsPage() {
  const { user } = useAuth();
  const canManage = user?.role === "Admin" || user?.role === "Manager";
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Search and filter states
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, filterBrand, filterCategory, filterStatus]);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<ProductDto | null>(null);

  // Toast notification
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: "success" | "error" | "warning" }>({
    open: false,
    message: "",
    severity: "success"
  });

  const [isExporting, setIsExporting] = useState(false);

  // Keyboard shortcut for F2
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        if (!isFormOpen) {
          setIsFormOpen(true);
        }
        setTimeout(() => {
          barcodeInputRef.current?.focus();
        }, 100);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFormOpen]);
  
  const references = useQuery({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data
  });
  
  const products = useQuery({
    queryKey: ["products", page, rowsPerPage, search, filterBrand, filterCategory, filterStatus],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedListDto<ProductDto>>("/products", {
        params: {
          page: page + 1, // backend is 1-indexed
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

  const [form, setForm] = useState({ 
    code: "", 
    barcode: "", 
    name: "", 
    brandId: "", 
    categoryId: "", 
    unitId: "", 
    purchasePrice: 0, 
    salePrice: 0, 
    minStock: 0,
    isActive: true
  });

  // Automatically select the first items once reference data loads
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
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
        : `urunler_${new Date().toISOString().split("T")[0]}.csv`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSnack({ open: true, message: "Ürünler başarıyla indirildi.", severity: "success" });
    } catch (err) {
      console.error("Export failed", err);
      setSnack({ open: true, message: "Ürünler indirilirken hata oluştu.", severity: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  const resetForm = () => {
    setForm({
      code: "",
      barcode: "",
      name: "",
      brandId: references.data?.brands[0]?.id ?? "",
      categoryId: references.data?.categories[0]?.id ?? "",
      unitId: references.data?.units[0]?.id ?? "",
      purchasePrice: 0,
      salePrice: 0,
      minStock: 0,
      isActive: true
    });
    setEditingProductId(null);
    setIsFormOpen(false);
  };

  const create = useMutation({
    mutationFn: async () => {
      return apiClient.post("/products", {
        code: form.code,
        barcode: form.barcode,
        name: form.name,
        brandId: form.brandId,
        categoryId: form.categoryId,
        unitId: form.unitId,
        purchasePrice: form.purchasePrice,
        salePrice: form.salePrice,
        minStock: form.minStock
      });
    },
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSnack({ open: true, message: "Ürün başarıyla oluşturuldu.", severity: "success" });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || "Ürün eklenirken hata oluştu.";
      setSnack({ open: true, message: msg, severity: "error" });
    }
  });

  const update = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.put(`/products/${id}`, form);
    },
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSnack({ open: true, message: "Ürün başarıyla güncellendi.", severity: "success" });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || "Ürün güncellenirken hata oluştu.";
      setSnack({ open: true, message: msg, severity: "error" });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/products/${id}`);
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSnack({ open: true, message: "Ürün başarıyla silindi.", severity: "success" });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || "Ürün silinirken bir hata oluştu. Ürüne bağlı stok hareketleri olabilir.";
      setSnack({ open: true, message: msg, severity: "error" });
    }
  });

  function startEdit(product: ProductDto) {
    setEditingProductId(product.id);
    setForm({
      code: product.code,
      barcode: product.barcode || "",
      name: product.name,
      brandId: product.brandId,
      categoryId: product.categoryId,
      unitId: product.unitId,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      minStock: product.minStock,
      isActive: product.isActive
    });
    setIsFormOpen(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (editingProductId) {
      update.mutate(editingProductId);
    } else {
      create.mutate();
    }
  }

  const isPending = create.isPending || update.isPending;

  const handleClearFilters = () => {
    setSearch("");
    setFilterBrand("");
    setFilterCategory("");
    setFilterStatus("all");
  };

  return (
    <Stack spacing={3}>
      {/* Top Header Row */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Ürünler
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Stok kalemlerinizi ve fiyatlarınızı yönetin
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={handleExport}
            disabled={isExporting}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
              px: 2.5,
              py: 1.1,
              transition: "all 0.2s ease",
              "&:hover": { transform: "translateY(-1px)" }
            }}
          >
            {isExporting ? "Dışa Aktarılıyor..." : "CSV İndir"}
          </Button>
          {canManage && (
            <Button
              variant="contained"
              color={isFormOpen ? "secondary" : "primary"}
              startIcon={isFormOpen ? <CloseIcon /> : <AddIcon />}
              onClick={() => {
                if (isFormOpen) {
                  resetForm();
                } else {
                  setIsFormOpen(true);
                }
              }}
            >
              {isFormOpen ? "Vazgeç" : "Ürün Ekle"}
            </Button>
          )}
        </Stack>
      </Box>

      {/* Expandable Form Panel */}
      <Collapse in={isFormOpen}>
        <Paper component="form" onSubmit={submit} sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            {editingProductId ? "Ürün Bilgilerini Güncelle" : "Yeni Ürün Bilgileri"}
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                label="Ürün Kodu" 
                value={form.code} 
                onChange={(e) => setForm({ ...form, code: e.target.value })} 
                required 
                fullWidth 
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                label="Barkod" 
                inputRef={barcodeInputRef}
                value={form.barcode} 
                onChange={(e) => {
                  const val = e.target.value;
                  setForm(prev => {
                    const next = { ...prev, barcode: val };
                    if (!editingProductId) {
                      next.code = val;
                    }
                    return next;
                  });
                }} 
                fullWidth 
              />
            </Grid>
            <Grid item xs={12} sm={12} md={6}>
              <TextField 
                label="Ürün Adı" 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                required 
                fullWidth 
              />
            </Grid>

            {/* Lookup Selections */}
            <Grid item xs={12} sm={4}>
              <TextField 
                select 
                label="Marka" 
                value={form.brandId} 
                onChange={(e) => setForm({ ...form, brandId: e.target.value })} 
                required
                fullWidth
              >
                {(references.data?.brands ?? []).map((brand) => (
                  <MenuItem key={brand.id} value={brand.id}>{brand.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                select 
                label="Kategori" 
                value={form.categoryId} 
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })} 
                required
                fullWidth
              >
                {(references.data?.categories ?? []).map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                select 
                label="Ölçü Birimi" 
                value={form.unitId} 
                onChange={(e) => setForm({ ...form, unitId: e.target.value })} 
                required
                fullWidth
              >
                {(references.data?.units ?? []).map((unit) => (
                  <MenuItem key={unit.id} value={unit.id}>{unit.name}</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Financials & Stock */}
            <Grid item xs={12} sm={4} md={3}>
              <TextField 
                label="Alış Fiyatı (₺)" 
                type="number" 
                value={form.purchasePrice} 
                onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} 
                fullWidth 
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <TextField 
                label="Satış Fiyatı (₺)" 
                type="number" 
                value={form.salePrice} 
                onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })} 
                fullWidth 
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <TextField 
                label="Min. Stok Uyarısı" 
                type="number" 
                value={form.minStock} 
                onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} 
                fullWidth 
              />
            </Grid>
            
            {/* Status Select for Update Mode */}
            {editingProductId && (
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  select
                  label="Durum"
                  value={form.isActive ? "true" : "false"}
                  onChange={(e) => setForm({ ...form, isActive: e.target.value === "true" })}
                  fullWidth
                >
                  <MenuItem value="true">Aktif</MenuItem>
                  <MenuItem value="false">Pasif</MenuItem>
                </TextField>
              </Grid>
            )}
          </Grid>

          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button variant="outlined" onClick={resetForm}>
              Vazgeç
            </Button>
            <Button type="submit" variant="contained" disabled={isPending || !references.data}>
              {isPending ? "Kaydediliyor..." : (editingProductId ? "Ürünü Güncelle" : "Ürünü Kaydet")}
            </Button>
          </Box>
        </Paper>
      </Collapse>

      {/* Filter Toolbar */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              placeholder="Kod, ad veya barkod ile ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: "text.disabled" }} />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch("")}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <TextField
              select
              label="Marka"
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value=""><em>Tümü</em></MenuItem>
              {(references.data?.brands ?? []).map((b) => (
                <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <TextField
              select
              label="Kategori"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value=""><em>Tümü</em></MenuItem>
              {(references.data?.categories ?? []).map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <TextField
              select
              label="Durum"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value="all">Tümü (Durum)</MenuItem>
              <MenuItem value="active">Aktif</MenuItem>
              <MenuItem value="passive">Pasif</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={12} md={1.5} sx={{ display: "flex", justifyContent: "flex-end" }}>
            {(search || filterBrand || filterCategory || filterStatus !== "all") && (
              <Button 
                variant="text" 
                size="small" 
                startIcon={<ClearIcon />} 
                onClick={handleClearFilters}
                sx={{ textTransform: "none" }}
              >
                Temizle
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Data Table */}
      <DataTable
        isLoading={products.isLoading}
        columns={canManage ? ["Kod", "Barkod", "Ürün Adı", "Marka", "Kategori", "Birim", "Satış Fiyatı", "Durum", "İşlemler"] : ["Kod", "Barkod", "Ürün Adı", "Marka", "Kategori", "Birim", "Satış Fiyatı", "Durum"]}
        rows={(products.data?.items ?? []).map((p) => {
          const row = [
            <Typography variant="body2" fontWeight={700} color="primary.main">{p.code}</Typography>,
            p.barcode || <span style={{ opacity: 0.5 }}>-</span>,
            p.name,
            p.brandName,
            p.categoryName,
            p.unitName,
            <Typography variant="body2" fontWeight={600}>₺{p.salePrice.toFixed(2)}</Typography>,
            <Chip 
              label={p.isActive ? "Aktif" : "Pasif"} 
              color={p.isActive ? "success" : "default"} 
              size="small" 
              variant="outlined" 
              sx={{ fontWeight: 600 }}
            />
          ];
          if (canManage) {
            row.push(
              <Box sx={{ display: "flex", gap: 0.5 }}>
                <Tooltip title="Düzenle">
                  <IconButton color="primary" onClick={() => startEdit(p)} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Sil">
                  <IconButton color="error" onClick={() => setDeleteTarget(p)} size="small">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            );
          }
          return row;
        })}
      />

      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={products.data?.totalCount ?? 0}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        labelRowsPerPage="Sayfa başına satır:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Ürünü Sil</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{deleteTarget?.name}</strong> adlı ürünü silmek istediğinizden emin misiniz?
            Bu işlem geri alınamaz.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Not: Ürüne ait stok hareketleri veya faturalar varsa silme işlemi başarısız olacaktır.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>
            İptal
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={remove.isPending}
            onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
          >
            {remove.isPending ? "Siliniyor..." : "Evet, Sil"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar feedback */}
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
