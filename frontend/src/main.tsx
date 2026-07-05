import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  CssBaseline,
  Toolbar,
  Typography,
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
  useTheme,
  Chip,
  Tooltip
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
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";

import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { SalesPage } from "./pages/SalesPage";
import { StockMovementsPage } from "./pages/StockMovementsPage";
import { CustomersPage } from "./pages/CustomersPage";
import { WarehousesPage } from "./pages/WarehousesPage";
import { POSPage } from "./pages/POSPage";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/UsersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AppThemeProvider, useThemeMode } from "./theme/ThemeContext";
import "./styles.css";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import { CartProvider } from "./context/CartContext";
import { PrivateRoute } from "./auth/PrivateRoute";
import { LicenseProvider } from "./context/LicenseContext";
import { LicenseOverlay } from "./components/LicenseOverlay";

const queryClient = new QueryClient();
const SIDEBAR_WIDTH = 260;

// ─── Role badge helper ────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { label: string; color: "error" | "warning" | "info"; icon: React.ReactNode }> = {
    Admin: { label: "Admin", color: "error", icon: <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 12 }} /> },
    Manager: { label: "Yönetici", color: "warning", icon: <ManageAccountsOutlinedIcon sx={{ fontSize: 12 }} /> },
    Staff: { label: "Personel", color: "info", icon: <BadgeOutlinedIcon sx={{ fontSize: 12 }} /> }
  };
  const cfg = config[role] ?? config["Staff"];

  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size="small"
      icon={<>{cfg.icon}</>}
      sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, "& .MuiChip-icon": { ml: 0.5 }, paddingLeft: "2px" }}
    />
  );
}

function AllowedRolesRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// ─── Navigation Content ───────────────────────────────────────────────────────

function NavigationContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = [
    { to: "/", label: "Genel Bakış", icon: <DashboardOutlinedIcon /> },
    { to: "/products", label: "Ürünler", icon: <Inventory2OutlinedIcon /> },
    ...((user?.role === "Admin" || user?.role === "Manager")
      ? [{ to: "/sales", label: "Satışlar", icon: <MonetizationOnOutlinedIcon /> }]
      : []),
    { to: "/stock", label: "Stok Hareketleri", icon: <SwapHorizOutlinedIcon /> },
    ...((user?.role === "Admin" || user?.role === "Manager")
      ? [{ to: "/reports", label: "Raporlar", icon: <AssessmentOutlinedIcon /> }]
      : []),
    { to: "/customers", label: "Müşteriler", icon: <PeopleOutlinedIcon /> },
    { to: "/warehouses", label: "Depolar", icon: <BusinessOutlinedIcon /> },
    { to: "/pos", label: "POS Kasası", icon: <PointOfSaleIcon /> },
    ...(user?.role === "Admin"
      ? [{ to: "/users", label: "Personel", icon: <SupervisorAccountOutlinedIcon /> }]
      : []),
    { to: "/settings", label: "Ayarlar", icon: <SettingsOutlinedIcon /> }
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Brand header */}
      <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box
          component="img"
          src="/logo.png"
          alt="Nova Logo"
          sx={{
            width: 38,
            height: 38,
            objectFit: "contain",
            borderRadius: 1.5,
            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.4)"
          }}
        />
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
          Nova
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
                onClick={onClose}
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

      {/* Footer — User Info + Logout */}
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: "primary.main",
              fontSize: "0.9rem",
              fontWeight: 700
            }}
          >
            {user?.username?.charAt(0).toUpperCase() ?? "?"}
          </Avatar>
          <Box sx={{ overflow: "hidden", flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
              {user?.username ?? "Kullanıcı"}
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <RoleBadge role={user?.role ?? "Staff"} />
            </Box>
          </Box>
        </Box>

        <Tooltip title="Çıkış yap" placement="top">
          <Button
            id="logout-button"
            onClick={handleLogout}
            variant="outlined"
            color="error"
            size="small"
            startIcon={<LogoutOutlinedIcon />}
            fullWidth
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.8rem",
              py: 0.8,
              "&:hover": {
                bgcolor: "error.main",
                color: "#fff",
                borderColor: "error.main"
              },
              transition: "all 0.2s ease"
            }}
          >
            Çıkış Yap
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );
}

// ─── Main Layout (authenticated) ─────────────────────────────────────────────

function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));
  const { mode, toggleColorMode } = useThemeMode();

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/": return "Genel Bakış";
      case "/products": return "Ürün Kataloğu";
      case "/sales": return "Satış Yönetimi";
      case "/stock": return "Stok & Envanter Hareketleri";
      case "/customers": return "Müşteri Rehberi";
      case "/warehouses": return "Depo Yönetimi";
      case "/pos": return "POS Kasası";
      case "/reports": return "Raporlar";
      case "/users": return "Personel Yönetimi";
      case "/settings": return "Ayarlar";
      default: return "Nova";
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
          <NavigationContent onClose={() => setMobileOpen(false)} />
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
              <IconButton onClick={toggleColorMode} color="inherit">
                {mode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Dynamic Route Content */}
        <Box className="animate-fade-in" sx={{ py: 4, flexGrow: 1, display: "flex", flexDirection: "column", px: { xs: 2, sm: 3, xl: 4 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

function App() {
  return (
    <AppThemeProvider>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <LicenseProvider>
            <CartProvider>
              <LicenseOverlay />
              <Routes>
                {/* Public route — herkese açık */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected routes — JWT zorunlu */}
                <Route element={<PrivateRoute />}>
                  <Route element={<MainLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="products" element={<ProductsPage />} />
                    <Route path="sales" element={<AllowedRolesRoute roles={["Admin", "Manager"]}><SalesPage /></AllowedRolesRoute>} />
                    <Route path="stock" element={<StockMovementsPage />} />
                    <Route path="customers" element={<CustomersPage />} />
                    <Route path="warehouses" element={<WarehousesPage />} />
                    <Route path="pos" element={<POSPage />} />
                    <Route path="reports" element={<AllowedRolesRoute roles={["Admin", "Manager"]}><ReportsPage /></AllowedRolesRoute>} />
                    <Route path="users" element={<AllowedRolesRoute roles={["Admin"]}><UsersPage /></AllowedRolesRoute>} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>
                </Route>
              </Routes>
            </CartProvider>
          </LicenseProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .catch((err) => console.log("Service Worker registration failed: ", err));
  });
}
