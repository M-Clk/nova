import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Box, CircularProgress } from "@mui/material";

export function PrivateRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default"
        }}
      >
        <CircularProgress size={48} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Kiosk rolü: sadece /kiosk rotasına izin ver
  if (user?.role === "Kiosk" && location.pathname !== "/kiosk") {
    return <Navigate to="/kiosk" replace />;
  }

  // Diğer roller: /kiosk rotasına erişimi engelle
  if (user?.role !== "Kiosk" && location.pathname === "/kiosk") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
