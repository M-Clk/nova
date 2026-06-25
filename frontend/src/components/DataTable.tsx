import { ReactNode } from "react";
import { 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  useTheme 
} from "@mui/material";

export function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<ReactNode>> }) {
  const theme = useTheme();

  return (
    <TableContainer 
      component={Paper} 
      sx={{ 
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: theme.palette.mode === "dark" 
          ? "0 4px 20px rgba(0, 0, 0, 0.25)" 
          : "0 4px 20px rgba(100, 116, 139, 0.05)",
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Table size="medium">
        <TableHead>
          <TableRow sx={{ bgcolor: theme.palette.mode === "dark" ? "background.paper" : "#F8FAFC" }}>
            {columns.map((column) => (
              <TableCell 
                key={column}
                sx={{ 
                  fontWeight: 600, 
                  py: 1.8,
                  px: 2,
                  color: "text.primary",
                  fontSize: "0.875rem",
                  letterSpacing: "0.02em"
                }}
              >
                {column}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} align="center" sx={{ py: 6, color: "text.secondary" }}>
                No records found.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow 
                key={index}
                sx={{
                  "&:last-child td, &:last-child th": { border: 0 },
                  transition: "all 0.15s ease"
                }}
              >
                {row.map((cell, cellIndex) => (
                  <TableCell 
                    key={cellIndex}
                    sx={{ 
                      py: 1.5,
                      px: 2,
                      fontSize: "0.875rem",
                      color: "text.primary"
                    }}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
