import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  MenuItem,
  Stack,
  LinearProgress,
  Skeleton,
  useTheme,
  alpha,
  Tooltip,
  IconButton,
  Collapse,
  Alert
} from "@mui/material";
import { apiClient } from "../api/apiClient";
import {
  StockSummaryReportDto,
  StockMovementReportDto,
  LowStockReportDto,
  LookupDto
} from "../api/types";

// Icons
import InventoryOutlinedIcon from "@mui/icons-material/InventoryOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";

const fmt = (amount: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);

const fmtQty = (qty: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(qty);

const fmtDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ─── Helper: Summary Card ───────────────────────────────────────────────────

function SummaryCard({ title, value, subtitle, icon, color, trend }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: "up" | "down" | "neutral";
}) {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: `1px solid ${alpha(color, 0.15)}`,
        background: `linear-gradient(135deg, ${alpha(color, 0.04)} 0%, ${alpha(color, 0.01)} 100%)`,
        transition: "all 0.3s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: `0 8px 25px ${alpha(color, 0.12)}`,
          borderColor: alpha(color, 0.3)
        }
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(color, 0.1),
            color: color,
            transition: "transform 0.3s ease",
            "&:hover": { transform: "scale(1.1)" }
          }}
        >
          {icon}
        </Box>
        {trend && (
          <Chip
            size="small"
            icon={trend === "up" ? <TrendingUpOutlinedIcon sx={{ fontSize: 14 }} /> : trend === "down" ? <TrendingDownOutlinedIcon sx={{ fontSize: 14 }} /> : undefined}
            label={trend === "up" ? "Artış" : trend === "down" ? "Azalış" : "Stabil"}
            color={trend === "up" ? "success" : trend === "down" ? "error" : "default"}
            variant="outlined"
            sx={{ height: 24, fontSize: "0.7rem", fontWeight: 600 }}
          />
        )}
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: "-0.03em", color: theme.palette.text.primary, mb: 0.3 }}>
        {value}
      </Typography>
      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 500 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" sx={{ color: alpha(color, 0.7), fontWeight: 600, mt: 0.5, display: "block" }}>
          {subtitle}
        </Typography>
      )}
    </Paper>
  );
}

// ─── Tab Panel ──────────────────────────────────────────────────────────────

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ pt: 3 }}>
      {value === index && children}
    </Box>
  );
}

// ─── Warehouse Distribution Bar ─────────────────────────────────────────────

function WarehouseDistributionChart({ data }: { data: StockSummaryReportDto["warehouseDistribution"] }) {
  const theme = useTheme();
  const maxValue = Math.max(...data.map(d => d.totalValue), 1);
  const colors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.error.main
  ];

  return (
    <Stack spacing={2}>
      {data.map((wh, i) => (
        <Box key={wh.warehouseId}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.8 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{wh.warehouseName}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {fmt(wh.totalValue)} · {fmtQty(wh.totalQuantity)} adet · {wh.productCount} ürün
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(wh.totalValue / maxValue) * 100}
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: alpha(colors[i % colors.length], 0.1),
              "& .MuiLinearProgress-bar": {
                borderRadius: 5,
                bgcolor: colors[i % colors.length],
                transition: "width 1s ease"
              }
            }}
          />
        </Box>
      ))}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STOCK SUMMARY TAB
// ═══════════════════════════════════════════════════════════════════════════════

