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
  Button,
} from "@mui/material";
import TablePagination from "@mui/material/TablePagination";
import VisibilityIcon from "@mui/icons-material/Visibility";
import MapIcon from "@mui/icons-material/Map";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { apiFetch } from "../../../utils/api.js";

// ---- Color Mapping ----
const COLOR_MAP = {
  Adequate: "#43a047",
  Inadequate: "#fb8c00",
  Nil: "#e53935",
};

// ---- RWAL Classification (from DataCollectionChart) ----

// ✅ Classification
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


export default function ChlDataCollectionTable() {
  const [rows, setRows] = useState([]);
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState("");
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
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [openImg, setOpenImg] = useState(false);
  const [imgSrc, setImgSrc] = useState("");


  // fetch rows
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (fromDate) params.append("from_date", fromDate);
        if (toDate) params.append("to_date", toDate);

        const res = await apiFetch(`/dashboard/chl_datacollection?${params.toString()}`);
        const data = await res.json();
        const rowsData = Array.isArray(data) ? data : (data.data || []);
        setRows(rowsData);

        const uniqueRegions = [...new Set(rowsData.map((r) => r.hub_name))].filter(Boolean);
        setRegions(uniqueRegions);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [fromDate, toDate]);

  const parseDate = (timestamp) => {
    if (!timestamp) return null;
    const parts = timestamp.split(",");
    const datePart = parts[0].trim();
    const [day, month, year] = datePart.split("/").map(Number);
    if (!day || !month || !year) return null;
    return parts[1]
      ? new Date(`${year}-${month}-${day} ${parts[1].trim()}`)
      : new Date(year, month - 1, day);
  };

  // base filtered rows (region/date)
  const baseFilteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedRegion && row.hub_name !== selectedRegion) return false;

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
  }, [rows, selectedRegion, fromDate, toDate]);

  // ✅ RWAL summary counts
  const counts = useMemo(() => {
    const c = { Adequate: 0, Inadequate: 0, Nil: 0 };
    baseFilteredRows.forEach((row) => {
      const { status } = classifyPpm(row.ppm, row.samplingPoint);
      if (c[status] !== undefined) c[status] += 1;
    });
    c.Total = c.Adequate + c.Inadequate + c.Nil;
    return c;
  }, [baseFilteredRows]);

  // apply active status filter
  const filteredRows = useMemo(() => {
    if (activeStatus === "ALL") return baseFilteredRows;
    return baseFilteredRows.filter(
      (row) => classifyPpm(row.ppm, row.samplingPoint).status === activeStatus
    );
  }, [baseFilteredRows, activeStatus]);

  // paginated rows
  const paginatedRows = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredRows.slice(start, end);
  }, [filteredRows, page, rowsPerPage]);

  const formatSamplingPoint = (value) => {
    const val = (value || "").toUpperCase();
    if (val === "OHT") return "Over Head Tank";
    if (val === "GLR") return "Ground Level Reservoir";
    if (val === "SUMP") return "Sump";
    if (val === "TAIL") return "Tailend";
    if (val === "MID") return "Midpoint";
    return val || "N/A";
  };


  const summaryData = [
    { label: "Adequate", count: counts.Adequate, color: COLOR_MAP.Adequate, status: "Adequate" },
    { label: "Inadequate", count: counts.Inadequate, color: COLOR_MAP.Inadequate, status: "Inadequate" },
    { label: "Nil", count: counts.Nil, color: COLOR_MAP.Nil, status: "Nil" },
    { label: "Total", count: counts.Total, color: "#607d8b", status: "ALL" },
  ];

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Chlorine Data");

    // Header row with Measured PPM after Sampling Point
    const headerRow = sheet.addRow([
      "Sl. No",
      "Username",
      "Region",
      "Address",
      "Actual PPM (User)",
      "Sampling Point",
      "Measured PPM (AI)",
      "Timestamp",
      "Latitude",
      "Longitude",
      "Status",
    ]);

    // Style header row
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF333333" } };
      cell.alignment = { horizontal: "center" };
    });

    const COLOR_MAP = { Adequate: "FF43A047", Inadequate: "FFFB8C00", Nil: "FFE53935" };

    // PPM classification function
    const classifyPpm = (ppm, sampling) => {
      const raw = parseFloat(ppm);
      if (isNaN(raw)) return { ppm: 0, status: "Nil" };
      const norm = raw > 0 && raw < 0.1 ? 0 : Math.round(raw * 10) / 10;
      const s = (sampling || "").toUpperCase();

      if (s === "TAIL" || s === "MID") {
        if (norm === 0) return { ppm: 0, status: "Nil" };
        if (norm < 0.2) return { ppm: norm, status: "Inadequate" };
        return { ppm: norm, status: "Adequate" };
      } else if (s === "OHT" || s === "GLR" || s === "SUMP") {
        if (norm === 0) return { ppm: 0, status: "Nil" };
        if (norm < 1) return { ppm: norm, status: "Inadequate" };
        return { ppm: norm, status: "Adequate" };
      }

      return { ppm: norm, status: "Nil" };
    };

    // Add data rows
    filteredRows.forEach((row, index) => {
      const { ppm: measuredPpm, status: measuredStatus } = classifyPpm(row.ppm, row.samplingPoint);
      const { status: actualStatus } = classifyPpm(row.actualPPM, row.samplingPoint);

      const dataRow = sheet.addRow([
        index + 1,
        row.username,
        row.hub_name,
        row.address,
        row.actualPPM,
        row.samplingPoint,
        measuredPpm,
        row.timestamp,
        row.latitude,
        row.longitude,
        measuredStatus,
      ]);


      const actualCell = dataRow.getCell(5);
      actualCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_MAP[actualStatus] } };
      actualCell.font = { color: { argb: "FFFFFFFF" }, bold: true };


      const measuredCell = dataRow.getCell(7);
      measuredCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_MAP[measuredStatus] } };
      measuredCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });


    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const filename = `Chlorine_Data_${dd}_${mm}_${yyyy}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), filename);
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
        RWAL Chlorination Status Summary
      </Typography>

      {/* Filters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <FormControl sx={{ minWidth: 220 }} size="medium">
          <Select
            displayEmpty
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            <MenuItem value="">All Regions</MenuItem>
            {regions.map((region) => (
              <MenuItem key={region} value={region}>
                {region}
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
          onClick={handleExportExcel}
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
                <TableCell key={index} align="center" sx={{ fontWeight: "bold", fontSize: "1.1rem" }}>
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
      {/* Data Table */}
      <Box mt={4}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {activeStatus === "ALL" ? "All Records" : `${activeStatus} Records`}
        </Typography>
        <TableContainer component={Paper} sx={{ width: "100%", maxHeight: 700, overflow: "auto" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {[
                  "Sl. No",
                  "Username",
                  "Region",
                  "Address",
                  "Actual PPM (User)",
                  "Measured PPM (AI)",
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
                // ✅ classify AI ppm
                const { ppm, status } = classifyPpm(row.ppm, row.samplingPoint);
                const aiColor = COLOR_MAP[status];

                // ✅ classify User actual PPM
                const { ppm: actualNorm, status: actualStatus } = classifyPpm(
                  row.actualPPM,
                  row.samplingPoint
                );
                const actualColor = COLOR_MAP[actualStatus];

                return (
                  <TableRow key={row.id || index}>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{row.username}</TableCell>
                    <TableCell>{row.hub_name}</TableCell>
                    <TableCell>{row.address}</TableCell>

                    {/* ✅ User Actual PPM with color */}
                    <TableCell>
                      <Box sx={{ display: "flex", justifyContent: "center" }}>
                        <Typography
                          sx={{
                            backgroundColor: actualColor,
                            color: "white",
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            fontWeight: 600,
                          }}
                        >
                          {actualNorm}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* ✅ AI Measured PPM with color */}
                    <TableCell>
                      <Box sx={{ display: "flex", justifyContent: "center" }}>
                        <Typography
                          sx={{
                            backgroundColor: aiColor,
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
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>
                        {formatSamplingPoint(row.samplingPoint)}
                      </Typography>
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

      {/* Image Preview Dialog */}
      <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="sm">
        <img src={imgSrc} alt="Preview" style={{ width: "100%" }} />
      </Dialog>
    </Box>
  );
}