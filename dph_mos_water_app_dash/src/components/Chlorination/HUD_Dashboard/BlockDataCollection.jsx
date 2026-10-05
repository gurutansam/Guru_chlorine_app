import React, { useEffect, useState } from "react";
import {
  Box,
  IconButton,
  Typography,
  Dialog,
  DialogContent,
  DialogTitle,
  Select,
  MenuItem,
  FormControl,
  Button,
  TextField,
  CircularProgress,
} from "@mui/material";
import DashboardLayout from "./DashboardLayout";
import { DataGrid } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/* ================= COLOR LOGIC (DO NOT CHANGE) ================= */
const getPpmColor = (value, sampling) => {
  const v = Number(value);
  const s = (sampling || "").toUpperCase();

  if (s === "TAIL" || s === "MID") {
    if (v === 0) return "#e53935";
    if (v < 0.2) return "#fb8c00";
    return "#2e7d32";
  }

  if (v === 0) return "#e53935";
  if (v < 1) return "#fb8c00";
  return "#2e7d32";
};

/* ================= DATE PARSER ================= */
const parseDate = (timestamp) => {
  if (!timestamp) return null;
  return new Date(timestamp.replace(" ", "T"));
};

export default function HudBlockChlorineData() {
  const [rows, setRows] = useState([]);
  const [blockList, setBlockList] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openMap, setOpenMap] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: 0, lng: 0 });
  const [openImg, setOpenImg] = useState(false);
  const [imgSrcs, setImgSrcs] = useState([]);
  const [imgIndex, setImgIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loggedInHudId, setLoggedInHudId] = useState(null);

  /* ================= LOGGED-IN HUD ================= */
  useEffect(() => {
    const stored = localStorage.getItem("loggedInUser");
    if (!stored) return;
    const user = JSON.parse(stored);
    if (user?.hud_id) setLoggedInHudId(user.hud_id);
  }, []);

  /* ================= FETCH DATA ================= */
  useEffect(() => {
    if (!loggedInHudId) return;

    const fetchAll = async () => {
      try {
        setLoading(true);

        const [blockRes, dataRes] = await Promise.all([
          fetch("http://localhost:3000/dashboard/hud-blocks"),
          fetch(
            `http://localhost:3000/dashboard/get_hud_block_chlorine_data?hud_id=${loggedInHudId}`
          ),
        ]);

        const blockData = await blockRes.json();
        const api = await dataRes.json();
        const list = Array.isArray(api.data) ? api.data : [];

        const hudBlocks = blockData.filter(
          (b) => b.hud_id === loggedInHudId
        );

        setBlockList(hudBlocks);
        setRows(list); // keep DB id untouched
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [loggedInHudId]);

  /* ================= FILTER ================= */
  const filteredRows = rows.filter((row) => {
    if (selectedBlock && row.block_id !== selectedBlock) return false;

    if (fromDate || toDate) {
      const date = parseDate(row.timestamp);
      if (!date || isNaN(date)) return false;

      if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        if (date < from) return false;
      }

      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (date > to) return false;
      }
    }
    return true;
  });

  /* ================= SORT (LATEST FIRST) ================= */
  const sortedRows = [...filteredRows].sort((a, b) => {
    const da = parseDate(a.timestamp);
    const db = parseDate(b.timestamp);
    return db - da;
  });

  /* ================= EXCEL ================= */
  const handleDownloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Block Chlorine Data");

    sheet.columns = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "Username", key: "username", width: 20 },
      { header: "HUD Name", key: "hud_name", width: 20 },
      { header: "Block Name", key: "block_name", width: 20 },
      { header: "Observed PPM", key: "actualPPM", width: 15 },
      { header: "Measured PPM", key: "ppm", width: 15 },
      { header: "Sampling Point", key: "samplingPoint", width: 15 },
      { header: "Address", key: "address", width: 35 },
      { header: "Timestamp", key: "timestamp", width: 20 },
    ];

    sortedRows.forEach((row, i) => {
      sheet.addRow({ sno: i + 1, ...row });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "block_chlorine.xlsx");
  };

  /* ================= COLUMNS ================= */
  const columns = [
    {
      field: "sno",
      headerName: "S.No",
      width: 70,
      sortable: false,
      renderCell: (params) =>
        params.api.getRowIndexRelativeToVisibleRows(params.id) + 1,
    },
    { field: "username", headerName: "USERNAME", width: 160 },
    { field: "hud_name", headerName: "HUD", width: 180 },
    { field: "block_name", headerName: "BLOCK", width: 200 },
    {
      field: "actualPPM",
      headerName: "OBSERVED PPM",
      width: 150,
      renderCell: (params) => {
        const actual = parseFloat(params.row.actualPPM);
        const sampling = (params.row.samplingPoint || "").toUpperCase();
        const color = getPpmColor(actual, sampling);

        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
            }}
          >
            <Typography
              sx={{
                backgroundColor: color,
                color: "#fff",
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontWeight: 600,
                minWidth: 40,
                textAlign: "center",
              }}
            >
              {actual}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "ppm",
      headerName: "MEASURED PPM",
      width: 150,
      renderCell: (params) => {
        const raw = parseFloat(params.row.ppm);
        const ppm =
          raw > 0 && raw < 0.1 ? 0 : Math.round(raw * 10) / 10;

        const sampling = (params.row.samplingPoint || "").toUpperCase();
        const color = getPpmColor(ppm, sampling);

        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
            }}
          >
            <Typography
              sx={{
                backgroundColor: color,
                color: "#fff",
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontWeight: 600,
                minWidth: 40,
                textAlign: "center",
              }}
            >
              {ppm}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "samplingPoint",
      headerName: "Sampling Point",
      width: 180,
      renderCell: (params) => {
        const value = (params.row.samplingPoint || "").toUpperCase();
        let displayValue = value;

        if (value === "OHT") displayValue = "Over head Tank";
        else if (value === "GLR") displayValue = "Ground Level Reservoir";
        else if (value === "SUMP") displayValue = "SUMP";
        else if (value === "TAIL") displayValue = "Tailend";
        else if (value === "MID") displayValue = "Midpoint";

        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <Typography sx={{ fontWeight: 600 }}>
              {displayValue}
            </Typography>
          </Box>
        );
      },
    },
    { field: "timestamp", headerName: "DATE", width: 200 },
    { field: "address", headerName: "ADDRESS", width: 300 },
    {
      field: "map",
      headerName: "MAP",
      width: 90,
      renderCell: (params) => (
        <IconButton
          onClick={() => {
            setMapCoords({
              lat: params.row.latitude,
              lng: params.row.longitude,
            });
            setOpenMap(true);
          }}
        >
          <VisibilityIcon />
        </IconButton>
      ),
    },
    {
      field: "image",
      headerName: "IMAGE",
      width: 90,
      renderCell: (params) =>
        params.row.image_path ? (
          <IconButton
            onClick={() => {
              setImgSrcs([`http://localhost:3000${params.row.image_path}`]);
              setOpenImg(true);
            }}
          >
            <VisibilityIcon />
          </IconButton>
        ) : (
          "N/A"
        ),
    },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <Box height="80vh" display="flex" justifyContent="center" alignItems="center">
          <CircularProgress size={60} />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box p={2} sx={{ paddingTop: 20, paddingLeft: 10 }}>
        <Typography variant="h5" fontWeight={700} mb={2}>
          Block Officer's Chlorination Monitoring
        </Typography>

        <Box display="flex" gap={2} mb={2}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select value={selectedBlock} onChange={(e) => setSelectedBlock(e.target.value)}>
              <MenuItem value="">All Blocks</MenuItem>
              {blockList.map((b) => (
                <MenuItem key={b.block_id} value={b.block_id}>
                  {b.block_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField type="date" label="From Date" size="small" InputLabelProps={{ shrink: true }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <TextField type="date" label="To Date" size="small" InputLabelProps={{ shrink: true }} value={toDate} onChange={(e) => setToDate(e.target.value)} />

          <Button variant="contained" color="success" startIcon={<DownloadForOfflineIcon />} onClick={handleDownloadExcel}>
            Download as Excel
          </Button>
        </Box>

        <DataGrid
          rows={sortedRows}
          columns={columns}
          autoHeight
          getRowId={(row) => row.id}
        />

        {/* MAP */}
        <Dialog open={openMap} onClose={() => setOpenMap(false)} maxWidth="md">
          <DialogTitle>
            Location Map
            <IconButton onClick={() => setOpenMap(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <iframe width="100%" height="400" src={`https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&z=15&output=embed`} />
          </DialogContent>
        </Dialog>

        {/* IMAGE */}
        <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="md">
          <DialogTitle>
            Image Viewer
            <IconButton onClick={() => setOpenImg(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ display: "flex", justifyContent: "center" }}>
            <img src={imgSrcs[imgIndex]} alt="chlorine" style={{ maxWidth: "100%", maxHeight: 500 }} />
          </DialogContent>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
