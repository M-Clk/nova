import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
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
  Button,
  CircularProgress,
  Skeleton
} from "@mui/material";
import { apiClient } from "../api/apiClient";
import { DashboardSummaryDto } from "../api/types";
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
  const divisor = Math.max(data.length - 1, 1);

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / divisor) * chartWidth;
    const y = paddingTop + chartHeight - (d.amount / maxAmount) * chartHeight;
    return { x, y, label: d.label, amount: d.amount };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : "";

  return (
    <Box sx={{ position: "relative", width: "100%", height: height + 20 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity="0.25" />
            <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity="0.0" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={theme.palette.primary.main} floodOpacity="0.3" />
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
        {areaPath && <path d={areaPath} fill="url(#salesGrad)" />}

        {/* Stroke Line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={theme.palette.primary.main}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

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
                x={p.x - chartWidth / divisor / 2}
                y={paddingTop}
                width={chartWidth / divisor}
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

              {/* Show all circles for small datasets, only show hovered circles for large datasets */}
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

      {hoveredIdx !== null && points[hoveredIdx] && (
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
  const { user } = useAuth();
  const isAdminOrManager = user?.role === "Admin" || user?.role === "Manager";
  const [period, setPeriod] = useState<7 | 14 | 30>(7);

  // Single fast, aggregated backend query for the entire dashboard
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["dashboard-summary", period],
    queryFn: async () => (await apiClient.get<DashboardSummaryDto>("/dashboard/summary", { params: { period } })).data,
    staleTime: 60_000
  });

  const categoryStockPanel = (height: number | string) => {
    const catData = dashboard?.categoryStockDistribution ?? [];
    return (
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
          {isLoading ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Box key={i}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Skeleton variant="text" width="45%" height={18} />
                    <Skeleton variant="text" width="25%" height={18} />
                  </Box>
                  <Skeleton variant="rectangular" width="100%" height={6} sx={{ borderRadius: 3 }} animation="wave" />
                </Box>
              ))}
            </Box>
          ) : catData.length === 0 ? (
            <Typography color="text.secondary">Stok kaydı bulunamadı.</Typography>
          ) : (
            catData.slice(0, 5).map((cat) => (
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
  };

  const lowStockPanel = (height: number | string) => {
    const lowStockAlerts = dashboard?.lowStockAlerts ?? [];
    const lowStockCount = dashboard?.lowStockCount ?? 0;
    return (
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
            label={`${lowStockCount} ürün`}
            color="error"
            size="small"
            sx={{ ml: "auto", fontWeight: 600, fontSize: "0.75rem" }}
          />
        </Box>
        <Divider />
        {isLoading ? (
          <Box sx={{ flex: 1, pt: 2 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, borderBottom: i < 3 ? "1px solid" : "none", borderColor: "divider" }}>
                <Skeleton variant="circular" width={28} height={28} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="60%" height={18} />
                  <Skeleton variant="text" width="40%" height={14} />
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Skeleton variant="text" width={50} height={18} />
                  <Skeleton variant="text" width={40} height={14} />
                </Box>
              </Box>
            ))}
          </Box>
        ) : lowStockAlerts.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography color="text.secondary">Tüm ürünlerin stok seviyesi yeterli.</Typography>
          </Box>
        ) : (
          <>
            <List sx={{ flex: 1, overflowY: "auto", maxH: 280 }}>
              {lowStockAlerts.map((item, idx) => (
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
                  {idx < lowStockAlerts.length - 1 && <Divider component="li" />}
                </Box>
              ))}
            </List>
            {lowStockCount > lowStockAlerts.length && (
              <Box sx={{ pt: 1, textAlign: "center", borderTop: "1px dashed", borderColor: "divider" }}>
                <Button
                  component={Link}
                  to="/reports"
                  size="small"
                  sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 600 }}
                >
                  Tüm Kritik Ürünleri Gör ({lowStockCount})
                </Button>
              </Box>
            )}
          </>
        )}
      </Paper>
    );
  };

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 1, letterSpacing: "-0.02em" }}>
          Hoş Geldiniz, {user?.username ?? "Kullanıcı"}!
        </Typography>
        <Typography color="text.secondary" variant="body1">
          Nova platformunun bugünkü durumuna genel bakış.
        </Typography>
      </Box>

      {/* Metrics Row */}
      <Grid container spacing={3}>
        {isAdminOrManager ? (
          <>
            <MetricCard
              title="Net Ciro"
              value={fmt(dashboard?.totalNetSales ?? 0)}
              subtitle="Toplam net kazanç"
              icon={<TrendingUpOutlinedIcon />}
              color="#10B981"
              bgColor="rgba(16, 185, 129, 0.08)"
              isLoading={isLoading}
            />
            <MetricCard
              title="Satış Siparişleri"
              value={dashboard?.totalSalesCount ?? 0}
              subtitle="Tamamlanan satış"
              icon={<ShoppingBagOutlinedIcon />}
              color="#EC4899"
              bgColor="rgba(236, 72, 153, 0.08)"
              isLoading={isLoading}
            />
            <MetricCard
              title="Envanter Maliyeti (Alış)"
              value={fmt(dashboard?.totalInventoryCost ?? 0)}
              subtitle={`${(dashboard?.totalStockQuantity ?? 0).toLocaleString("tr-TR")} adet ürün stokta`}
              icon={<AccountBalanceWalletOutlinedIcon />}
              color="#F59E0B"
              bgColor="rgba(245, 158, 11, 0.08)"
              isLoading={isLoading}
            />
            <MetricCard
              title="Ürün Kataloğu"
              value={dashboard?.totalProductsCount ?? 0}
              subtitle="Kayıtlı ürün çeşidi"
              icon={<Inventory2OutlinedIcon />}
              color="#6366F1"
              bgColor="rgba(99, 102, 241, 0.08)"
              isLoading={isLoading}
            />
          </>
        ) : (
          <>
            <MetricCard
              title="Toplam Stok"
              value={(dashboard?.totalStockQuantity ?? 0).toLocaleString("tr-TR")}
              subtitle="Depolardaki toplam fiziksel ürün"
              icon={<Inventory2OutlinedIcon />}
              color="#F59E0B"
              bgColor="rgba(245, 158, 11, 0.08)"
              gridWidth={6}
              isLoading={isLoading}
            />
            <MetricCard
              title="Ürün Kataloğu"
              value={dashboard?.totalProductsCount ?? 0}
              subtitle="Kayıtlı ürün çeşidi"
              icon={<CategoryOutlinedIcon />}
              color="#6366F1"
              bgColor="rgba(99, 102, 241, 0.08)"
              gridWidth={6}
              isLoading={isLoading}
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
                  {isLoading ? (
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                      <CircularProgress size={32} thickness={4} />
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>Veriler yükleniyor...</Typography>
                    </Box>
                  ) : (dashboard?.salesTrend ?? []).length === 0 ? (
                    <Typography color="text.secondary">Yeterli satış verisi yok.</Typography>
                  ) : (
                    <SalesTrendChart data={dashboard?.salesTrend ?? []} />
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
                {isLoading ? (
                  <Box sx={{ flex: 1, pt: 2 }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, borderBottom: i < 3 ? "1px solid" : "none", borderColor: "divider" }}>
                        <Skeleton variant="circular" width={28} height={28} />
                        <Box sx={{ flex: 1 }}>
                          <Skeleton variant="text" width="65%" height={18} />
                          <Skeleton variant="text" width="45%" height={14} />
                        </Box>
                        <Skeleton variant="text" width={50} height={18} />
                      </Box>
                    ))}
                  </Box>
                ) : (dashboard?.topSellingProducts ?? []).length === 0 ? (
                  <Box sx={{ py: 8, textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography color="text.secondary">Satış hareketi bulunamadı.</Typography>
                  </Box>
                ) : (
                  <List sx={{ flex: 1, overflowY: "auto", maxH: 280 }}>
                    {(dashboard?.topSellingProducts ?? []).map((prod, idx) => (
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
                        {idx < (dashboard?.topSellingProducts ?? []).length - 1 && <Divider component="li" />}
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
                {isLoading ? (
                  <Box sx={{ flex: 1, pt: 2 }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, borderBottom: i < 3 ? "1px solid" : "none", borderColor: "divider" }}>
                        <Box sx={{ flex: 1 }}>
                          <Skeleton variant="text" width="55%" height={18} />
                          <Skeleton variant="text" width="70%" height={14} />
                          <Skeleton variant="text" width="50%" height={14} />
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Skeleton variant="text" width={70} height={18} />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (dashboard?.recentSales ?? []).length === 0 ? (
                  <Box sx={{ py: 8, textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography color="text.secondary">Henüz satış kaydı bulunmuyor.</Typography>
                  </Box>
                ) : (
                  <List sx={{ flex: 1, overflowY: "auto", maxH: 280 }}>
                    {(dashboard?.recentSales ?? []).map((sale, idx) => (
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
                        {idx < (dashboard?.recentSales ?? []).length - 1 && <Divider component="li" />}
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
  isLoading?: boolean;
}

function MetricCard({ title, value, subtitle, icon, color, bgColor, gridWidth = 3, isLoading = false }: MetricCardProps) {
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
        <Box sx={{ flex: 1 }}>
          <Typography color="text.secondary" variant="body2" fontWeight={600} sx={{ mb: 1, textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
            {title}
          </Typography>
          {isLoading ? (
            <>
              <Skeleton variant="text" width="55%" height={52} sx={{ mb: 0, transform: "none", borderRadius: 1 }} animation="wave" />
              <Skeleton variant="text" width="70%" height={18} sx={{ mt: 0.5, borderRadius: 1 }} animation="wave" />
            </>
          ) : (
            <>
              <Typography variant="h3" fontWeight={850} sx={{ mb: 0.5, letterSpacing: "-0.03em" }}>
                {value}
              </Typography>
              <Typography color="text.secondary" variant="caption">
                {subtitle}
              </Typography>
            </>
          )}
        </Box>
        <Avatar
          sx={{
            bgcolor: bgColor,
            color: color,
            width: 48,
            height: 48,
            boxShadow: `0 2px 8px ${bgColor}`,
            opacity: isLoading ? 0.5 : 1,
            transition: "opacity 0.3s ease"
          }}
        >
          {icon}
        </Avatar>
      </Paper>
    </Grid>
  );
}
