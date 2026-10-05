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
} from "@mui/material";
import TablePagination from "@mui/material/TablePagination";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import MapIcon from "@mui/icons-material/Map";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// ✅ Classification
// ✅ Classification (matches DataCollectionChart exactly)
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

// ✅ Status colors
const COLOR_MAP = {
  Adequate: "#43a047",
  Inadequate: "#fb8c00",
  Nil: "#e53935",
};

export default function PpmSummaryTable() {
  const [rows, setRows] = useState([]);
  const [blockList, setBlockList] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(true);

  const [activeStatus, setActiveStatus] = useState("ALL");

  const [loggedInHudId, setLoggedInHudId] = useState(null);

  // Image preview
  const [openImg, setOpenImg] = useState(false);
  const [imgSrc, setImgSrc] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  // ✅ Get logged in hud_id
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (user?.hud_id) setLoggedInHudId(user.hud_id);
  }, []);

  // ✅ Fetch HUD blocks + chlorine data only for logged-in hud
  useEffect(() => {
    if (!loggedInHudId) return;

    const fetchData = async () => {
      try {
        let chlUrl = "http://localhost:3000/dashboard/chl_hud_datacollection";
        const queryParams = [];
        if (fromDate) {
          const [y, m, d] = fromDate.split("-");
          queryParams.push(`fromDate=${d}/${m}/${y}`);
        }
        if (toDate) {
          const [y, m, d] = toDate.split("-");
          queryParams.push(`toDate=${d}/${m}/${y}`);
        }
        if (queryParams.length > 0) {
          chlUrl += `?${queryParams.join("&")}`;
        }

        const [chlRes, blockRes] = await Promise.all([
          fetch(chlUrl),
          fetch("http://localhost:3000/dashboard/hud-blocks"),
        ]);

        const chlData = await chlRes.json();
        const blockData = await blockRes.json();

        if (Array.isArray(blockData)) {
          const allowedBlocks = blockData.filter(
            (b) => b.hud_id === loggedInHudId
          );
          setBlockList(allowedBlocks);

          if (Array.isArray(chlData)) {
            const filteredChl = chlData.filter((row) =>
              allowedBlocks.some((b) => b.block_id === row.block_id)
            );
            setRows(filteredChl.map((item, idx) => ({ id: idx + 1, ...item })));
          }
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [loggedInHudId, fromDate, toDate]);

  // ✅ Parse date helper
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

  // ✅ Filter rows
  const baseFilteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedBlock && row.block_id !== selectedBlock) return false;
      return true;
    });
  }, [rows, selectedBlock]);

  // ✅ Counts
  const counts = useMemo(() => {
    const c = { Adequate: 0, Inadequate: 0, Nil: 0 };
    baseFilteredRows.forEach((row) => {
      const { status } = classifyPpm(row.ppm, row.samplingPoint);
      c[status] += 1;
    });
    c.Total = c.Adequate + c.Inadequate + c.Nil;
    return c;
  }, [baseFilteredRows]);

  // ✅ Filter by status
  const filteredRows = useMemo(() => {
    if (activeStatus === "ALL") return baseFilteredRows;
    return baseFilteredRows.filter(
      (row) => classifyPpm(row.ppm, row.samplingPoint).status === activeStatus
    );
  }, [baseFilteredRows, activeStatus]);

  const summaryData = [
    { label: "Adequate", count: counts.Adequate, color: "#43a047", status: "Adequate" },
    { label: "Inadequate", count: counts.Inadequate, color: "#fb8c00", status: "Inadequate" },
    { label: "Nil", count: counts.Nil, color: "#e53935", status: "Nil" },
    { label: "Total", count: counts.Total, color: "#607d8b", status: "ALL" },
  ];

  // ✅ Excel Export
  const handleExportExcel = async (filteredRows) => {
    if (!filteredRows || filteredRows.length === 0) {
      alert("No data available to export.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("PPM Summary");

    // ---- Updated header order ----
    const headers = [
      "Sl. No",
      "Username",
      "HUD",
      "Block",
      "Address",
      "Actual PPM",
      "Sampling Point",   // moved before Measured PPM
      "Measured PPM",     // now after Sampling Point
      "Timestamp",
      "Latitude",
      "Longitude",
      "Status",
    ];
    sheet.addRow(headers);

    const COLOR_MAP = {
      Adequate: "43a047",   // green
      Inadequate: "fb8c00", // orange
      Nil: "e53935",        // red
    };

    filteredRows.forEach((row, index) => {
      const { ppm, status } = classifyPpm(row.ppm, row.samplingPoint);

      // ---- Adjusted row order to match headers ----
      const excelRow = sheet.addRow([
        index + 1,
        row.username,
        row.hud_name,
        row.block_name,
        row.address,
        row.actualPPM,
        row.samplingPoint,
        ppm,  // moved after Sampling Point
        row.timestamp,
        row.latitude,
        row.longitude,
        status,
      ]);

      // ---- Apply color for Actual PPM ----
      const actualCell = excelRow.getCell(6); // Actual PPM
      const actualValue = parseFloat(row.actualPPM);
      let actualColor = "FFFFFF"; // default white
      if (!isNaN(actualValue)) {
        if (actualValue === 0) actualColor = COLOR_MAP["Nil"];
        else if (actualValue < 0.2) actualColor = COLOR_MAP["Inadequate"];
        else actualColor = COLOR_MAP["Adequate"];
      }
      actualCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: actualColor },
      };
      actualCell.font = { color: { argb: "000000" }, bold: true };

      // ---- Apply color for Measured PPM ----
      const measuredCell = excelRow.getCell(8); // Measured PPM (new position)
      measuredCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_MAP[status] || "FFFFFF" },
      };
      measuredCell.font = { color: { argb: "000000" }, bold: true };

      // ---- Apply color for Status ----
      const statusCell = excelRow.getCell(12); // Status
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_MAP[status] || "FFFFFF" },
      };
      statusCell.font = { color: { argb: "000000" }, bold: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    // ---- Add date & time to filename ----
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    const filename = `PPM_Summary_${yyyy}-${mm}-${dd}_${hh}${min}${ss}.xlsx`;

    saveAs(new Blob([buffer]), filename);
  };

  if (loading)
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={150}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ mb: 3, width: "100%", pl: 10, pr: 5 }}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: "bold" }}>
        HUD Chlorination Status Summary
      </Typography>

      {/* Block & Date Filters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <FormControl sx={{ minWidth: 220 }} size="medium">
          <Select
            displayEmpty
            value={selectedBlock}
            onChange={(e) => setSelectedBlock(e.target.value)}
          >
            <MenuItem value="">All Blocks</MenuItem>
            {blockList.map((b) => (
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
          onClick={() => handleExportExcel(filteredRows)} // Pass filteredRows
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
              {filteredRows
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
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
        <TablePagination
          component="div"
          count={filteredRows.length}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[25, 50, 100]}
        />

      </Box>

      {/* Image Preview Dialog */}
      <Dialog
        open={openImg}
        onClose={() => setOpenImg(false)}
        maxWidth="sm"
        fullWidth={false}
        PaperProps={{
          sx: { borderRadius: 3, p: 2, maxWidth: 400 },
        }}
      >
        {/* Cancel (X) button */}
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