import { FormEvent, useState, useEffect, useRef } from "react";
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
  IconButton
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import { DataTable } from "../components/DataTable";
import { apiClient } from "../api/apiClient";
import { ProductDto, ReferenceDataDto } from "../api/types";

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

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
    queryKey: ["products"],
    queryFn: async () => (await apiClient.get<ProductDto[]>("/products")).data
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
    }
  });

  const update = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.put(`/products/${id}`, form);
    },
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["products"] });
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

      {/* Data Table */}
      <DataTable
        columns={["Kod", "Barkod", "Ürün Adı", "Marka", "Kategori", "Birim", "Satış Fiyatı", "Durum", "İşlemler"]}
        rows={(products.data ?? []).map((p) => [
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
          />,
          <IconButton color="primary" onClick={() => startEdit(p)} size="small" title="Düzenle">
            <EditIcon fontSize="small" />
          </IconButton>
        ])}
      />
    </Stack>
  );
}

