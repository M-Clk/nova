import { createTheme, PaletteMode } from "@mui/material";

export const getTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === "dark"
        ? {
            // Premium Slate Dark Mode
            background: {
              default: "#0B0F19",
              paper: "#111827"
            },
            primary: {
              main: "#6366F1", // Indigo
              light: "#818CF8",
              dark: "#4F46E5",
              contrastText: "#FFFFFF"
            },
            secondary: {
              main: "#EC4899", // Pink
              light: "#F472B6",
              dark: "#DB2777",
              contrastText: "#FFFFFF"
            },
            text: {
              primary: "#F3F4F6",
              secondary: "#9CA3AF"
            },
            divider: "rgba(255, 255, 255, 0.08)",
            success: {
              main: "#10B981" // Emerald
            },
            warning: {
              main: "#F59E0B" // Amber
            },
            error: {
              main: "#EF4444" // Rose
            }
          }
        : {
            // Premium Light Mode
            background: {
              default: "#F9FAFB",
              paper: "#FFFFFF"
            },
            primary: {
              main: "#4F46E5", // Indigo
              light: "#6366F1",
              dark: "#3730A3",
              contrastText: "#FFFFFF"
            },
            secondary: {
              main: "#DB2777", // Pink
              light: "#EC4899",
              dark: "#9D174D",
              contrastText: "#FFFFFF"
            },
            text: {
              primary: "#111827",
              secondary: "#4B5563"
            },
            divider: "rgba(0, 0, 0, 0.08)",
            success: {
              main: "#059669"
            },
            warning: {
              main: "#D97706"
            },
            error: {
              main: "#DC2626"
            }
          })
    },
    typography: {
      fontFamily: [
        "Outfit",
        "Inter",
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        "sans-serif"
      ].join(","),
      h1: { fontWeight: 800, letterSpacing: "-0.025em" },
      h2: { fontWeight: 800, letterSpacing: "-0.025em" },
      h3: { fontWeight: 700, letterSpacing: "-0.025em" },
      h4: { fontWeight: 700, letterSpacing: "-0.02em" },
      h5: { fontWeight: 700, letterSpacing: "-0.015em" },
      h6: { fontWeight: 600, letterSpacing: "-0.015em" },
      body1: { fontSize: "0.975rem", lineHeight: 1.5 },
      body2: { fontSize: "0.875rem", lineHeight: 1.43 },
      button: { fontWeight: 600, textTransform: "none" }
    },
    shape: {
      borderRadius: 12
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            padding: "8px 18px",
            boxShadow: "none",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
              transform: "translateY(-1px)"
            },
            "&:active": {
              transform: "translateY(0)"
            }
          },
          containedSecondary: {
            "&:hover": {
              boxShadow: "0 4px 12px rgba(236, 72, 153, 0.25)"
            }
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            boxShadow: mode === "dark" 
              ? "0 4px 20px -2px rgba(0, 0, 0, 0.3), 0 2px 8px -1px rgba(0, 0, 0, 0.2)"
              : "0 4px 20px -2px rgba(100, 116, 139, 0.08), 0 2px 8px -1px rgba(100, 116, 139, 0.04)",
            backgroundImage: "none",
            border: mode === "dark" 
              ? "1px solid rgba(255, 255, 255, 0.05)" 
              : "1px solid rgba(0, 0, 0, 0.03)"
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: mode === "dark" 
              ? "1px solid rgba(255, 255, 255, 0.06)" 
              : "1px solid rgba(0, 0, 0, 0.05)",
            padding: "12px 16px"
          },
          head: {
            fontWeight: 600,
            color: mode === "dark" ? "#F3F4F6" : "#111827",
            backgroundColor: mode === "dark" ? "#1F2937" : "#F3F4F6"
          }
        }
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: "background-color 0.15s ease",
            "&:hover": {
              backgroundColor: mode === "dark" 
                ? "rgba(255, 255, 255, 0.02) !important" 
                : "rgba(0, 0, 0, 0.015) !important"
            }
          }
        }
      },
      MuiTextField: {
        defaultProps: {
          variant: "outlined",
          size: "small"
        }
      },
      MuiSelect: {
        defaultProps: {
          size: "small"
        }
      }
    }
  });
