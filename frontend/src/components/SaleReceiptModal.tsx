import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Typography,
  Divider,
  Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PrintIcon from "@mui/icons-material/Print";
import type { SaleDto } from "../api/types";

// ─── Şirket Bilgileri ─────────────────────────────────────────────────────────

export interface CompanyInfo {
  name: string;
  taxNo: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  receiptFooter: string;
}

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: "Şirket Adı",
  taxNo: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  receiptFooter: "Teşekkür ederiz, iyi günler dileriz.",
};

export function loadCompanyInfo(): CompanyInfo {
  try {
    const raw = localStorage.getItem("companyInfo");
    if (raw) return { ...DEFAULT_COMPANY_INFO, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_COMPANY_INFO;
}

// ─── Para formatı ─────────────────────────────────────────────────────────────

const fmt = (amount: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);

// ─── Bileşen ─────────────────────────────────────────────────────────────────

interface SaleReceiptModalProps {
  open: boolean;
  sale: SaleDto | null;
  onClose: () => void;
}

export function SaleReceiptModal({ open, sale, onClose }: SaleReceiptModalProps) {
  const company = loadCompanyInfo();
  const receiptRef = useRef<HTMLDivElement>(null);

  // Inject print styles once
  useEffect(() => {
    const styleId = "sale-receipt-print-style";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #sale-receipt-print-root { display: block !important; }
        @page { size: A4; margin: 15mm 12mm; }
      }
      #sale-receipt-print-root {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: white;
      }
    `;
    document.head.appendChild(style);
  }, []);

  if (!sale) return null;

  const saleDate = new Date(sale.createdAt).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handlePrint = () => {
    // Clone receipt into a dedicated print root
    let printRoot = document.getElementById("sale-receipt-print-root");
    if (!printRoot) {
      printRoot = document.createElement("div");
      printRoot.id = "sale-receipt-print-root";
      document.body.appendChild(printRoot);
    }

    if (receiptRef.current) {
      printRoot.innerHTML = receiptRef.current.innerHTML;
    }

    window.print();

    // Clean up after print dialog closes
    setTimeout(() => {
      if (printRoot) printRoot.innerHTML = "";
    }, 3000);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: "90vh",
        },
      }}
    >
      {/* Dialog Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <PrintIcon color="primary" fontSize="small" />
          <Typography fontWeight={700} variant="subtitle1">
            Satış Makbuzu
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            {sale.saleNo}
          </Typography>
        </Stack>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0, overflowY: "auto" }}>
        {/* ── Makbuz İçeriği (yazdırılacak alan) ── */}
        <Box
          ref={receiptRef}
          sx={{
            p: 4,
            fontFamily: "'Courier New', Courier, monospace",
            bgcolor: "background.paper",
            color: "text.primary",
            minHeight: 480,
          }}
        >
          {/* Şirket başlığı */}
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Typography
              sx={{
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: "1.15rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {company.name || "Şirket Adı"}
            </Typography>
            {company.taxNo && (
              <Typography sx={{ fontFamily: "inherit", fontSize: "0.78rem", mt: 0.3 }}>
                Vergi No: {company.taxNo}
              </Typography>
            )}
            {company.address && (
              <Typography sx={{ fontFamily: "inherit", fontSize: "0.78rem" }}>
                {company.address}
              </Typography>
            )}
            {(company.phone || company.email) && (
              <Typography sx={{ fontFamily: "inherit", fontSize: "0.78rem" }}>
                {[company.phone, company.email].filter(Boolean).join(" | ")}
              </Typography>
            )}
            {company.website && (
              <Typography sx={{ fontFamily: "inherit", fontSize: "0.78rem" }}>
                {company.website}
              </Typography>
            )}
          </Box>

          {/* Ayraç */}
          <Box sx={{ textAlign: "center", mb: 1.5 }}>
            <Typography sx={{ fontFamily: "inherit", fontSize: "0.8rem", letterSpacing: "0.05em" }}>
              ──────────────────────────
            </Typography>
            <Typography
              sx={{
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: "0.85rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              SATIŞ MAKBUZU
            </Typography>
            <Typography sx={{ fontFamily: "inherit", fontSize: "0.8rem", letterSpacing: "0.05em" }}>
              ──────────────────────────
            </Typography>
          </Box>

          {/* Sipariş bilgileri */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ fontFamily: "inherit", fontSize: "0.8rem" }}>
                Makbuz No:
              </Typography>
              <Typography sx={{ fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 700 }}>
                {sale.saleNo}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ fontFamily: "inherit", fontSize: "0.8rem" }}>
                Tarih / Saat:
              </Typography>
              <Typography sx={{ fontFamily: "inherit", fontSize: "0.8rem" }}>
                {saleDate}
              </Typography>
            </Box>
            {sale.customerName && (
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontFamily: "inherit", fontSize: "0.8rem" }}>
                  Müşteri:
                </Typography>
                <Typography sx={{ fontFamily: "inherit", fontSize: "0.8rem" }}>
                  {sale.customerName}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Ayraç */}
          <Divider sx={{ borderStyle: "dashed", mb: 1.5 }} />

          {/* Ürün Listesi Tablosu */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "inherit" }}>
            <thead>
              <tr style={{ borderBottom: "1px dashed #666" }}>
                <th style={{ textAlign: "left", paddingBottom: "6px", fontSize: "0.75rem", fontWeight: 700, opacity: 0.8 }}>ÜRÜN</th>
                <th style={{ textAlign: "right", paddingBottom: "6px", fontSize: "0.75rem", fontWeight: 700, opacity: 0.8, width: "50px" }}>ADET</th>
                <th style={{ textAlign: "right", paddingBottom: "6px", fontSize: "0.75rem", fontWeight: 700, opacity: 0.8, width: "80px" }}>BİRİM</th>
                <th style={{ textAlign: "right", paddingBottom: "6px", fontSize: "0.75rem", fontWeight: 700, opacity: 0.8, width: "90px" }}>TUTAR</th>
              </tr>
            </thead>
            <tbody>
              {(sale.items ?? []).map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px dotted #ccc" }}>
                  <td style={{ padding: "8px 0", verticalAlign: "top" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.3 }}>
                      {item.productName}
                    </div>
                    <div style={{ fontSize: "0.7rem", opacity: 0.6, marginTop: "2px" }}>
                      {item.productCode}
                    </div>
                  </td>
                  <td style={{ textAlign: "right", padding: "8px 0", verticalAlign: "top", fontSize: "0.8rem" }}>
                    {item.quantity}
                  </td>
                  <td style={{ textAlign: "right", padding: "8px 0", verticalAlign: "top", fontSize: "0.8rem" }}>
                    {fmt(item.unitPrice)}
                  </td>
                  <td style={{ textAlign: "right", padding: "8px 0", verticalAlign: "top", fontSize: "0.8rem", fontWeight: 600 }}>
                    {fmt(item.lineTotal)}
                    {item.discountAmount > 0 && (
                      <div style={{ fontSize: "0.7rem", opacity: 0.7, fontWeight: 400, marginTop: "2px" }}>
                        İnd:-{fmt(item.discountAmount)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Ayraç */}
          <Divider sx={{ borderStyle: "dashed", mt: 1.5, mb: 1.5 }} />

          {/* Toplamlar */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.4 }}>
              <Typography sx={{ fontFamily: "inherit", fontSize: "0.8rem", opacity: 0.75 }}>
                Ara Toplam:
              </Typography>
              <Typography sx={{ fontFamily: "inherit", fontSize: "0.8rem" }}>
                {fmt(sale.totalAmount)}
              </Typography>
            </Box>
            {sale.discountAmount > 0 && (
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.4 }}>
                <Typography sx={{ fontFamily: "inherit", fontSize: "0.8rem", opacity: 0.75 }}>
                  Toplam İndirim:
                </Typography>
                <Typography sx={{ fontFamily: "inherit", fontSize: "0.8rem" }}>
                  -{fmt(sale.discountAmount)}
                </Typography>
              </Box>
            )}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography
                sx={{
                  fontFamily: "inherit",
                  fontSize: "1rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                GENEL TOPLAM:
              </Typography>
              <Typography
                sx={{
                  fontFamily: "inherit",
                  fontSize: "1rem",
                  fontWeight: 700,
                }}
              >
                {fmt(sale.netAmount)}
              </Typography>
            </Box>
          </Box>

          {/* Footer */}
          {company.receiptFooter && (
            <Box sx={{ textAlign: "center", mt: 2 }}>
              <Divider sx={{ borderStyle: "dashed", mb: 1.5 }} />
              <Typography sx={{ fontFamily: "inherit", fontSize: "0.78rem", opacity: 0.7 }}>
                {company.receiptFooter}
              </Typography>
            </Box>
          )}

          {/* Alt bilgi — tarih damgası */}
          <Box sx={{ textAlign: "center", mt: 1.5 }}>
            <Typography sx={{ fontFamily: "inherit", fontSize: "0.7rem", opacity: 0.5 }}>
              Bu belge bilgi amaçlıdır, resmi fatura yerine geçmez.
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          gap: 1,
        }}
      >
        <Button variant="outlined" onClick={onClose} size="small">
          Kapat
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          size="small"
        >
          Yazdır
        </Button>
      </DialogActions>
    </Dialog>
  );
}
