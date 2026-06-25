import { useQuery } from "@tanstack/react-query";
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
  Chip
} from "@mui/material";
import { apiClient } from "../api/apiClient";
import { CurrentStockDto, ProductDto, SaleDto } from "../api/types";

// Icons
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

const fmt = (amount: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);

export function DashboardPage() {
  const theme = useTheme();
  
  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await apiClient.get<ProductDto[]>("/products")).data
  });
  const sales = useQuery({
    queryKey: ["sales"],
    queryFn: async () => (await apiClient.get<SaleDto[]>("/sales")).data
  });
  const stock = useQuery({
    queryKey: ["stock-current"],
    queryFn: async () => (await apiClient.get<CurrentStockDto[]>("/stock/current")).data
  });

  const netSales = sales.data?.reduce((sum, sale) => sum + sale.netAmount, 0) ?? 0;
  const totalStock = stock.data?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  // Calculate low stock products
  const lowStockItems = (products.data ?? []).map(p => {
    const stockItem = (stock.data ?? []).find(s => s.productCode === p.code);
    const quantity = stockItem ? stockItem.quantity : 0;
    return {
      ...p,
      currentStock: quantity
    };
  }).filter(p => p.currentStock < p.minStock);

  // Latest 5 sales
  const recentSales = [...(sales.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 1, letterSpacing: "-0.02em" }}>
          Hoş Geldiniz, Muhammed!
        </Typography>
        <Typography color="text.secondary" variant="body1">
          ERP sisteminizin bugünkü durumuna genel bakış.
        </Typography>
      </Box>

      {/* Metrics Row */}
      <Grid container spacing={3}>
        <MetricCard
          title="Ürün Kataloğu"
          value={products.data?.length ?? 0}
          subtitle="Kayıtlı ürün"
          icon={<Inventory2OutlinedIcon />}
          color="#6366F1"
          bgColor="rgba(99, 102, 241, 0.08)"
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
          title="Net Ciro"
          value={fmt(netSales)}
          subtitle="Toplam net kazanç"
          icon={<TrendingUpOutlinedIcon />}
          color="#10B981"
          bgColor="rgba(16, 185, 129, 0.08)"
        />
        <MetricCard
          title="Toplam Stok"
          value={totalStock.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          subtitle="Depolardaki toplam miktar"
          icon={<WarehouseOutlinedIcon />}
          color="#F59E0B"
          bgColor="rgba(245, 158, 11, 0.08)"
        />
      </Grid>

      {/* Sub-panels: Low Stock and Recent Sales */}
      <Grid container spacing={3}>
        {/* Low Stock Alerts */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: "100%", minHeight: 380, display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
              <Avatar sx={{ bgcolor: "error.light", width: 32, height: 32 }}>
                <WarningAmberOutlinedIcon sx={{ color: "error.main", fontSize: 18 }} />
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

            {lowStockItems.length === 0 ? (
              <Box sx={{ py: 8, textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography color="text.secondary">Tüm ürünlerin stok seviyesi yeterli.</Typography>
              </Box>
            ) : (
              <List sx={{ flex: 1, overflowY: "auto", maxH: 280 }}>
                {lowStockItems.map((item, idx) => (
                  <Box key={item.id}>
                    <ListItem sx={{ px: 0, py: 1.5 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: "action.hover", color: "text.primary" }}>
                          <Inventory2OutlinedIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={item.name}
                        secondary={`Kod: ${item.code} | Kategori: ${item.categoryName}`}
                        primaryTypographyProps={{ fontWeight: 600, fontSize: "0.925rem" }}
                      />
                      <Box sx={{ textAlign: "right", ml: 2 }}>
                        <Typography variant="body2" color="error.main" fontWeight={700}>
                          {item.currentStock} {item.unitName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
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
        </Grid>

        {/* Recent Sales Activity */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: "100%", minHeight: 380, display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
              <Avatar sx={{ bgcolor: "success.light", width: 32, height: 32 }}>
                <ShoppingBagOutlinedIcon sx={{ color: "success.main", fontSize: 18 }} />
              </Avatar>
              <Typography variant="h6" fontWeight={700}>
                Son Satışlar
              </Typography>
            </Box>
            
            <Divider />

            {recentSales.length === 0 ? (
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
                        secondary={new Date(sale.createdAt).toLocaleString("tr-TR")}
                        primaryTypographyProps={{ fontWeight: 600, fontSize: "0.925rem" }}
                      />
                      <Box sx={{ textAlign: "right", ml: 2 }}>
                        <Typography variant="body2" color="success.main" fontWeight={700}>
                          +{fmt(sale.netAmount)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Net Tutar
                        </Typography>
                      </Box>
                    </ListItem>
                    {idx < recentSales.length - 1 && <Divider component="li" />}
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
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
}

function MetricCard({ title, value, subtitle, icon, color, bgColor }: MetricCardProps) {
  const theme = useTheme();

  return (
    <Grid item xs={12} sm={6} md={3}>
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
