import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
  Snackbar,
  Collapse
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import TerminalIcon from "@mui/icons-material/Terminal";

import { getLogs, triggerTestLog } from "../api/logs";
import { SystemLogDto } from "../api/types";

// ─── Level chip config ────────────────────────────────────────────────────────
const getLevelConfig = (level: string | null) => {
  const lvl = level?.toUpperCase();
  switch (lvl) {
    case "WARNING":
      return {
        label: "Warning",
        color: "warning" as const,
        bg: "rgba(245, 158, 11, 0.12)",
        text: "#f59e0b",
        border: "1px solid rgba(245, 158, 11, 0.25)"
      };
    case "ERROR":
      return {
        label: "Error",
        color: "error" as const,
        bg: "rgba(239, 68, 68, 0.12)",
        text: "#ef4444",
        border: "1px solid rgba(239, 68, 68, 0.25)"
      };
    case "CRITICAL":
    case "FATAL":
      return {
        label: "Fatal",
        color: "error" as const,
        bg: "rgba(220, 38, 38, 0.2)",
        text: "#dc2626",
        border: "1px solid rgba(220, 38, 38, 0.4)",
        fontWeight: "bold"
      };
    default:
      return {
        label: level || "Info",
        color: "info" as const,
        bg: "rgba(59, 130, 246, 0.12)",
        text: "#3b82f6",
        border: "1px solid rgba(59, 130, 246, 0.25)"
      };
  }
};

