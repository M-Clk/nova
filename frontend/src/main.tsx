import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
  Toolbar,
  Typography,
  ThemeProvider,
  PaletteMode,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Divider,
  useMediaQuery,
  useTheme
} from "@mui/material";

// Icons
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";

import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { SalesPage } from "./pages/SalesPage";
import { StockMovementsPage } from "./pages/StockMovementsPage";
import { CustomersPage } from "./pages/CustomersPage";
import { WarehousesPage } from "./pages/WarehousesPage";
import { POSPage } from "./pages/POSPage";
import { getTheme } from "./theme";
import "./styles.css";

const queryClient = new QueryClient();
const SIDEBAR_WIDTH = 260;

function NavigationContent() {
  const location = useLocation();
  const menuItems = [
    { to: "/", label: "Genel Bakış", icon: <DashboardOutlinedIcon /> },
    { to: "/products", label: "Ürünler", icon: <Inventory2OutlinedIcon /> },
    { to: "/sales", label: "Satışlar", icon: <MonetizationOnOutlinedIcon /> },
    { to: "/stock", label: "Stok Hareketleri", icon: <SwapHorizOutlinedIcon /> },
    { to: "/customers", label: "Müşteriler", icon: <PeopleOutlinedIcon /> },
    { to: "/warehouses", label: "Depolar", icon: <BusinessOutlinedIcon /> },
    { to: "/pos", label: "POS Kasası", icon: <PointOfSaleIcon /> }
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Brand header */}
      <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar 
          sx={{ 
            bgcolor: "primary.main", 
            width: 38, 
            height: 38,
            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.4)" 
          }}
        >
          <Inventory2OutlinedIcon sx={{ color: "#fff", fontSize: 20 }} />
        </Avatar>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
          ERP System
        </Typography>
      </Box>
      
      <Divider sx={{ opacity: 0.5, my: 1 }} />

      {/* Nav List */}
      <List sx={{ px: 2, flex: 1 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <ListItem key={item.to} disablePadding sx={{ mb: 0.8 }}>
              <ListItemButton
                component={NavLink}
                to={item.to}
                sx={{
                  borderRadius: 2,
                  py: 1.2,
                  px: 2,
                  color: isActive ? "primary.main" : "text.secondary",
                  backgroundColor: isActive ? "action.selected" : "transparent",
                  fontWeight: isActive ? 600 : 500,
                  transition: "all 0.2s ease",
                  "&:hover": {
                    color: "primary.main",
                    backgroundColor: "action.hover",
                    "& .MuiListItemIcon-root": {
                      color: "primary.main",
                      transform: "scale(1.05)"
                    }
                  },
                  "& .MuiListItemIcon-root": {
                    color: isActive ? "primary.main" : "text.secondary",
                    minWidth: 40,
                    transition: "transform 0.2s ease"
                  }
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{ 
                    fontSize: "0.95rem", 
                    fontWeight: isActive ? 600 : 500 
                  }} 
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ opacity: 0.5, mt: "auto" }} />

      {/* Footer Info */}
      <Box sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36 }} src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" />
        <Box sx={{ overflow: "hidden" }}>
          <Typography variant="body2" sx={{ fontWeight: 600, noWrap: true }}>
            Muhammed Ada
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", noWrap: true }}>
            Yönetici
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function MainLayout({ toggleColorMode, mode }: { toggleColorMode: () => void; mode: PaletteMode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/": return "Genel Bakış";
      case "/products": return "Ürün Kataloğu";
      case "/sales": return "Satış Yönetimi";
      case "/stock": return "Stok & Envanter Hareketleri";
      case "/customers": return "Müşteri Rehberi";
      case "/warehouses": return "Depo Yönetimi";
      case "/pos": return "POS Kasası";
      default: return "ERP İşlemleri";
    }
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Drawer for Mobile */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: SIDEBAR_WIDTH, bgcolor: "background.paper" }
          }}
        >
          <NavigationContent />
        </Drawer>
      ) : (
        /* Sidebar for Desktop */
        <Box 
          component="nav" 
          sx={{ 
            width: SIDEBAR_WIDTH, 
            flexShrink: 0, 
            borderRight: 1, 
            borderColor: "divider",
            bgcolor: "background.paper" 
          }}
        >
          <NavigationContent />
        </Box>
      )}

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", bgcolor: "background.default", minWidth: 0 }}>
        {/* Header Bar */}
        <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", color: "text.primary" }}>
          <Toolbar sx={{ justifyContent: "space-between", px: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {isMobile && (
                <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 1 }}>
                  <MenuIcon />
                </IconButton>
              )}
              <Typography variant="h6" fontWeight={750} sx={{ letterSpacing: "-0.01em" }}>
                {getPageTitle()}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {/* Theme Toggle Button */}
              <IconButton onClick={toggleColorMode} color="inherit">
                {mode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Dynamic Route Content */}
        <Container maxWidth="xl" className="animate-fade-in" sx={{ py: 4, flexGrow: 1, display: "flex", flexDirection: "column" }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/stock" element={<StockMovementsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/warehouses" element={<WarehousesPage />} />
            <Route path="/pos" element={<POSPage />} />
          </Routes>
        </Container>
      </Box>
    </Box>
  );
}

function App() {
  const [mode, setMode] = useState<PaletteMode>(() => {
    const saved = localStorage.getItem("theme_mode");
    return (saved as PaletteMode) || "dark";
  });

  useEffect(() => {
    localStorage.setItem("theme_mode", mode);
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [mode]);

  const toggleColorMode = () => {
    setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
  };

  const theme = React.useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <MainLayout toggleColorMode={toggleColorMode} mode={mode} />
      </BrowserRouter>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
