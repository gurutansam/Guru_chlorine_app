import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  Toolbar,
  Tooltip,
  IconButton,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// Classification function
const classifyPpm = (ppmValue, samplingPoint) => {
  const raw = parseFloat(ppmValue);
  if (isNaN(raw)) return { ppm: 0, status: "Nil" };

  const norm = raw > 0 && raw < 0.1 ? 0 : Math.round(raw * 10) / 10;
  const s = (samplingPoint || "").toUpperCase();
  let status = "Nil";

  if (s === "TAIL" || s === "MID") {
    if (norm === 0) status = "Nil";
    else if (norm < 0.2) status = "Inadequate";
    else status = "Adequate";
  } else if (s === "OHT") {
    if (norm === 0) status = "Nil";
    else if (norm < 1) status = "Inadequate";
    else status = "Adequate";
  } else {
    status = norm === 0 ? "Nil" : "Adequate";
  }

  return { ppm: norm, status };
};

// Color map
const COLOR_MAP = {
  Adequate: "#2e7d32",
  Inadequate: "#ed6c02",
  Nil: "#c62828",
  Total: "#37474f",
};

// Date parsing helper (supports ISO & DD/MM/YYYY)
const parseDate = (value) => {
  if (!value || typeof value !== "string") return null;

  const v = value.trim();
  if (!v) return null;

  // 1️⃣ Handle DD/MM/YYYY (with optional time)
  if (v.includes("/")) {
    const [datePart, timePart] = v.split(",").map((s) => s.trim());
    const [dd, mm, yyyy] = datePart.split("/").map(Number);

    if (!dd || !mm || !yyyy) return null;

    if (timePart) {
      // Convert to MM/DD/YYYY for JS parsing
      const parsed = new Date(`${mm}/${dd}/${yyyy} ${timePart}`);
      return isNaN(parsed) ? null : parsed;
    }

    const parsed = new Date(yyyy, mm - 1, dd);
    return isNaN(parsed) ? null : parsed;
  }

  // 2️⃣ Handle ISO / SQL timestamps (YYYY-MM-DD HH:mm:ss)
  const parsed = new Date(v.replace(" ", "T"));
  return isNaN(parsed) ? null : parsed;
};