function StockSummaryTab() {
  const theme = useTheme();
  const { data: summary, isLoading } = useQuery({
    queryKey: ["reports", "stock", "summary"],
    queryFn: () => apiClient.get<StockSummaryReportDto>("/reports/stock/summary").then(r => r.data)
  });

  if (isLoading || !summary) {
    return (
      <Grid container spacing={3}>
        {[1, 2, 3, 4].map(i => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3 }} />
          </Grid>
        ))}
        <Grid item xs={12}><Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} /></Grid>
      </Grid>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Summary Cards */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Toplam Ürün"
            value={summary.activeProductCount.toString()}
            subtitle={`${summary.totalProductCount} toplam (pasifler dahil)`}
            icon={<CategoryOutlinedIcon />}
            color={theme.palette.primary.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Toplam Stok Değeri"
            value={fmt(summary.totalStockValue)}
            icon={<AccountBalanceWalletOutlinedIcon />}
            color={theme.palette.success.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Kritik Stok"
            value={summary.criticalStockCount.toString()}
            subtitle="Min. seviye altında"
            icon={<WarningAmberOutlinedIcon />}
            color={theme.palette.warning.main}
            trend={summary.criticalStockCount > 0 ? "down" : "neutral"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Stokta Yok"
            value={summary.outOfStockCount.toString()}
            subtitle="Sıfır veya negatif stok"
            icon={<ErrorOutlineIcon />}
            color={theme.palette.error.main}
            trend={summary.outOfStockCount > 0 ? "down" : "neutral"}
          />
        </Grid>
      </Grid>

      {/* Warehouse Distribution */}
      {summary.warehouseDistribution.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: 1, borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <WarehouseOutlinedIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Depo Bazlı Dağılım</Typography>
          </Box>
          <WarehouseDistributionChart data={summary.warehouseDistribution} />
        </Paper>
      )}

      {/* Critical Stock Items Table */}
      {summary.criticalStockItems.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: 1, borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <WarningAmberOutlinedIcon sx={{ color: "warning.main" }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Kritik Stok Ürünleri</Typography>
            <Chip label={summary.criticalStockItems.length} size="small" color="warning" sx={{ fontWeight: 700 }} />
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Ürün Kodu</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Ürün Adı</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Barkod</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Depo</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Mevcut</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Min. Stok</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Doluluk</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.criticalStockItems.map((item, idx) => (
                  <TableRow key={idx} sx={{ "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.04) } }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }}>{item.productCode}</Typography>
                    </TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "monospace", color: "text.secondary" }}>{item.productBarcode}</Typography>
                    </TableCell>
                    <TableCell>{item.warehouseName}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={fmtQty(item.currentQuantity)}
                        size="small"
                        color={item.currentQuantity <= 0 ? "error" : "warning"}
                        variant="outlined"
                        sx={{ fontWeight: 700, minWidth: 60 }}
                      />
                    </TableCell>
                    <TableCell align="right">{fmtQty(item.minStock)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "flex-end" }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(item.stockRatio, 100)}
                          sx={{
                            width: 60,
                            height: 6,
                            borderRadius: 3,
                            bgcolor: alpha(item.stockRatio <= 50 ? theme.palette.error.main : theme.palette.warning.main, 0.1),
                            "& .MuiLinearProgress-bar": {
                              borderRadius: 3,
                              bgcolor: item.stockRatio <= 50 ? "error.main" : "warning.main"
                            }
                          }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 36, textAlign: "right" }}>
                          %{item.stockRatio}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STOCK MOVEMENT REPORT TAB
// ═══════════════════════════════════════════════════════════════════════════════

function StockMovementReportTab() {
  const theme = useTheme();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [movementType, setMovementType] = useState<string>("");
  const [showFilters, setShowFilters] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const { data: warehouses } = useQuery({
    queryKey: ["referenceData"],
    queryFn: () => apiClient.get("/referencedata").then(r => r.data?.warehouses as LookupDto[] ?? [])
  });

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = new Date(startDate).toISOString();
    if (endDate) params.endDate = new Date(endDate + "T23:59:59").toISOString();
    if (warehouseId) params.warehouseId = warehouseId;
    if (movementType) params.type = movementType;
    return params;
  }, [startDate, endDate, warehouseId, movementType]);

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["reports", "stock", "movements", queryParams],
    queryFn: () => apiClient.get<StockMovementReportDto>("/reports/stock/movements", { params: queryParams }).then(r => r.data)
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await apiClient.get("/reports/stock/movements/export", {
        params: { ...queryParams, format: "csv" },
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const contentDisposition = response.headers["content-disposition"];
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
        : `stok_hareketleri_${new Date().toISOString().split("T")[0]}.csv`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      console.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const movementTypes = [
    { value: "1", label: "Alış" },
    { value: "2", label: "Satış" },
    { value: "3", label: "İade (Giriş)" },
    { value: "4", label: "İade (Çıkış)" },
    { value: "5", label: "Sayım" },
    { value: "6", label: "Transfer (Giriş)" },
    { value: "7", label: "Transfer (Çıkış)" }
  ];

  return (
    <Stack spacing={3}>
      {/* Filters */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: 1, borderColor: "divider", overflow: "hidden" }}>
        <Box
          sx={{
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            "&:hover": { bgcolor: "action.hover" },
            transition: "background-color 0.2s"
          }}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <FilterAltOutlinedIcon sx={{ color: "primary.main" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Filtreler</Typography>
          </Box>
          <IconButton size="small">
            {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        <Collapse in={showFilters}>
          <Box sx={{ px: 2, pb: 2.5 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Başlangıç Tarihi"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Bitiş Tarihi"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Depo"
                  select
                  value={warehouseId}
                  onChange={e => setWarehouseId(e.target.value)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="">Tüm Depolar</MenuItem>
                  {warehouses?.map(w => (
                    <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Hareket Tipi"
                  select
                  value={movementType}
                  onChange={e => setMovementType(e.target.value)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="">Tüm Tipler</MenuItem>
                  {movementTypes.map(mt => (
                    <MenuItem key={mt.value} value={mt.value}>{mt.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Paper>

      {/* Action Bar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="Yenile">
            <IconButton onClick={() => refetch()} size="small" sx={{ bgcolor: "action.hover", borderRadius: 2 }}>
              <RefreshOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {report && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {report.totalMovementCount} hareket · {fmtDate(report.startDate)} – {fmtDate(report.endDate)}
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FileDownloadOutlinedIcon />}
          onClick={handleExport}
          disabled={isExporting || !report?.items.length}
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 600,
            px: 2.5,
            transition: "all 0.2s ease",
            "&:hover": { transform: "translateY(-1px)" }
          }}
        >
          {isExporting ? "Dışa Aktarılıyor..." : "CSV İndir"}
        </Button>
      </Box>

      {/* Type Summaries */}
      {report && report.typeSummaries.length > 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <SummaryCard
              title="Toplam Giriş"
              value={fmtQty(report.totalInboundQuantity)}
              icon={<TrendingUpOutlinedIcon />}
              color={theme.palette.success.main}
              trend="up"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <SummaryCard
              title="Toplam Çıkış"
              value={fmtQty(report.totalOutboundQuantity)}
              icon={<TrendingDownOutlinedIcon />}
              color={theme.palette.error.main}
              trend="down"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <SummaryCard
              title="Net Değişim"
              value={fmtQty(report.netQuantityChange)}
              icon={<InventoryOutlinedIcon />}
              color={report.netQuantityChange >= 0 ? theme.palette.success.main : theme.palette.error.main}
              trend={report.netQuantityChange >= 0 ? "up" : "down"}
            />
          </Grid>
        </Grid>
      )}

      {/* Type Distribution */}
      {report && report.typeSummaries.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: 1, borderColor: "divider" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Hareket Tipi Dağılımı</Typography>
          <Grid container spacing={2}>
            {report.typeSummaries.map(ts => (
              <Grid item xs={6} sm={4} md={3} key={ts.typeId}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: 1,
                    borderColor: "divider",
                    textAlign: "center",
                    transition: "all 0.2s ease",
                    "&:hover": { borderColor: "primary.main", transform: "translateY(-1px)" }
                  }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{ts.count}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{ts.typeName}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600, color: "primary.main" }}>{fmt(ts.totalValue)}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Movement Items Table */}
      {isLoading ? (
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      ) : report && report.items.length > 0 ? (
        <Paper elevation={0} sx={{ borderRadius: 3, border: 1, borderColor: "divider", overflow: "hidden" }}>
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Tarih</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Ürün Kodu</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Ürün Adı</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Depo</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Hareket Tipi</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Miktar</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Birim Fiyat</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Tutar</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper" }}>Durum</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.items.map(item => (
                  <TableRow
                    key={item.id}
                    sx={{
                      opacity: item.isCancelled ? 0.5 : 1,
                      "&:hover": { bgcolor: "action.hover" },
                      transition: "background-color 0.15s"
                    }}
                  >
                    <TableCell>
                      <Typography variant="caption" sx={{ fontWeight: 500 }}>{fmtDate(item.createdAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600 }}>{item.productCode}</Typography>
                    </TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.warehouseName}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.typeName}
                        size="small"
                        variant="outlined"
                        color={item.quantity > 0 ? "success" : "error"}
                        sx={{ fontWeight: 600, fontSize: "0.7rem" }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: item.quantity > 0 ? "success.main" : "error.main"
                        }}
                      >
                        {item.quantity > 0 ? "+" : ""}{fmtQty(item.quantity)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{fmt(item.unitPrice)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt(Math.abs(item.lineValue))}</Typography>
                    </TableCell>
                    <TableCell>
                      {item.isCancelled ? (
                        <Chip label="İptal" size="small" color="error" variant="filled" sx={{ fontSize: "0.68rem", fontWeight: 600 }} />
                      ) : (
                        <Chip label="Aktif" size="small" color="success" variant="outlined" sx={{ fontSize: "0.68rem", fontWeight: 600 }} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : (
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          Seçilen filtrelerle eşleşen stok hareketi bulunamadı.
        </Alert>
      )}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LOW STOCK TAB
// ═══════════════════════════════════════════════════════════════════════════════

function LowStockTab() {
  const theme = useTheme();
  const { data: report, isLoading } = useQuery({
    queryKey: ["reports", "stock", "low-stock"],
    queryFn: () => apiClient.get<LowStockReportDto>("/reports/stock/low-stock").then(r => r.data)
  });

  const alertConfig: Record<string, { label: string; color: "error" | "warning" | "info" | "success"; emoji: string }> = {
    out_of_stock: { label: "Stokta Yok", color: "error", emoji: "🔴" },
    critical: { label: "Kritik", color: "error", emoji: "🟠" },
    low: { label: "Düşük", color: "warning", emoji: "🟡" },
    warning: { label: "Uyarı", color: "info", emoji: "🔵" }
  };

  if (isLoading || !report) {
    return (
      <Stack spacing={3}>
        <Grid container spacing={2}>
          {[1, 2, 3].map(i => (
            <Grid item xs={12} sm={4} key={i}>
              <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Summary */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={4}>
          <SummaryCard
            title="Stokta Yok"
            value={report.outOfStockCount.toString()}
            icon={<ErrorOutlineIcon />}
            color={theme.palette.error.main}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <SummaryCard
            title="Kritik Seviye"
            value={report.criticalCount.toString()}
            subtitle="Min. stokun %50'si altında"
            icon={<WarningAmberOutlinedIcon />}
            color={theme.palette.warning.main}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <SummaryCard
            title="Toplam Uyarı"
            value={report.totalCount.toString()}
            subtitle="İzlenmesi gereken ürünler"
            icon={<InventoryOutlinedIcon />}
            color={theme.palette.info.main}
          />
        </Grid>
      </Grid>

      {/* Items Table */}
      {report.items.length > 0 ? (
        <Paper elevation={0} sx={{ borderRadius: 3, border: 1, borderColor: "divider", overflow: "hidden" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Seviye</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Ürün Kodu</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Ürün Adı</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Barkod</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Depo</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Mevcut</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Min. Stok</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Doluluk</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.items.map((item, idx) => {
                  const cfg = alertConfig[item.alertLevel] ?? alertConfig.warning;
                  return (
                    <TableRow
                      key={idx}
                      sx={{
                        "&:hover": { bgcolor: alpha(theme.palette[cfg.color].main, 0.04) },
                        transition: "background-color 0.15s"
                      }}
                    >
                      <TableCell>
                        <Chip
                          label={`${cfg.emoji} ${cfg.label}`}
                          size="small"
                          color={cfg.color}
                          variant="outlined"
                          sx={{ fontWeight: 700, fontSize: "0.7rem" }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600 }}>{item.productCode}</Typography>
                      </TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", color: "text.secondary" }}>{item.productBarcode}</Typography>
                      </TableCell>
                      <TableCell>{item.warehouseName}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: cfg.color + ".main" }}>
                          {fmtQty(item.currentQuantity)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{fmtQty(item.minStock)}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "flex-end" }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(Math.max(item.stockRatio, 0), 100)}
                            sx={{
                              width: 80,
                              height: 8,
                              borderRadius: 4,
                              bgcolor: alpha(theme.palette[cfg.color].main, 0.1),
                              "& .MuiLinearProgress-bar": {
                                borderRadius: 4,
                                bgcolor: `${cfg.color}.main`
                              }
                            }}
                          />
                          <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 40, textAlign: "right" }}>
                            %{item.stockRatio}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : (
        <Alert severity="success" sx={{ borderRadius: 3 }}>
          🎉 Tüm ürünlerin stok seviyeleri yeterli durumda!
        </Alert>
      )}
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN REPORTS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function ReportsPage() {
  const theme = useTheme();
  const [tabIndex, setTabIndex] = useState(0);

  return (
    <Box>
      {/* Tab Bar */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: 1,
          borderColor: "divider",
          mb: 3,
          overflow: "hidden"
        }}
      >
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 52,
            px: 1,
            "& .MuiTab-root": {
              minHeight: 52,
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.9rem",
              borderRadius: 2,
              mx: 0.5,
              transition: "all 0.2s ease",
              "&.Mui-selected": {
                fontWeight: 700,
                color: "primary.main"
              }
            },
            "& .MuiTabs-indicator": {
              height: 3,
              borderRadius: "3px 3px 0 0"
            }
          }}
        >
          <Tab
            label="Stok Özeti"
            icon={<InventoryOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
          />
          <Tab
            label="Hareket Raporu"
            icon={<TrendingUpOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
          />
          <Tab
            label="Düşük Stok"
            icon={<WarningAmberOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
          />
          {/* İleride buraya yeni tab'ler eklenecek: Satış Raporu, Müşteri Raporu vb. */}
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={tabIndex} index={0}>
        <StockSummaryTab />
      </TabPanel>
      <TabPanel value={tabIndex} index={1}>
        <StockMovementReportTab />
      </TabPanel>
      <TabPanel value={tabIndex} index={2}>
        <LowStockTab />
      </TabPanel>
    </Box>
  );
}
