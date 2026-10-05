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

// Status → color map
const COLOR_MAP = {
  Adequate: "#43a047",
  Inadequate: "#fb8c00",
  Nil: "#e53935",
};

// Classify PPM values
const classifyPpm = (ppmValue, samplingPoint) => {
  const raw = parseFloat(ppmValue);
  if (isNaN(raw)) return { ppm: 0, status: "Nil" };
  const ppm = raw > 0 && raw < 0.1 ? 0 : Math.round(raw * 10) / 10;
  const s = (samplingPoint || "").toUpperCase();

  if ((s === "TAIL" || s === "MID") && ppm >= 0.2) return { ppm, status: "Adequate" };
  if ((s === "OHT" || s === "GLR" || s === "SUMP") && ppm >= 1) return { ppm, status: "Adequate" };
  if ((s === "TAIL" || s === "MID") && ppm > 0 && ppm < 0.2) return { ppm, status: "Inadequate" };
  if ((s === "OHT" || s === "GLR" || s === "SUMP") && ppm > 0 && ppm < 1) return { ppm, status: "Inadequate" };
  if (ppm === 0) return { ppm, status: "Nil" };

  return { ppm, status: "Nil" };
};

export default function PpmSummaryTable() {
  const [rows, setRows] = useState([]);
  const [hudList, setHudList] = useState([]);
  const [blockList, setBlockList] = useState([]);
  const [selectedHud, setSelectedHud] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [userHubId, setUserHubId] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Image preview
  const [openImg, setOpenImg] = useState(false);
  const [imgSrc, setImgSrc] = useState("");

  // ---------- Fetch all data ----------
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const userStr = localStorage.getItem("loggedInUser");
        const userObj = userStr ? JSON.parse(userStr) : null;
        if (!userObj?.username) {
          setLoading(false);
          return;
        }

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

        const [usersRes, blocksRes, hudsRes, chlRes] = await Promise.all([
          fetch("http://localhost:3000/dashboard/chl-hubusers"),
          fetch("http://localhost:3000/dashboard/hud-blocks"),
          fetch("http://localhost:3000/dashboard/hud"),
          fetch(chlUrl),
        ]);

        const [usersData, blocks, huds, chlData] = await Promise.all([
          usersRes.json(),
          blocksRes.json(),
          hudsRes.json(),
          chlRes.json(),
        ]);

        setHudList(huds);
        setBlockList(blocks);

        const loggedUser = usersData.find(u => u.username === userObj.username);
        if (!loggedUser) {
          setLoading(false);
          return;
        }
        setUserHubId(loggedUser.hub_id);

        // Map block → hub
        const blockToHub = {};
        blocks.forEach(block => {
          const hud = huds.find(h => h.hud_id === block.hud_id);
          if (hud) blockToHub[block.block_id] = hud.hub_id;
        });

        // Filter by user hub
        const filtered = chlData
          .filter(item => blockToHub[item.block_id] === loggedUser.hub_id)
          .map((item, index) => ({ id: index + 1, ...item }));

        setRows(filtered);
      } catch (err) {
        console.error("Data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [fromDate, toDate]);

  // ---------- Helper: parse timestamp ----------
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

  // ---------- Base filtered rows ----------
  const baseFilteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (selectedHud) {
        const hudBlocks = blockList.filter((b) => b.hud_id === selectedHud).map((b) => b.block_id);
        if (!hudBlocks.includes(row.block_id)) return false;
      }

      if (selectedBlock && row.block_id !== selectedBlock) return false;

      return true;
    });
  }, [rows, blockList, selectedHud, selectedBlock]);

  // ---------- Counts ----------
  const counts = useMemo(() => {
    const c = { Adequate: 0, Inadequate: 0, Nil: 0 };
    baseFilteredRows.forEach((row) => {
      const { status } = classifyPpm(row.ppm, row.samplingPoint);
      c[status] += 1;
    });
    c.Total = c.Adequate + c.Inadequate + c.Nil;
    return c;
  }, [baseFilteredRows]);

  // ---------- Filter by status ----------
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

  // ---------- Excel export ----------
  const handleExportExcel = async (rowsToExport) => {
    if (!rowsToExport || rowsToExport.length === 0) {
      alert("No data available to export.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("PPM Summary");

    const headers = [
      "Sl. No", "Username", "HUD", "Block", "Address",
      "Actual PPM", "Measured PPM", "Sampling Point", "Timestamp",
      "Latitude", "Longitude", "Status"
    ];
    sheet.addRow(headers);

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

      const fillColor = COLOR_MAP[status]?.replace("#", "") || "FFFFFF";

      [6, 7, 12].forEach(cellNum => {
        const cell = excelRow.getCell(cellNum);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
        cell.font = { color: { argb: "000000" }, bold: true };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const now = new Date();
    const filename = `PPM_Summary_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}.xlsx`;

    saveAs(new Blob([buffer]), filename);
  };

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" height={150}>
      <CircularProgress />
    </Box>
  );

  // ---------- Render ----------
  return (
    <Box sx={{ mb: 3, width: "100%", pl: 10, pr: 5 }}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: "bold" }}>
        HUD Chlorination Status Summary
      </Typography>

      {/* Filters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <FormControl sx={{ minWidth: 220 }} size="medium">
          <Select
            displayEmpty
            value={selectedHud}
            onChange={(e) => { setSelectedHud(e.target.value); setSelectedBlock(""); }}
          >
            <MenuItem value="">All HUDs</MenuItem>
            {hudList.map(h => <MenuItem key={h.hud_id} value={h.hud_id}>{h.hud_name}</MenuItem>)}
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
        />
        <TextField
          label="To Date"
          type="date"
          size="medium"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
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

      {/* Pagination */}
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

      {/* Filtered Data Table */}
      <Box mt={4}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {activeStatus === "ALL" ? "All Records" : `${activeStatus} Records`}
        </Typography>
        <TableContainer component={Paper} sx={{ width: "100%", maxHeight: 700, overflow: "auto" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {[
                  "Sl. No", "Username", "HUD", "Block", "Address",
                  "Observed PPM by the user", "Measured PPM by the AI",
                  "Sampling Point", "Timestamp", "Latitude", "Longitude", "Map", "Image"
                ].map((head, idx) => (
                  <TableCell key={idx} sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5", color: "#000" }}>
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => {
                const { ppm, status } = classifyPpm(row.ppm, row.samplingPoint);
                const actual = parseFloat(row.actualPPM);

                return (
                  <TableRow key={row.id || index}>
                    <TableCell>{index + 1 + page * rowsPerPage}</TableCell>
                    <TableCell>{row.username}</TableCell>
                    <TableCell>{row.hud_name}</TableCell>
                    <TableCell>{row.block_name}</TableCell>
                    <TableCell>{row.address}</TableCell>

                    <TableCell>
                      <Box sx={{ display: "flex", justifyContent: "center" }}>
                        <Typography sx={{
                          backgroundColor: isNaN(actual) ? "#9e9e9e" : COLOR_MAP[classifyPpm(actual, row.samplingPoint).status],
                          color: "white",
                          px: 1, py: 0.5, borderRadius: 1, fontWeight: 600
                        }}>
                          {isNaN(actual) ? "N/A" : actual}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: "flex", justifyContent: "center" }}>
                        <Typography sx={{
                          backgroundColor: COLOR_MAP[status],
                          color: "white",
                          px: 1, py: 0.5, borderRadius: 1, fontWeight: 600
                        }}>
                          {ppm}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>
                        {(() => {
                          const v = (row.samplingPoint || "").toUpperCase();
                          if (v === "OHT") return "Over Head Tank";
                          if (v === "GLR") return "Ground Level Reservoir";
                          if (v === "SUMP") return "Sump";
                          if (v === "TAIL") return "Tailend";
                          if (v === "MID") return "Midpoint";
                          return v;
                        })()}
                      </Typography>
                    </TableCell>

                    <TableCell>{row.timestamp}</TableCell>
                    <TableCell>{row.latitude}</TableCell>
                    <TableCell>{row.longitude}</TableCell>

                    <TableCell>
                      {row.latitude && row.longitude && (
                        <IconButton onClick={() => window.open(`https://www.google.com/maps?q=${row.latitude},${row.longitude}`, "_blank")}>
                          <MapIcon />
                        </IconButton>
                      )}
                    </TableCell>

                    <TableCell>
                      {row.image_path ? (
                        <IconButton onClick={() => { setImgSrc(`http://localhost:3000${row.image_path}`); setOpenImg(true); }}>
                          <VisibilityIcon />
                        </IconButton>
                      ) : (
                        <Typography variant="body2" color="text.secondary">N/A</Typography>
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

      {/* Image Dialog */}
      <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="sm" fullWidth={false} PaperProps={{ sx: { borderRadius: 3, p: 2, maxWidth: 400 } }}>
        <DialogTitle sx={{ p: 1 }}>
          <IconButton aria-label="close" onClick={() => setOpenImg(false)} sx={{ position: "absolute", right: 8, top: 8, color: theme => theme.palette.grey[500] }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box display="flex" justifyContent="center">
            <img src={imgSrc} alt="Preview" style={{ maxWidth: "100%", maxHeight: "400px", borderRadius: 8 }} />
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}