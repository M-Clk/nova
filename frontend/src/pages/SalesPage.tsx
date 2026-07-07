import { FormEvent, useState, useEffect, useMemo } from "react";
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
  IconButton,
  Chip,
  InputAdornment,
  TablePagination,
  Autocomplete
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { apiClient } from "../api/apiClient";
import { ProductDto, ReferenceDataDto, SaleDto, CustomerDto, PaginatedListDto } from "../api/types";
import { DataTable } from "../components/DataTable";

const fmt = (amount: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);

export function SalesPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [unitPrice, setUnitPrice] = useState<number | "">("");

  // Search & Filter states
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // "all", "today", "week", "month"
  const [minAmount, setMinAmount] = useState<number | "">("");
  const [maxAmount, setMaxAmount] = useState<number | "">("");

  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, dateFilter, minAmount, maxAmount]);

  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await apiClient.get<ProductDto[]>("/products")).data
  });
  const references = useQuery({
    queryKey: ["reference-data"],
    queryFn: async () => (await apiClient.get<ReferenceDataDto>("/reference-data")).data
  });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await apiClient.get<CustomerDto[]>("/customers")).data
  });
  const sales = useQuery({
    queryKey: ["sales", page, rowsPerPage, search, dateFilter, minAmount, maxAmount],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedListDto<SaleDto>>("/sales", {
        params: {
          page: page + 1, // backend is 1-indexed
          pageSize: rowsPerPage,
          search: search || undefined,
          dateFilter: dateFilter !== "all" ? dateFilter : undefined,
          minAmount: minAmount !== "" ? minAmount : undefined,
          maxAmount: maxAmount !== "" ? maxAmount : undefined
        }
      });
      return response.data;
    }
  });

  // Set default warehouse
  useEffect(() => {
    if (references.data?.warehouses?.length) {
      setWarehouseId(prev => prev || references.data.warehouses[0].id);
    }
  }, [references.data]);

  // Update unitPrice when product is selected
  const handleProductChange = (prodId: string) => {
    setProductId(prodId);
    const selectedProd = products.data?.find(p => p.id === prodId);
    if (selectedProd) {
      setUnitPrice(selectedProd.salePrice);
    } else {
      setUnitPrice("");
    }
  };

  const create = useMutation({
    mutationFn: async () => {
      const itemPrice = unitPrice === "" ? null : Number(unitPrice);
      return apiClient.post("/sales", {
        customerId: customerId || null,
        warehouseId: warehouseId || null,
        items: [{ 
          productId, 
          quantity, 
          unitPrice: itemPrice, 
          discountAmount: Number(discountAmount) 
        }]
      });
    },
    onSuccess: () => {
      setProductId("");
      setCustomerId("");
      setQuantity(1);
      setDiscountAmount(0);
      setUnitPrice("");
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["stock-current"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  // Calculate estimated total
  const selectedProd = products.data?.find(p => p.id === productId);
  const currentPrice = unitPrice !== "" ? Number(unitPrice) : (selectedProd?.salePrice ?? 0);
  const subtotal = currentPrice * quantity;
  const netTotal = Math.max(0, subtotal - discountAmount);

  const handleClearFilters = () => {
    setSearch("");
    setDateFilter("all");
    setMinAmount("");
    setMaxAmount("");
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Satış Siparişleri
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Müşteri satışlarını kaydedin ve stok seviyelerini güncelleyin
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={isFormOpen ? <CloseIcon /> : <AddIcon />}
          onClick={() => setIsFormOpen(!isFormOpen)}
        >
          {isFormOpen ? "Vazgeç" : "Satış Oluştur"}
        </Button>
      </Box>

      {/* Form Card */}
      <Collapse in={isFormOpen}>
        <Paper component="form" onSubmit={submit} sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>
            Yeni Satış Siparişi Bilgileri
          </Typography>
          
          <Grid container spacing={3}>
            {/* Warehouse & Customer */}
            <Grid item xs={12} sm={6}>
              <TextField 
                select 
                label="Depo (Kaynak)" 
                value={warehouseId} 
                onChange={(e) => setWarehouseId(e.target.value)} 
                required
                fullWidth
              >
                {(references.data?.warehouses ?? []).map((w) => (
                  <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                select 
                label="Müşteri (Opsiyonel)" 
                value={customerId} 
                onChange={(e) => setCustomerId(e.target.value)} 
                fullWidth
              >
                <MenuItem value=""><em>Seçilmedi (Misafir Müşteri)</em></MenuItem>
                {(customers.data ?? []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Product selection & quantities */}
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                options={products.data ?? []}
                getOptionLabel={(option) => `${option.code} — ${option.name} (₺${option.salePrice.toFixed(2)})`}
                filterOptions={(options, state) => {
                  const search = state.inputValue.toLowerCase().trim();
                  if (!search) return options.slice(0, 50);
                  return options
                    .filter(
                      (o) =>
                        o.name.toLowerCase().includes(search) ||
                        o.code.toLowerCase().includes(search) ||
                        (o.barcode && o.barcode.toLowerCase().includes(search))
                    )
                    .slice(0, 50); // Limit to 50 options to prevent lag
                }}
                value={products.data?.find(p => p.id === productId) || null}
                onChange={(_, newValue) => {
                  if (newValue) {
                    handleProductChange(newValue.id);
                  } else {
                    setProductId("");
                    setUnitPrice("");
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Ürün Seç / Ara"
                    placeholder="Ürün adı, kod veya barkod yazın..."
                    required
                    fullWidth
                  />
                )}
                noOptionsText="Ürün bulunamadı"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField 
                label="Miktar" 
                type="number" 
                value={quantity} 
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} 
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                label="Birim Fiyat (₺)" 
                type="number" 
                value={unitPrice} 
                onChange={(e) => setUnitPrice(e.target.value === "" ? "" : Number(e.target.value))} 
                placeholder={selectedProd ? String(selectedProd.salePrice) : ""}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                label="İndirim Tutarı (₺)" 
                type="number" 
                value={discountAmount} 
                onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))} 
                fullWidth
              />
            </Grid>
          </Grid>

          {/* Pricing Preview Box */}
          {productId && (
            <Box 
              sx={{ 
                mt: 3, 
                p: 2, 
                borderRadius: 1.5, 
                bgcolor: "action.hover", 
                border: "1px dashed", 
                borderColor: "divider",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 2
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Ara Toplam: <strong>{fmt(subtotal)}</strong> | İndirim: <strong>-{fmt(discountAmount)}</strong>
              </Typography>
              <Typography variant="h6" fontWeight={800} color="primary.main">
                Net Toplam: {fmt(netTotal)}
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button variant="outlined" onClick={() => setIsFormOpen(false)}>
              Vazgeç
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={create.isPending || !productId || !references.data}
            >
              {create.isPending ? "İşleniyor..." : "Satışı Tamamla"}
            </Button>
          </Box>
        </Paper>
      </Collapse>

      {/* Filter Toolbar */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3.5}>
            <TextField
              placeholder="Sipariş no veya müşteri ara…"
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
              label="Tarih"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value="all">Tüm Tarihler</MenuItem>
              <MenuItem value="today">Bugün</MenuItem>
              <MenuItem value="week">Son 7 Gün</MenuItem>
              <MenuItem value="month">Son 30 Gün</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2.25}>
            <TextField
              label="Min. Tutar (₺)"
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value === "" ? "" : Number(e.target.value))}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2.25}>
            <TextField
              label="Max. Tutar (₺)"
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value === "" ? "" : Number(e.target.value))}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={12} md={1.5} sx={{ display: "flex", justifyContent: "flex-end" }}>
            {(search || dateFilter !== "all" || minAmount !== "" || maxAmount !== "") && (
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
        isLoading={sales.isLoading}
        columns={["Sipariş No", "Müşteri", "Toplam Tutar", "İndirim", "Net Tutar", "Tarih"]}
        rows={(sales.data?.items ?? []).map((s) => [
          <Typography variant="body2" fontWeight={700} color="primary.main">{s.saleNo}</Typography>,
          s.customerName ?? <span style={{ opacity: 0.6 }}>Misafir Müşteri</span>,
          fmt(s.totalAmount),
          fmt(s.discountAmount),
          <Typography variant="body2" fontWeight={700} color="success.main">{fmt(s.netAmount)}</Typography>,
          new Date(s.createdAt).toLocaleString("tr-TR")
        ])}
      />

      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={sales.data?.totalCount ?? 0}
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
    </Stack>
  );
}