export default function PpmSummaryTable() {
  const [rows, setRows] = useState([]);
  const [hudBlocks, setHudBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHud, setSelectedHud] = useState(null);

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [fromDate, setFromDate] = useState(getTodayDateString());
  const [toDate, setToDate] = useState(getTodayDateString());

  const minDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const maxDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      const params = new URLSearchParams();
      if (fromDate) {
        const [yyyy, mm, dd] = fromDate.split('-');
        params.append("fromDate", `${dd}/${mm}/${yyyy}`);
      }
      if (toDate) {
        const [yyyy, mm, dd] = toDate.split('-');
        params.append("toDate", `${dd}/${mm}/${yyyy}`);
      }

      const [blocksRes, chlRes] = await Promise.all([
        fetch("http://localhost:3000/dashboard/hud-blocks"), //BLOCK 
        fetch(`http://localhost:3000/dashboard/chl_hud_datacollection?${params.toString()}`), //HUD
      ]);
      const blocksData = await blocksRes.json(); //BLOCK
      const chlData = await chlRes.json(); //HUD

      setHudBlocks(blocksData);
      setRows(chlData);
      setLoading(false);
    };
    fetchData();
  }, [fromDate, toDate]);

  // Filter rows by HUD/date
  const baseFilteredRows = useMemo(() => {
    return rows.filter((row) => {
      const date = parseDate(row.timestamp);

      // ✅ DEBUG LOG (ADD THIS)
      console.log("RAW:", row.timestamp, "→ PARSED:", date);

      if (!date) return false;

      // HUD filter
      if (selectedHud) {
        const block = hudBlocks.find((b) => b.block_id === row.block_id);
        if (!block || block.hud_id !== selectedHud) return false;
      }

      // Date filter (SAFE)
      const from = fromDate ? new Date(fromDate + "T00:00:00") : null;
      const to = toDate ? new Date(toDate + "T23:59:59") : null;

      if (from && date < from) return false;
      if (to && date > to) return false;

      return true;
    });
  }, [rows, hudBlocks, selectedHud, fromDate, toDate]);


  // Counts helper
  const getCounts = (data) => {
    const c = { Adequate: 0, Inadequate: 0, Nil: 0 };
    data.forEach((row) => {
      const { status } = classifyPpm(row.ppm, row.samplingPoint);
      c[status] += 1;
    });
    c.Total = c.Adequate + c.Inadequate + c.Nil;
    return c;
  };

  // HUD summary with exact counts
  const hudSummary = useMemo(() => {
    const grouped = {};
    baseFilteredRows.forEach((row) => {
      const block = hudBlocks.find((b) => b.block_id === row.block_id);
      if (!block) return;
      if (!grouped[block.hud_id]) grouped[block.hud_id] = { hud_name: block.hud_name, rows: [] };
      grouped[block.hud_id].rows.push(row);
    });

    return Object.entries(grouped).map(([hud_id, { hud_name, rows }]) => ({
      hud_id,
      hud_name,
      counts: getCounts(rows),
    }));
  }, [baseFilteredRows, hudBlocks]);

  // Block summary with exact counts
  const blockSummary = useMemo(() => {
    if (!selectedHud) return [];
    const blocks = hudBlocks.filter((b) => b.hud_id === selectedHud);

    return blocks
      .map((block) => {
        const blockRows = baseFilteredRows.filter((r) => r.block_id === block.block_id);
        if (blockRows.length === 0) return null; // skip empty blocks
        return {
          block_id: block.block_id,
          block_name: block.block_name,
          counts: getCounts(blockRows),
        };
      })
      .filter(Boolean);
  }, [selectedHud, baseFilteredRows, hudBlocks]);

  // Excel download
  const handleDownload = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("PPM Summary");

    const title = selectedHud ? "Block-wise PPM Abstract" : "HUD-wise PPM Abstract";
    sheet.addRow([title]);
    sheet.addRow([]);

    if (fromDate || toDate) {
      const dateText = `Date Range: ${fromDate || "N/A"} to ${toDate || "N/A"}`;
      sheet.addRow([dateText]);
      sheet.addRow([]);
    }

    const firstHeader = selectedHud ? "Block Name" : "HUD Name";
    const headers = [firstHeader, "Adequate", "Inadequate", "Nil", "Total"];
    const headerRow = sheet.addRow(headers);

    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF455A64" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    const data = selectedHud ? blockSummary : hudSummary;
    data.forEach((item) => {
      const row = sheet.addRow([
        selectedHud ? item.block_name : item.hud_name,
        item.counts.Adequate,
        item.counts.Inadequate,
        item.counts.Nil,
        item.counts.Total,
      ]);

      row.getCell(2).font = { bold: true, color: { argb: "FF2E7D32" } };
      row.getCell(3).font = { bold: true, color: { argb: "FFED6C02" } };
      row.getCell(4).font = { bold: true, color: { argb: "FFC62828" } };
      row.getCell(5).font = { bold: true, color: { argb: "FF37474F" } };

      row.alignment = { horizontal: "center", vertical: "middle" };
    });

    sheet.columns.forEach((col) => {
      let maxLength = 0;
      col.eachCell({ includeEmpty: true }, (cell) => {
        maxLength = Math.max(maxLength, cell.value ? cell.value.toString().length : 0);
      });
      col.width = maxLength + 4;
    });

    const buf = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `PPM_Summary_${selectedHud ? "Blocks" : "HUDs"}.xlsx`);
  };

  if (loading)
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={200}>
        <CircularProgress />
      </Box>
    );

  const renderTable = (items, type = "HUD") => (
    <TableContainer component={Paper} sx={{ width: "100%", mt: 2, borderRadius: 2, boxShadow: 4 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
            <TableCell sx={{ fontWeight: "bold" }}>
              {type === "HUD" ? "HUD Name" : "Block Name"}
            </TableCell>
            {["Adequate", "Inadequate", "Nil", "Total"].map((status) => (
              <TableCell
                key={status}
                sx={{ fontWeight: "bold", color: COLOR_MAP[status] }}
                align="center"
              >
                {status}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={type === "HUD" ? item.hud_id : item.block_id}
              hover={type === "HUD"}
              sx={{
                cursor: type === "HUD" ? "pointer" : "default",
                "&:hover": { backgroundColor: type === "HUD" ? "#e3f2fd" : "inherit" },
                transition: "all 0.2s ease-in-out",
              }}
              onClick={() => {
                if (type === "HUD") setSelectedHud(item.hud_id);
              }}
            >
              <TableCell sx={{ fontWeight: 600, display: "flex", alignItems: "center" }}>
                {type === "HUD" ? item.hud_name : item.block_name}
                {type === "HUD" && (
                  <Tooltip title="Click to view block summary">
                    <IconButton size="small" sx={{ ml: 1 }}>
                      <ChevronRightIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </TableCell>
              {["Adequate", "Inadequate", "Nil", "Total"].map((status) => (
                <TableCell key={status} align="center" sx={{ fontWeight: 600 }}>
                  {status !== "Total"
                    ? `${item.counts[status]} (${Math.round((item.counts[status] / item.counts.Total) * 100)}%)`
                    : item.counts[status]}
                </TableCell>
              ))}

            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box>
      <Toolbar sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: "bold" }}>
          {selectedHud ? "Block Abstract" : "HUD-wise PPM Abstract's"}
        </Typography>
        <Box display="flex" gap={2}>
          <TextField type="date" size="small" value={fromDate} onChange={(e) => setFromDate(e.target.value)} inputProps={{ min: minDate, max: maxDate }} />
          <TextField type="date" size="small" value={toDate} onChange={(e) => setToDate(e.target.value)} inputProps={{ min: minDate, max: maxDate }} />
          <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={handleDownload}>
            Download
          </Button>
        </Box>
      </Toolbar>

      {selectedHud ? (
        <>
          <Button variant="text" startIcon={<ArrowBackIcon />} sx={{ mb: 1 }} onClick={() => setSelectedHud(null)}>
            Back to HUDs
          </Button>
          {renderTable(blockSummary, "BLOCK")}
        </>
      ) : (
        renderTable(hudSummary, "HUD")
      )}
    </Box>
  );
}
