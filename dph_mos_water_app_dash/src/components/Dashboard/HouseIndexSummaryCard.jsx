import React, { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Card,
  Typography,
  Modal,
  Fade,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Chip,
  Button,
} from "@mui/material";
import * as XLSX from "xlsx";

/* ================= CONFIG ================= */
const hiCards = [
  { key: "lt5", label: "House Index (< 5)", color: "#2E7D32", anim: "pulseLow" },
  { key: "gt5", label: "House Index (5–10)", color: "#F9A825", anim: "pulseLow" },
  { key: "gt10", label: "House Index (10–15)", color: "#EF6C00", anim: "pulseMedium" },
  { key: "gt15", label: "House Index (≥ 15)", color: "#C62828", anim: "pulseHigh" },
];

const HouseIndexSummary = () => {
  const [summary, setSummary] = useState({});
  const [hudMatrix, setHudMatrix] = useState({});
  const [details, setDetails] = useState([]);

  const [category, setCategory] = useState(null);
  const [hud, setHud] = useState(null);
  const [open, setOpen] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    load();
  }, [fromDate, toDate]);

  const load = async () => {
    const q =
      fromDate && toDate ? `?from_date=${fromDate}&to_date=${toDate}` : "";
    const res = await fetch(
      `http://localhost:3000/dashboard/house-index${q}`
    );
    const json = await res.json();

    setSummary(json.data.summary || {});
    setDetails(json.data.details || []);

    const matrix = {};
    const hudCounts = json.data.hud_counts || {};

    ["lt5", "gt5", "gt10", "gt15"].forEach((cat) => {
      Object.entries(hudCounts[cat] || {}).forEach(([hud, count]) => {
        if (!matrix[hud]) {
          matrix[hud] = { lt5: 0, gt5: 0, gt10: 0, gt15: 0, total: 0 };
        }
        matrix[hud][cat] += count;
        matrix[hud].total += count;
      });
    });

    setHudMatrix(matrix);
  };

  const filteredDetails = details.filter(
    (d) => d.category === category && (!hud || d.hud_name === hud)
  );

  /* ================= DOWNLOAD ================= */
  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();

    const hudRows = Object.entries(hudMatrix)
      .filter(([_, v]) => v[category] > 0)
      .map(([h, v]) => ({
        HUD: h,
        "<5": v.lt5,
        "5–10": v.gt5,
        "10–15": v.gt10,
        "≥15": v.gt15,
        Total: v[category],
      }));

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(hudRows),
      "HUD_Summary"
    );

    const detailRows = filteredDetails.map((d) => ({
      Date: d.date,
      HUD: d.hud_name,
      Block: d.block_name,
      PHC: d.phc_name,
      HI: d.hi,
      Category: d.category,
    }));

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(detailRows),
      "Details"
    );

    XLSX.writeFile(wb, `House_Index_${category}.xlsx`);
  };

  return (
    <Box>

      <Typography
        sx={{
          fontSize: 20,
          fontWeight: 800,
          mb: 2.5,
          color: "#1f2937",
          letterSpacing: "0.3px",
        }}
      >
        HI Index Summary
      </Typography>
      {/* ================= HI CARDS ================= */}
      <Grid container spacing={3}>
        {hiCards.map((c) => {
          const value = summary?.[c.key]?.count ?? 0;

          return (
            <Grid item xs={12} md={3} key={c.key}>
              <Card
                onClick={() => {
                  setCategory(c.key);
                  setHud(null);
                  setOpen(true);
                }}
                sx={{
                  width: "100%",
                  minWidth: 320,
                  height: 170,
                  p: 3,

                  cursor: "pointer",
                  background: "#ffffff",
                  borderRadius: "14px",                 // ✅ smooth corners

                  /* 🔹 Elegant left accent */
                  position: "relative",
                  overflow: "hidden",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "6px",
                    height: "100%",
                    backgroundColor: c.color,
                  },

                  /* 🔹 Soft premium shadow */
                  boxShadow: "0 6px 18px rgba(0,0,0,0.08)",

                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",

                  /* 🔹 Hover polish */
                  transition: "all 0.25s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 12px 28px rgba(0,0,0,0.14)",
                  },

                  /* 🔹 Controlled pulse */
                  animation:
                    value > 0 && c.anim
                      ? `${c.anim} 1.6s infinite`
                      : "none",
                }}
              >
                <Typography fontWeight={700} fontSize={15}>
                  {c.label}
                </Typography>

                <Typography
                  fontSize={42}
                  fontWeight={900}
                  color={c.color}
                >
                  {value}
                </Typography>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ================= MODAL ================= */}
      <Modal open={open} onClose={() => setOpen(false)}>
        <Fade in={open}>
          <Box
            sx={{
              width: 1150,
              mx: "auto",
              mt: 4,
              bgcolor: "#fff",
              borderRadius: 3,
            }}
          >
            <Box
              sx={{
                p: 2.5,
                bgcolor: "#C62828",
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography fontWeight={900}>
                House Index – {category?.toUpperCase()}
              </Typography>
              <Button
                variant="contained"
                color="success"
                onClick={downloadExcel}
              >
                Download Excel
              </Button>
            </Box>

            <Box sx={{ p: 2, display: "flex", gap: 2 }}>
              <TextField
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <TextField
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </Box>

            <Box sx={{ px: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["HUD", "<5", "5–10", "10–15", "≥15", "Total"].map(
                      (h) => (
                        <TableCell
                          key={h}
                          sx={{ fontWeight: 800 }}
                        >
                          {h}
                        </TableCell>
                      )
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(hudMatrix)
                    .filter(([_, v]) => v[category] > 0)
                    .map(([h, v]) => (
                      <TableRow
                        key={h}
                        hover
                        onClick={() => setHud(h)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>{h}</TableCell>
                        <TableCell>{v.lt5}</TableCell>
                        <TableCell>{v.gt5}</TableCell>
                        <TableCell>{v.gt10}</TableCell>
                        <TableCell>{v.gt15}</TableCell>
                        <TableCell>{v[category]}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Box>

            {hud && (
              <Box sx={{ p: 2, mt: 2 }}>
                <Typography fontWeight={800}>
                  Details – {hud}
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {["Date", "Block", "PHC", "HI"].map((h) => (
                        <TableCell
                          key={h}
                          sx={{ fontWeight: 700 }}
                        >
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDetails.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.date}</TableCell>
                        <TableCell>{r.block_name}</TableCell>
                        <TableCell>{r.phc_name}</TableCell>
                        <TableCell>
                          <Chip
                            label={r.hi}
                            color="error"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        </Fade>
      </Modal>

      {/* ================= ANIMATIONS ================= */}
      <style>{`
        @keyframes pulseLow {
          0% { box-shadow: 0 0 0 0 rgba(249,168,37,0.6); }
          70% { box-shadow: 0 0 0 18px rgba(249,168,37,0); }
        }
        @keyframes pulseMedium {
          0% { box-shadow: 0 0 0 0 rgba(239,108,0,0.7); }
          70% { box-shadow: 0 0 0 24px rgba(239,108,0,0); }
        }
        @keyframes pulseHigh {
          0% { box-shadow: 0 0 0 0 rgba(198,40,40,0.9); }
          50% { box-shadow: 0 0 0 30px rgba(198,40,40,0); }
        }
      `}</style>
    </Box>
  );
};

export default HouseIndexSummary;