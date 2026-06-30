import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { 
  Grid, 
  Paper, 
  Stack, 
  Typography, 
  Box, 
  useTheme, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemAvatar, 
  Avatar, 
  Divider,
  Chip,
  Button
} from "@mui/material";
import { apiClient } from "../api/apiClient";
import { CurrentStockDto, ProductDto, SaleDto, StockMovementDto } from "../api/types";
import { useAuth } from "../auth/AuthContext";

// Icons
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import StarOutlineIcon from "@mui/icons-material/StarOutline";

const fmt = (amount: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);

// ─── Custom Interactive SVG Area Chart Component ──────────────────────────────
interface SalesTrendChartProps {
  data: Array<{ label: string; amount: number }>;
}

function SalesTrendChart({ data }: SalesTrendChartProps) {
  const theme = useTheme();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxAmount = Math.max(...data.map(d => d.amount), 100);
  const height = 180;
  const width = 500;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.amount / maxAmount) * chartHeight;
    return { x, y, label: d.label, amount: d.amount };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

  return (
    <Box sx={{ position: "relative", width: "100%", height: height + 20 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity="0.25" />
            <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity="0.0" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={theme.palette.primary.main} floodOpacity="0.3"/>
          </filter>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const y = paddingTop + chartHeight * ratio;
          const val = maxAmount * (1 - ratio);
          return (
            <g key={index}>
              <line 
                x1={paddingLeft} 
                y1={y} 
                x2={width - paddingRight} 
                y2={y} 
                stroke={theme.palette.divider} 
                strokeWidth={0.5} 
                strokeDasharray="4 4" 
              />
              <text 
                x={paddingLeft - 8} 
                y={y + 4} 
                fill={theme.palette.text.secondary} 
                fontSize={9} 
                fontWeight={500}
                textAnchor="end"
              >
                {fmt(val).replace(",00", "")}
              </text>
            </g>
          );
        })}

        {/* Fill Area */}
        <path d={areaPath} fill="url(#salesGrad)" />

        {/* Stroke Line */}
        <path 
          d={linePath} 
          fill="none" 
          stroke={theme.palette.primary.main} 
          strokeWidth={3} 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />

        {/* X Axis Labels (Filtered dynamically to avoid clutter) */}
        {points.map((p, i) => {
          let showLabel = false;
          if (data.length <= 7) {
            showLabel = true;
          } else if (data.length <= 15) {
            showLabel = i % 2 === 0 || i === data.length - 1;
          } else {
            showLabel = i % 5 === 0 || i === data.length - 1;
          }

          if (!showLabel) return null;

          return (
            <text 
              key={i} 
              x={p.x} 
              y={height - 8} 
              fill={theme.palette.text.secondary} 
              fontSize={10} 
              fontWeight={600}
              textAnchor="middle"
            >
              {p.label}
            </text>
          );
        })}

        {/* Hover Guides & Dots */}
        {points.map((p, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <g key={i}>
              <rect
                x={p.x - chartWidth / (data.length - 1) / 2}
                y={paddingTop}
                width={chartWidth / (data.length - 1)}
                height={chartHeight}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />

              {isHovered && (
                <line 
                  x1={p.x} 
                  y1={paddingTop} 
                  x2={p.x} 
                  y2={paddingTop + chartHeight} 
                  stroke={theme.palette.primary.main} 
                  strokeWidth={1} 
                  strokeDasharray="3 3"
                />
              )}

              {/* Show all circles for small datasets, only show hovered circles for large datasets to keep layout clean */}
              {(isHovered || data.length <= 7) && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : 4}
                  fill={isHovered ? theme.palette.primary.main : theme.palette.background.paper}
                  stroke={theme.palette.primary.main}
                  strokeWidth={isHovered ? 2 : 2.5}
                  filter={isHovered ? "url(#shadow)" : "none"}
                  style={{ pointerEvents: "none", transition: "all 0.15s ease" }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {hoveredIdx !== null && (
        <Paper
          elevation={4}
          sx={{
            position: "absolute",
            left: `${(points[hoveredIdx].x / width) * 100}%`,
            top: `${(points[hoveredIdx].y / height) * 100 - 25}%`,
            transform: "translate(-50%, -100%)",
            p: 1.2,
            px: 1.8,
            borderRadius: 2,
            pointerEvents: "none",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            zIndex: 10,
            whiteSpace: "nowrap",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            "&::after": {
              content: '""',
              position: "absolute",
              bottom: -5,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 10,
              height: 10,
              bgcolor: "background.paper",
              borderRight: "1px solid",
              borderBottom: "1px solid",
              borderColor: "divider"
            }
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.2 }}>
            {data[hoveredIdx].label}
          </Typography>
          <Typography variant="body2" color="primary.main" fontWeight={800}>
            {fmt(data[hoveredIdx].amount)}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────
export function DashboardPage() {
  const theme = useTheme();
  const { user } = useAuth();
  const isAdminOrManager = user?.role === "Admin" || user?.role === "Manager";
  const [period, setPeriod] = useState<7 | 14 | 30>(7);
  
  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await apiClient.get<ProductDto[]>("/products")).data
  });
  const sales = useQuery({
    queryKey: ["sales"],
    queryFn: async () => (await apiClient.get<SaleDto[]>("/sales")).data,
    enabled: isAdminOrManager
  });
  const stock = useQuery({
    queryKey: ["stock-current"],
    queryFn: async () => (await apiClient.get<CurrentStockDto[]>("/stock/current")).data
  });
  const movements = useQuery({
    queryKey: ["stock-movements"],
    queryFn: async () => (await apiClient.get<StockMovementDto[]>("/stock/movements")).data
  });

  // Calculate Net Sales
  const netSales = useMemo(() => {
    return sales.data?.reduce((sum, sale) => sum + sale.netAmount, 0) ?? 0;
  }, [sales.data]);

  // Calculate Total Quantity of Stock
  const totalStock = useMemo(() => {
    return stock.data?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  }, [stock.data]);

  // Calculate Total Stock Cost (Alış Envanter Maliyeti)
  const totalInventoryCost = useMemo(() => {
    if (!stock.data || !products.data) return 0;
    return stock.data.reduce((sum, item) => {
      const prod = products.data.find(p => p.code === item.productCode);
      if (prod) {
        return sum + (item.quantity * prod.purchasePrice);
      }
      return sum;
    }, 0);
  }, [stock.data, products.data]);

  // Calculate low stock products
  const lowStockItems = useMemo(() => {
    return (products.data ?? []).map(p => {
      const stockItem = (stock.data ?? []).find(s => s.productCode === p.code);
      const quantity = stockItem ? stockItem.quantity : 0;
      return {
        ...p,
        currentStock: quantity
      };
    }).filter(p => p.currentStock < p.minStock);
  }, [products.data, stock.data]);

  // Latest 5 sales
  const recentSales = useMemo(() => {
    return [...(sales.data ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 5);
  }, [sales.data]);

  // Top 5 selling products based on stock movements (type = 1 (Out/Sale), isCancelled = false)
  const topSellingProducts = useMemo(() => {
    if (!movements.data) return [];
    const salesMap: Record<string, { code: string; name: string; quantity: number; unitName: string; categoryName: string }> = {};
    
    movements.data.forEach(m => {
      if (m.type === 1 && !m.isCancelled) {
        const key = m.productCode;
        if (!salesMap[key]) {
          const prod = products.data?.find(p => p.code === m.productCode);
          salesMap[key] = {
            code: m.productCode,
            name: m.productName,
            quantity: 0,
            unitName: prod?.unitName ?? "Adet",
            categoryName: prod?.categoryName ?? "Genel"
          };
        }
        salesMap[key].quantity += m.quantity;
      }
    });

    return Object.values(salesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [movements.data, products.data]);

  // Stock quantity distribution by Category
  const categoryStockData = useMemo(() => {
    if (!stock.data || !products.data) return [];
    const catMap: Record<string, number> = {};
    stock.data.forEach(item => {
      const prod = products.data?.find(p => p.code === item.productCode);
      const cat = prod?.categoryName ?? "Diğer";
      catMap[cat] = (catMap[cat] ?? 0) + item.quantity;
    });

    const total = Object.values(catMap).reduce((sum, v) => sum + v, 0);
    return Object.entries(catMap)
      .map(([name, quantity]) => ({
        name,
        quantity,
        percentage: total > 0 ? (quantity / total) * 100 : 0
      }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [stock.data, products.data]);

  // Sales Trend dynamically calculated from selected period
  const salesTrendData = useMemo(() => {
    const daysCount = period;
    const lastDays = Array.from({ length: daysCount }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (daysCount - 1 - i));
      return d;
    });

    return lastDays.map(date => {
      const dateStr = date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
      const dateKey = date.toDateString();
      
      const daySales = (sales.data ?? []).filter(sale => {
        const saleDate = new Date(sale.createdAt);
        return saleDate.toDateString() === dateKey;
      });
      const totalAmount = daySales.reduce((sum, s) => sum + s.netAmount, 0);
      return {
        label: dateStr,
        amount: totalAmount
      };
    });
  }, [sales.data, period]);

  const categoryStockPanel = (height: number | string) => (
    <Paper sx={{ p: 3, display: "flex", flexDirection: "column", height, borderRadius: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Avatar 
          sx={{ 
            bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.08)", 
            width: 32, 
            height: 32 
          }}
        >
          <CategoryOutlinedIcon sx={{ color: (theme) => theme.palette.warning.main, fontSize: 18 }} />
        </Avatar>
        <Typography variant="h6" fontWeight={700}>
          Kategori Stok Dağılımı
        </Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
        {stock.isLoading || products.isLoading ? (
          <Typography color="text.secondary">Yükleniyor...</Typography>
        ) : categoryStockData.length === 0 ? (
          <Typography color="text.secondary">Stok kaydı bulunamadı.</Typography>
        ) : (
          categoryStockData.slice(0, 5).map((cat) => (
            <Box key={cat.name} sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: "60%" }}>{cat.name}</Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={700}>
                  {cat.quantity.toLocaleString("tr-TR")} ({cat.percentage.toFixed(0)}%)
                </Typography>
              </Box>
              <Box sx={{ width: "100%", height: 6, bgcolor: "action.hover", borderRadius: 3, overflow: "hidden" }}>
                <Box 
                  sx={{ 
                    width: `${cat.percentage}%`, 
                    height: "100%", 
                    borderRadius: 3,
                    background: (theme) => `linear-gradient(90deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.light} 100%)`,
                    transition: "width 1s ease" 
                  }} 
                />
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Paper>
  );

  const lowStockPanel = (height: number | string) => (
    <Paper sx={{ p: 3, height: "100%", minHeight: height, display: "flex", flexDirection: "column", borderRadius: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
        <Avatar 
          sx={{ 
            bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.08)", 
            width: 32, 
            height: 32 
          }}
        >
          <WarningAmberOutlinedIcon sx={{ color: (theme) => theme.palette.error.main, fontSize: 18 }} />
        </Avatar>
        <Typography variant="h6" fontWeight={700}>
          Düşük Stok Uyarıları
        </Typography>
        <Chip 
          label={`${lowStockItems.length} ürün`} 
          color="error" 
          size="small" 
          sx={{ ml: "auto", fontWeight: 600, fontSize: "0.75rem" }} 
        />
      </Box>
      <Divider />
      {products.isLoading || stock.isLoading ? (
        <Box sx={{ py: 8, textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography color="text.secondary">Yükleniyor...</Typography>
        </Box>
      ) : lowStockItems.length === 0 ? (
        <Box sx={{ py: 8, textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography color="text.secondary">Tüm ürünlerin stok seviyesi yeterli.</Typography>
        </Box>
      ) : (
        <List sx={{ flex: 1, overflowY: "auto", maxH: 280 }}>
          {lowStockItems.map((item, idx) => (
            <Box key={item.id}>
              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemAvatar sx={{ minWidth: 40 }}>
                  <Avatar sx={{ bgcolor: "action.hover", color: "text.primary", width: 28, height: 28 }}>
                    <Inventory2OutlinedIcon sx={{ fontSize: 16 }} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={item.name}
                  secondary={`Kategori: ${item.categoryName}`}
                  primaryTypographyProps={{ fontWeight: 600, fontSize: "0.875rem" }}
                  secondaryTypographyProps={{ fontSize: "0.75rem" }}
                />
                <Box sx={{ textAlign: "right", ml: 2 }}>
                  <Typography variant="body2" color="error.main" fontWeight={700}>
                    {item.currentStock} {item.unitName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                    Min: {item.minStock}
                  </Typography>
                </Box>
              </ListItem>
              {idx < lowStockItems.length - 1 && <Divider component="li" />}
            </Box>
          ))}
        </List>
      )}
    </Paper>
  );

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 1, letterSpacing: "-0.02em" }}>
          Hoş Geldiniz, {user?.username ?? "Kullanıcı"}!
        </Typography>
        <Typography color="text.secondary" variant="body1">
          Nirvana platformunun bugünkü durumuna genel bakış.
        </Typography>
      </Box>
 
      {/* Metrics Row */}
      <Grid container spacing={3}>
        {isAdminOrManager ? (
          <>
            <MetricCard
              title="Net Ciro"
              value={fmt(netSales)}
              subtitle="Toplam net kazanç"
              icon={<TrendingUpOutlinedIcon />}
              color="#10B981"
              bgColor="rgba(16, 185, 129, 0.08)"
            />
            <MetricCard
              title="Satış Siparişleri"
              value={sales.data?.length ?? 0}
              subtitle="Tamamlanan satış"
              icon={<ShoppingBagOutlinedIcon />}
              color="#EC4899"
              bgColor="rgba(236, 72, 153, 0.08)"
            />
            <MetricCard
              title="Envanter Maliyeti (Alış)"
              value={fmt(totalInventoryCost)}
              subtitle={`${totalStock.toLocaleString("tr-TR")} adet ürün stokta`}
              icon={<AccountBalanceWalletOutlinedIcon />}
              color="#F59E0B"
              bgColor="rgba(245, 158, 11, 0.08)"
            />
            <MetricCard
              title="Ürün Kataloğu"
              value={products.data?.length ?? 0}
              subtitle="Kayıtlı ürün çeşidi"
              icon={<Inventory2OutlinedIcon />}
              color="#6366F1"
              bgColor="rgba(99, 102, 241, 0.08)"
            />
          </>
        ) : (
          <>
            <MetricCard
              title="Toplam Stok"
              value={totalStock.toLocaleString("tr-TR")}
              subtitle="Depolardaki toplam fiziksel ürün"
              icon={<Inventory2OutlinedIcon />}
              color="#F59E0B"
              bgColor="rgba(245, 158, 11, 0.08)"
              gridWidth={6}
            />
            <MetricCard
              title="Ürün Kataloğu"
              value={products.data?.length ?? 0}
              subtitle="Kayıtlı ürün çeşidi"
              icon={<CategoryOutlinedIcon />}
              color="#6366F1"
              bgColor="rgba(99, 102, 241, 0.08)"
              gridWidth={6}
            />
          </>
        )}
      </Grid>

      {/* Main Panels & Charts */}
      {isAdminOrManager ? (
        <>
          {/* Charts Row */}
          <Grid container spacing={3}>
            {/* Sales Trend Chart */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, display: "flex", flexDirection: "column", height: 320, borderRadius: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Avatar 
                      sx={{ 
                        bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.08)", 
                        width: 32, 
                        height: 32 
                      }}
                    >
                      <TrendingUpOutlinedIcon sx={{ color: (theme) => theme.palette.primary.main, fontSize: 18 }} />
                    </Avatar>
                    <Typography variant="h6" fontWeight={700}>
                      Satış Ciro Trendi
                    </Typography>
                  </Box>

                  {/* Period Selector Buttons */}
                  <Box sx={{ display: "flex", gap: 0.5, bgcolor: "action.hover", p: 0.4, borderRadius: 2 }}>
                    {([7, 14, 30] as const).map((days) => (
                      <Button
                        key={days}
                        size="small"
                        onClick={() => setPeriod(days)}
                        variant={period === days ? "contained" : "text"}
                        color="primary"
                        sx={{
                          minWidth: 40,
                          height: 24,
                          borderRadius: 1.5,
                          textTransform: "none",
                          fontWeight: period === days ? 700 : 500,
                          fontSize: "0.75rem",
                          boxShadow: "none",
                          px: 1.5,
                          "&:hover": {
                            boxShadow: "none"
                          }
                        }}
                      >
                        {days} Gün
                      </Button>
                    ))}
                  </Box>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {sales.isLoading ? (
                    <Typography color="text.secondary">Yükleniyor...</Typography>
                  ) : salesTrendData.length === 0 ? (
                    <Typography color="text.secondary">Yeterli satış verisi yok.</Typography>
                  ) : (
                    <SalesTrendChart data={salesTrendData} />
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* Category Stock Distribution */}
            <Grid item xs={12} md={4}>
              {categoryStockPanel(320)}
            </Grid>
          </Grid>

          {/* Sub-panels: Top Selling, Recent Sales, Low Stock */}
          <Grid container spacing={3}>
            {/* Top Selling Products */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, height: "100%", minHeight: 380, display: "flex", flexDirection: "column", borderRadius: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(6, 182, 212, 0.15)" : "rgba(6, 182, 212, 0.08)", 
                      width: 32, 
                      height: 32 
                    }}
                  >
                    <StarOutlineIcon sx={{ color: (theme) => theme.palette.info?.main ?? "#06B6D4", fontSize: 18 }} />
                  </Avatar>
                  <Typography variant="h6" fontWeight={700}>
                    En Çok Satan Ürünler
                  </Typography>
                </Box>
                <Divider />
                {movements.isLoading ? (
                  <Box sx={{ py: 8, textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography color="text.secondary">Yükleniyor...</Typography>
                  </Box>
                ) : topSellingProducts.length === 0 ? (
                  <Box sx={{ py: 8, textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography color="text.secondary">Satış hareketi bulunamadı.</Typography>
                  </Box>
                ) : (
                  <List sx={{ flex: 1, overflowY: "auto", maxH: 280 }}>
                    {topSellingProducts.map((prod, idx) => (
                      <Box key={prod.code}>
                        <ListItem sx={{ px: 0, py: 1.5 }}>
                          <ListItemAvatar sx={{ minWidth: 40 }}>
                            <Avatar 
                              sx={{ 
                                bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(6, 182, 212, 0.15)" : "rgba(6, 182, 212, 0.08)", 
                                color: (theme) => theme.palette.info?.main ?? "#06B6D4", 
                                fontWeight: 700, 
                                fontSize: "0.85rem", 
                                width: 28, 
                                height: 28 
                              }}
                            >
                              {idx + 1}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={prod.name}
                            secondary={`Kategori: ${prod.categoryName}`}
                            primaryTypographyProps={{ fontWeight: 600, fontSize: "0.875rem" }}
                            secondaryTypographyProps={{ fontSize: "0.75rem" }}
                          />
                          <Box sx={{ textAlign: "right", ml: 2 }}>
                            <Typography variant="body2" color="info.main" fontWeight={700}>
                              {prod.quantity} {prod.unitName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                              Satış Adedi
                            </Typography>
                          </Box>
                        </ListItem>
                        {idx < topSellingProducts.length - 1 && <Divider component="li" />}
                      </Box>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>

            {/* Recent Sales Activity */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, height: "100%", minHeight: 380, display: "flex", flexDirection: "column", borderRadius: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.08)", 
                      width: 32, 
                      height: 32 
                    }}
                  >
                    <ShoppingBagOutlinedIcon sx={{ color: (theme) => theme.palette.success.main, fontSize: 18 }} />
                  </Avatar>
                  <Typography variant="h6" fontWeight={700}>
                    Son Satışlar
                  </Typography>
                </Box>
                <Divider />
                {sales.isLoading ? (
                  <Box sx={{ py: 8, textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography color="text.secondary">Yükleniyor...</Typography>
                  </Box>
                ) : recentSales.length === 0 ? (
                  <Box sx={{ py: 8, textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography color="text.secondary">Henüz satış kaydı bulunmuyor.</Typography>
                  </Box>
                ) : (
                  <List sx={{ flex: 1, overflowY: "auto", maxH: 280 }}>
                    {recentSales.map((sale, idx) => (
                      <Box key={sale.id}>
                        <ListItem sx={{ px: 0, py: 1.5 }}>
                          <ListItemText
                            primary={`Sipariş #${sale.saleNo}`}
                            secondary={
                              <Box component="span" sx={{ display: "flex", flexDirection: "column", mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                                  {new Date(sale.createdAt).toLocaleString("tr-TR")}
                                </Typography>
                                <Typography variant="caption" color="text.primary" fontWeight={600} sx={{ fontSize: "0.75rem", mt: 0.2 }}>
                                  Müşteri: {sale.customerName || "Misafir Müşteri"}
                                </Typography>
                              </Box>
                            }
                            primaryTypographyProps={{ fontWeight: 600, fontSize: "0.875rem" }}
                          />
                          <Box sx={{ textAlign: "right", ml: 2, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            <Typography variant="body2" color="success.main" fontWeight={700}>
                              +{fmt(sale.netAmount)}
                            </Typography>
                            {sale.discountAmount > 0 && (
                              <Typography variant="caption" color="text.secondary" sx={{ textDecoration: "line-through", fontSize: "0.7rem" }}>
                                {fmt(sale.totalAmount)}
                              </Typography>
                            )}
                          </Box>
                        </ListItem>
                        {idx < recentSales.length - 1 && <Divider component="li" />}
                      </Box>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>

            {/* Low Stock Alerts */}
            <Grid item xs={12} md={4}>
              {lowStockPanel(380)}
            </Grid>
          </Grid>
        </>
      ) : (
        /* Staff Dashboard View */
        <Grid container spacing={3}>
          {/* Category Stock Distribution */}
          <Grid item xs={12} md={6}>
            {categoryStockPanel(380)}
          </Grid>

          {/* Low Stock Alerts */}
          <Grid item xs={12} md={6}>
            {lowStockPanel(380)}
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  gridWidth?: number;
}

function MetricCard({ title, value, subtitle, icon, color, bgColor, gridWidth = 3 }: MetricCardProps) {
  const theme = useTheme();

  return (
    <Grid item xs={12} sm={6} md={gridWidth}>
      <Paper 
        className="metric-card"
        sx={{ 
          p: 3, 
          borderRadius: 2, 
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: theme.palette.mode === "dark" 
            ? `0 4px 20px rgba(0, 0, 0, 0.2)` 
            : `0 4px 20px rgba(100, 116, 139, 0.05)`,
        }}
      >
        <Box>
          <Typography color="text.secondary" variant="body2" fontWeight={600} sx={{ mb: 1, textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
            {title}
          </Typography>
          <Typography variant="h3" fontWeight={850} sx={{ mb: 0.5, letterSpacing: "-0.03em" }}>
            {value}
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {subtitle}
          </Typography>
        </Box>
        <Avatar 
          sx={{ 
            bgcolor: bgColor, 
            color: color, 
            width: 48, 
            height: 48,
            boxShadow: `0 2px 8px ${bgColor}`
          }}
        >
          {icon}
        </Avatar>
      </Paper>
    </Grid>
  );
}
