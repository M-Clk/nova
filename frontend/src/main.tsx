import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
  Toolbar,
  Typography
} from "@mui/material";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { SalesPage } from "./pages/SalesPage";
import { StockMovementsPage } from "./pages/StockMovementsPage";
import { CustomersPage } from "./pages/CustomersPage";
import { WarehousesPage } from "./pages/WarehousesPage";
import "./styles.css";

const queryClient = new QueryClient();

function App() {
  const links = [
    ["/", "Dashboard"],
    ["/products", "Products"],
    ["/sales", "Sales"],
    ["/stock", "Stock Movements"],
    ["/customers", "Customers"],
    ["/warehouses", "Warehouses"]
  ];

  return (
    <BrowserRouter>
      <CssBaseline />
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar sx={{ gap: 2, flexWrap: "wrap" }}>
          <Inventory2OutlinedIcon />
          <Typography variant="h6" sx={{ fontWeight: 700, mr: 2 }}>
            ERP System
          </Typography>
          {links.map(([to, label]) => (
            <Button key={to} component={NavLink} to={to} size="small">
              {label}
            </Button>
          ))}
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/stock" element={<StockMovementsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/warehouses" element={<WarehousesPage />} />
        </Routes>
      </Container>
      <Box sx={{ height: 24 }} />
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