// ─── Table Row Component with Expansion ───────────────────────────────────────
function LogRow({ log }: { log: SystemLogDto }) {
  const [open, setOpen] = useState(false);
  const cfg = getLevelConfig(log.level);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <>
      <TableRow 
        hover 
        onClick={() => setOpen(!open)}
        sx={{ 
          cursor: "pointer", 
          "& > *": { borderBottom: "unset" },
          bgcolor: open ? "action.hover" : "transparent"
        }}
      >
        <TableCell width={50}>
          <IconButton size="small">
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell width={120}>
          <Chip
            label={cfg.label}
            size="small"
            sx={{
              backgroundColor: cfg.bg,
              color: cfg.text,
              border: cfg.border,
              fontWeight: 700,
              fontSize: "0.72rem"
            }}
          />
        </TableCell>
        <TableCell width={200}>
          <Typography variant="body2" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
            {new Date(log.timestamp).toLocaleString()}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: "break-all" }}>
            {log.message}
          </Typography>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 3, px: 2, display: "flex", flexDirection: "column", gap: 2 }}>
              <Grid container spacing={3}>
                {log.messageTemplate && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Log Şablonu (Template)
                    </Typography>
                    <Box sx={{ p: 2, bgcolor: "action.disabledBackground", borderRadius: 1, fontFamily: "monospace", fontSize: "0.85rem" }}>
                      {log.messageTemplate}
                    </Box>
                  </Grid>
                )}

                {log.properties && log.properties !== "{}" && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Log Parametreleri (Structured Properties)
                    </Typography>
                    <Box sx={{ p: 2, bgcolor: "action.disabledBackground", borderRadius: 1, fontFamily: "monospace", fontSize: "0.85rem", overflowX: "auto" }}>
                      {log.properties}
                    </Box>
                  </Grid>
                )}

                {log.exception && (
                  <Grid item xs={12}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                      <Typography variant="subtitle2" color="error">
                        Hata Detayı (Exception Stack Trace)
                      </Typography>
                      <Tooltip title="Detayları Kopyala">
                        <IconButton size="small" onClick={() => handleCopy(log.exception || "")}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box 
                      sx={{ 
                        p: 2.5, 
                        bgcolor: "rgba(239, 68, 68, 0.05)", 
                        color: "error.main", 
                        border: "1px solid rgba(239, 68, 68, 0.15)",
                        borderRadius: 1, 
                        fontFamily: "Consolas, Monaco, monospace", 
                        fontSize: "0.82rem", 
                        whiteSpace: "pre-wrap", 
                        maxHeight: 400, 
                        overflowY: "auto" 
                      }}
                    >
                      {log.exception}
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export function SystemLogsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [level, setLevel] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [searchTemp, setSearchTemp] = useState<string>("");

  // Test Dialog State
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testLevel, setTestLevel] = useState("Warning");
  const [testMessage, setTestMessage] = useState("Test logu tetiklendi.");
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["logs", page, pageSize, level, search],
    queryFn: () => getLogs({ page: page + 1, pageSize, level, search }),
    placeholderData: (prev) => prev
  });

  const testLogMutation = useMutation({
    mutationFn: () => triggerTestLog(testLevel, testMessage),
    onSuccess: (res) => {
      setSnackbarMessage(res.message);
      setTestDialogOpen(false);
      // Log listesini yenile
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["logs"] });
      }, 500);
    },
    onError: (err: any) => {
      setSnackbarMessage("Test logu oluşturulamadı: " + (err.response?.data?.error || err.message));
    }
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSearch(searchTemp);
  };

  const handleLevelChange = (newLevel: string) => {
    setPage(0);
    setLevel(newLevel);
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Summary Stat Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              p: 3, 
              display: "flex", 
              alignItems: "center", 
              gap: 2.5, 
              borderRadius: 3,
              boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
              border: "1px solid",
              borderColor: "divider",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)"
            }}
          >
            <Box 
              sx={{ 
                p: 2, 
                borderRadius: "50%", 
                bgcolor: "primary.main", 
                color: "#fff",
                display: "flex",
                boxShadow: "0 8px 16px rgba(99, 102, 241, 0.3)"
              }}
            >
              <TerminalIcon />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>Total Log Kaydı</Typography>
              <Typography variant="h4" fontWeight={800}>{data?.totalCount ?? 0}</Typography>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Control Panel (Filters & Actions) */}
      <Paper 
        elevation={0}
        component="form" 
        onSubmit={handleSearchSubmit}
        sx={{ 
          p: 3, 
          borderRadius: 3, 
          border: "1px solid",
          borderColor: "divider",
          display: "flex", 
          flexWrap: "wrap", 
          gap: 2, 
          alignItems: "center"
        }}
      >
        <TextField
          placeholder="Log mesajı veya hata detayı ara..."
          size="small"
          value={searchTemp}
          onChange={(e) => setSearchTemp(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: searchTemp && (
              <InputAdornment position="end">
                <Button 
                  size="small" 
                  onClick={() => {
                    setSearchTemp("");
                    setSearch("");
                    setPage(0);
                  }}
                  sx={{ minWidth: 0, px: 1, py: 0.2 }}
                >
                  Temizle
                </Button>
              </InputAdornment>
            )
          }}
        />

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Seviye (LogLevel)</InputLabel>
          <Select
            value={level}
            label="Seviye (LogLevel)"
            onChange={(e) => handleLevelChange(e.target.value)}
          >
            <MenuItem value="">Tümü</MenuItem>
            <MenuItem value="Warning">Warning</MenuItem>
            <MenuItem value="Error">Error</MenuItem>
            <MenuItem value="Fatal">Fatal / Critical</MenuItem>
          </Select>
        </FormControl>

        <Button
          type="submit"
          variant="contained"
          size="medium"
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
        >
          Ara
        </Button>

        <Box sx={{ ml: "auto", display: "flex", gap: 1.5 }}>
          <Tooltip title="Test logu oluşturarak sistemi test edin">
            <Button
              variant="outlined"
              color="warning"
              size="medium"
              startIcon={<BugReportOutlinedIcon />}
              onClick={() => setTestDialogOpen(true)}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
            >
              Test Logu Tetikle
            </Button>
          </Tooltip>

          <IconButton onClick={handleRefresh} disabled={isLoading || isFetching}>
            {isFetching ? <CircularProgress size={24} /> : <RefreshIcon />}
          </IconButton>
        </Box>
      </Paper>

      {/* Logs Table */}
      {error ? (
        <Alert severity="error">
          Log verileri yüklenirken bir hata oluştu: {(error as any).message || error}
        </Alert>
      ) : (
        <TableContainer 
          component={Paper} 
          elevation={0}
          sx={{ 
            borderRadius: 3, 
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
          }}
        >
          <Table>
            <TableHead sx={{ bgcolor: "action.hover" }}>
              <TableRow>
                <TableCell width={50} />
                <TableCell><Typography variant="subtitle2" fontWeight={700}>Seviye</Typography></TableCell>
                <TableCell><Typography variant="subtitle2" fontWeight={700}>Tarih</Typography></TableCell>
                <TableCell><Typography variant="subtitle2" fontWeight={700}>Mesaj</Typography></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                    <CircularProgress size={40} />
                    <Typography sx={{ mt: 2 }} color="text.secondary">Loglar yükleniyor...</Typography>
                  </TableCell>
                </TableRow>
              ) : data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                    <Typography color="text.secondary">Aradığınız kriterlere uygun log kaydı bulunamadı.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={data?.totalCount ?? 0}
            page={page}
            rowsPerPage={pageSize}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Sayfa başına satır:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
          />
        </TableContainer>
      )}

      {/* Test Log Dialog */}
      <Dialog 
        open={testDialogOpen} 
        onClose={() => setTestDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Loglama Test Paneli</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1, minWidth: 320 }}>
          <Typography variant="body2" color="text.secondary">
            Veritabanı log yazımını ve arayüz gösterimini test etmek için anlık olarak backend üzerinden log uyarısı oluşturabilirsiniz.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Test Log Seviyesi</InputLabel>
            <Select
              value={testLevel}
              label="Test Log Seviyesi"
              onChange={(e) => setTestLevel(e.target.value)}
            >
              <MenuItem value="Warning">Warning (Sarı Uyarı)</MenuItem>
              <MenuItem value="Error">Error (Kırmızı Hata)</MenuItem>
              <MenuItem value="Critical">Critical (Fatal - Ölümcül Hata)</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Log Mesajı"
            size="small"
            fullWidth
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTestDialogOpen(false)} color="inherit" sx={{ textTransform: "none", fontWeight: 600 }}>
            İptal
          </Button>
          <Button 
            onClick={() => testLogMutation.mutate()} 
            variant="contained" 
            color="warning"
            disabled={testLogMutation.isPending}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
          >
            {testLogMutation.isPending ? "Tetikleniyor..." : "Log Tetikle"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar alerts */}
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setSnackbarMessage(null)} severity="info" variant="filled" sx={{ width: "100%", borderRadius: 2 }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
