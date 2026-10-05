import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  TextField,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  TablePagination,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import MapIcon from "@mui/icons-material/Map";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// Color mapping by sampling
const getColorBySampling = (value, sampling) => {
  const s = (sampling || "").toUpperCase();
  if (s === "TAIL" || s === "MID") {
    if (value === 0) return "red";
    if (value < 0.2) return "orange";
    return "green";
  } else if (s === "OHT" || s === "GLR" || s === "SUMP") {
    if (value === 0) return "red";
    if (value < 1) return "orange";
    return "green";
  }
  return "inherit";
};

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

// Status → color
const COLOR_MAP = {
  Adequate: "#43a047",
  Inadequate: "#fb8c00",
  Nil: "#e53935",
};

export default function PpmSummaryTable() {
  const [rows, setRows] = useState([]);
  const [hudList, setHudList] = useState([]);
  const [blockList, setBlockList] = useState([]);

  const [selectedHud, setSelectedHud] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("");

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [fromDate, setFromDate] = useState(getTodayDateString());
  const [toDate, setToDate] = useState(getTodayDateString());
  const [loading, setLoading] = useState(true);

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

  const [activeStatus, setActiveStatus] = useState("ALL");

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Image preview
  const [openImg, setOpenImg] = useState(false);
  const [imgSrc, setImgSrc] = useState("");

  useEffect(() => {
    const fetchHuds = async () => {
      const res = await fetch("http://localhost:3000/dashboard/hud");
      const data = await res.json();
      setHudList(data);
    };

    const fetchBlocks = async () => {
      const res = await fetch("http://localhost:3000/dashboard/hud-blocks");
      const data = await res.json();
      setBlockList(data);
    };

    const fetchData = async () => {
      const res = await fetch(
        "http://localhost:3000/dashboard/chl_hud_datacollection"
      );
      const data = await res.json();
      setRows(data);
      setLoading(false);
    };

    fetchHuds();
    fetchBlocks();
    fetchData();
  }, []);

  // Parse date helper
  const parseDate = (timestamp) => {
    if (!timestamp) return null;
    const parts = timestamp.split(",");
    const datePart = parts[0].trim();
    const [day, month, year] = datePart.split("/").map(Number);
    if (!day || !month || !year) return null;
    if (parts[1]) {
      return new Date(`${year}-${month}-${day} ${parts[1].trim()}`);
    } else {
      return new Date(year, month - 1, day);
    }
  };

  // Base filtered rows
  const baseFilteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedHud) {
        const hudBlocks = blockList
          .filter((b) => b.hud_id === selectedHud)
          .map((b) => b.block_id);
        if (!hudBlocks.includes(row.block_id)) return false;
      }
      if (selectedBlock && row.block_id !== selectedBlock) return false;
      if (fromDate || toDate) {
        const date = parseDate(row.timestamp);
        if (!date) return false;
        const from = fromDate ? new Date(fromDate) : null;
        const to = toDate ? new Date(toDate) : null;
        if (from && to && from.toDateString() === to.toDateString()) {
          return date.toDateString() === from.toDateString();
        }
        if (from && date < from) return false;
        if (to) {
          const toEnd = new Date(to);
          toEnd.setHours(23, 59, 59, 999);
          if (date > toEnd) return false;
        }
      }
      return true;
    });
  }, [rows, blockList, selectedHud, selectedBlock, fromDate, toDate]);

  // Counts
  const counts = useMemo(() => {
    const c = { Adequate: 0, Inadequate: 0, Nil: 0 };
    baseFilteredRows.forEach((row) => {
      const { status } = classifyPpm(row.ppm, row.samplingPoint);
      c[status] += 1;
    });
    c.Total = c.Adequate + c.Inadequate + c.Nil;
    return c;
  }, [baseFilteredRows]);

  // Filtered rows by status
  const filteredRows = useMemo(() => {
    if (activeStatus === "ALL") return baseFilteredRows;
    return baseFilteredRows.filter(
      (row) => classifyPpm(row.ppm, row.samplingPoint).status === activeStatus
    );
  }, [baseFilteredRows, activeStatus]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredRows.slice(start, end);
  }, [filteredRows, page, rowsPerPage]);

  const summaryData = [
    { label: "Adequate", count: counts.Adequate, color: "#43a047", status: "Adequate" },
    { label: "Inadequate", count: counts.Inadequate, color: "#fb8c00", status: "Inadequate" },
    { label: "Nil", count: counts.Nil, color: "#e53935", status: "Nil" },
    { label: "Total", count: counts.Total, color: "#607d8b", status: "ALL" },
  ];

  // Excel export
  const handleExportExcel = async (rowsToExport) => {
    if (!rowsToExport || rowsToExport.length === 0) {
      alert("No data available to export.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("PPM Summary");

    const headers = [
      "Sl. No",
      "Username",
      "HUD",
      "Block",
      "Address",
      "Actual PPM",
      "Measured PPM",
      "Sampling Point",
      "Timestamp",
      "Latitude",
      "Longitude",
      "Status",
    ];
    sheet.addRow(headers);

    const COLOR_MAP_EXCEL = {
      Adequate: "43a047",
      Inadequate: "fb8c00",
      Nil: "e53935",
    };

    rowsToExport.forEach((row, index) => {
      const { ppm, status } = classifyPpm(row.ppm, row.samplingPoint);
      const excelRow = sheet.addRow([
        index + 1,
        row.username,
        row.hud_name,
        row.block_name,
        row.address,
        row.actualPPM,
        ppm,
        row.samplingPoint,
        row.timestamp,
        row.latitude,
        row.longitude,
        status,
      ]);

      [6, 7, 12].forEach((cellIndex) => {
        const cell = excelRow.getCell(cellIndex);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLOR_MAP_EXCEL[status] || "FFFFFF" },
        };
        cell.font = { color: { argb: "000000" }, bold: true };
      });
    });

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    saveAs(
      new Blob([await workbook.xlsx.writeBuffer()]),
      `PPM_Summary_${yyyy}-${mm}-${dd}_${hh}${min}${ss}.xlsx`
    );
  };

  if (loading)
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={150}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ mb: 3, width: "100%", px: 2 }}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: "bold" }}>
        HUD Chlorination Status Summary
      </Typography>

      {/* Filters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <FormControl sx={{ minWidth: 220 }} size="medium">
          <Select
            displayEmpty
            value={selectedHud}
            onChange={(e) => {
              setSelectedHud(e.target.value);
              setSelectedBlock("");
            }}
          >
            <MenuItem value="">All HUDs</MenuItem>
            {hudList.map((h) => (
              <MenuItem key={h.hud_id} value={h.hud_id}>
                {h.hud_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 220 }} size="medium" disabled={!selectedHud}>
          <Select
            displayEmpty
            value={selectedBlock}
            onChange={(e) => setSelectedBlock(e.target.value)}
          >
            <MenuItem value="">All Blocks</MenuItem>
            {blockList
              .filter((b) => b.hud_id === selectedHud)
              .map((b) => (
                <MenuItem key={b.block_id} value={b.block_id}>
                  {b.block_name}
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        <TextField
          label="From Date"
          type="date"
          size="medium"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: minDate, max: maxDate }}
        />

        <TextField
          label="To Date"
          type="date"
          size="medium"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: minDate, max: maxDate }}
        />

        <Button
          variant="contained"
          color="success"
          startIcon={<DownloadForOfflineIcon />}
          onClick={() => handleExportExcel(filteredRows)}
        >
          Download Excel
        </Button>
      </Box>

      {/* Summary Table */}
      <TableContainer component={Paper} sx={{ width: "100%", borderRadius: 3, boxShadow: 4 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: "#e0e0e0" }}>
              {summaryData.map((item, index) => (
                <TableCell
                  key={index}
                  align="center"
                  sx={{ fontWeight: "bold", fontSize: "1.1rem" }}
                >
                  {item.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              {summaryData.map((item, index) => (
                <TableCell
                  key={index}
                  align="center"
                  sx={{
                    fontWeight: "bold",
                    fontSize: "1.2rem",
                    color: "white",
                    backgroundColor: item.color,
                    cursor: "pointer",
                    "&:hover": { opacity: 0.85 },
                  }}
                  onClick={() => setActiveStatus(item.status)}
                >
                  {item.count}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Filtered Data Table */}
      <Box mt={4}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {activeStatus === "ALL" ? "All Records" : `${activeStatus} Records`}
        </Typography>
        <TableContainer
          component={Paper}
          sx={{ width: "100%", maxHeight: 700, overflow: "auto" }}
        >
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {[
                  "Sl. No",
                  "Username",
                  "HUD",
                  "Block",
                  "Address",
                  "Observed PPM by the user",
                  "Measured PPM by the AI",
                  "Sampling Point",
                  "Timestamp",
                  "Latitude",
                  "Longitude",
                  "Map",
                  "Image",
                ].map((head, idx) => (
                  <TableCell
                    key={idx}
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5", color: "#000" }}
                  >
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRows.map((row, index) => {
                const { ppm, status } = classifyPpm(row.ppm, row.samplingPoint);
                const color = COLOR_MAP[status];
                const actual = parseFloat(row.actualPPM);

                return (
                  <TableRow key={row.id || index}>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{row.username}</TableCell>
                    <TableCell>{row.hud_name}</TableCell>
                    <TableCell>{row.block_name}</TableCell>
                    <TableCell>{row.address}</TableCell>

                    {/* Actual PPM */}
                    <TableCell>
                      <Box sx={{ display: "flex", justifyContent: "center" }}>
                        <Typography
                          sx={{
                            backgroundColor: isNaN(actual)
                              ? "#9e9e9e"
                              : COLOR_MAP[classifyPpm(actual, row.samplingPoint).status],
                            color: "white",
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            fontWeight: 600,
                          }}
                        >
                          {isNaN(actual) ? "N/A" : actual}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Measured PPM */}
                    <TableCell>
                      <Box sx={{ display: "flex", justifyContent: "center" }}>
                        <Typography
                          sx={{
                            backgroundColor: color,
                            color: "white",
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            fontWeight: 600,
                          }}
                        >
                          {ppm}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Sampling Point */}
                    <TableCell>
                      {(() => {
                        const value = (row.samplingPoint || "").toUpperCase();
                        let displayValue = value;
                        if (value === "OHT") displayValue = "Over Head Tank";
                        else if (value === "GLR") displayValue = "Ground Level Reservoir";
                        else if (value === "SUMP") displayValue = "Sump";
                        else if (value === "TAIL") displayValue = "Tailend";
                        else if (value === "MID") displayValue = "Midpoint";
                        return (
                          <Typography sx={{ fontWeight: 600 }}>{displayValue}</Typography>
                        );
                      })()}
                    </TableCell>

                    <TableCell>{row.timestamp}</TableCell>
                    <TableCell>{row.latitude}</TableCell>
                    <TableCell>{row.longitude}</TableCell>

                    <TableCell>
                      {row.latitude && row.longitude && (
                        <IconButton
                          onClick={() =>
                            window.open(
                              `https://www.google.com/maps?q=${row.latitude},${row.longitude}`,
                              "_blank"
                            )
                          }
                        >
                          <MapIcon />
                        </IconButton>
                      )}
                    </TableCell>

                    <TableCell>
                      {row.image_path ? (
                        <IconButton
                          onClick={() => {
                            setImgSrc(`http://localhost:3000${row.image_path}`);
                            setOpenImg(true);
                          }}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          N/A
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredRows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Box>

      {/* Image Dialog */}
      <Dialog
        open={openImg}
        onClose={() => setOpenImg(false)}
        maxWidth="sm"
        fullWidth={false}
        PaperProps={{
          sx: { borderRadius: 3, p: 2, maxWidth: 400 },
        }}
      >
        <DialogTitle sx={{ p: 1 }}>
          <IconButton
            aria-label="close"
            onClick={() => setOpenImg(false)}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ display: "flex", justifyContent: "center" }}>
          <img
            src={imgSrc}
            alt="chlorine"
            style={{ width: "100%", height: "auto", borderRadius: 8 }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}