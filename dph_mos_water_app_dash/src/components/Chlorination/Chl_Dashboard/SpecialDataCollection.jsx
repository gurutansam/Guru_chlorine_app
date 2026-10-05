import React, { useEffect, useState } from "react";
import {
  Box,
  IconButton,
  Typography,
  Dialog,
  DialogContent,
  DialogTitle,
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

/* ================= DATE PARSER (BOTH FORMATS) ================= */
const parseDate = (timestamp) => {
  if (!timestamp) return null;

  // Format: DD/MM/YYYY HH:mm:ss
  if (timestamp.includes("/")) {
    const clean = timestamp.replace(/\u202F|\u00A0/g, " ").trim();

    // 🔥 SPLIT BY SPACE, NOT COMMA
    const [datePart, timePart = "00:00:00"] = clean.split(" ");
    const [dd, mm, yyyy] = datePart.split("/");

    // 🔥 FORCE ISO FORMAT (JS SAFE)
    return new Date(`${yyyy}-${mm}-${dd}T${timePart}`);
  }

  // Fallback: YYYY-MM-DD HH:mm:ss
  return new Date(timestamp.replace(" ", "T"));
};


/* ================= DATE-ONLY HELPER (NEW) ================= */
const toDateOnly = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export default function SpecialChlorineData() {
  const [rows, setRows] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openMap, setOpenMap] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: 0, lng: 0 });
  const [openImg, setOpenImg] = useState(false);
  const [imgSrcs, setImgSrcs] = useState([]);
  const [imgIndex, setImgIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH ================= */
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          "http://localhost:3000/dashboard/get_chl_special_datacollection?role=chl_admin"
        );

        const api = await res.json();
        const list = Array.isArray(api.data) ? api.data : [];

        setRows(list.map((item) => ({ id: item.id, ...item })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  /* ================= FIXED DATE FILTER ================= */
  const filteredRows = rows.filter((row) => {
    if (!fromDate && !toDate) return true;

    const rawDate = parseDate(row.timestamp);
    if (!rawDate || isNaN(rawDate)) return false;

    const rowDate = toDateOnly(rawDate);

    if (fromDate) {
      const from = toDateOnly(new Date(fromDate));
      if (rowDate < from) return false;
    }

    if (toDate) {
      const to = toDateOnly(new Date(toDate));
      if (rowDate > to) return false;
    }

    return true;
  });

  /* ================= EXCEL ================= */
  const handleDownloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Special Chlorine Data");

    sheet.columns = [
      { header: "S.No", key: "id", width: 8 },
      { header: "Username", key: "username", width: 20 },
      { header: "Observed PPM by the user", key: "actualPPM", width: 15 },
      { header: "Measured PPM by the AI", key: "ppm", width: 15 },
      { header: "Sampling Point", key: "samplingPoint", width: 18 },
      { header: "Address", key: "address", width: 35 },
      { header: "Timestamp", key: "timestamp", width: 22 },
    ];

    filteredRows.forEach((row, i) => {
      sheet.addRow({
        id: i + 1,
        username: row.username,
        actualPPM: row.actualPPM,
        ppm: row.ppm,
        samplingPoint: row.samplingPoint,
        address: row.address,
        timestamp: row.timestamp,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer]),
      `special_chlorine_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  /* ================= COLUMNS ================= */
  const columns = [
    { field: "id", headerName: "S.No", width: 70 },
    { field: "username", headerName: "USERNAME", width: 180 },

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


    // ✅ Sampling Point (already requested)
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

    // ✅ Address (NEW – layout-safe)
    {
      field: "address",
      headerName: "ADDRESS",
      width: 350,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ whiteSpace: "normal", lineHeight: 1.4 }}>
          {params.row.address || "--"}
        </Box>
      ),
    },

    { field: "timestamp", headerName: "DATE", width: 220 },

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
        <Box height="80vh" display="flex" alignItems="center" justifyContent="center">
          <CircularProgress size={60} />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box p={2} sx={{ paddingTop: 20, paddingLeft: 10 }}>
        <Typography variant="h5" fontWeight={700} mb={2}>
          SPECIAL CHLORINE DATA
        </Typography>

        <Box display="flex" gap={2} mb={2} flexWrap="wrap">
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          <Button
            variant="contained"
            color="success"
            startIcon={<DownloadForOfflineIcon />}
            onClick={handleDownloadExcel}
            sx={{ textTransform: "none" }}
          >
            Download as Excel
          </Button>
        </Box>

        <DataGrid
          rows={filteredRows}
          columns={columns}
          autoHeight
          pageSize={100}
          rowsPerPageOptions={[100]}
        />
      </Box>

      {/* MAP */}
      <Dialog open={openMap} onClose={() => setOpenMap(false)} maxWidth="md">
        <DialogTitle>
          Location Map
          <IconButton
            onClick={() => setOpenMap(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <iframe
            width="100%"
            height="400"
            src={`https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&z=15&output=embed`}
          />
        </DialogContent>
      </Dialog>

      {/* IMAGE */}
      <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="md">
        <DialogTitle>
          Image Viewer
          <IconButton
            onClick={() => setOpenImg(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: "flex", justifyContent: "center" }}>
          <img
            src={imgSrcs[imgIndex]}
            alt="chlorine"
            style={{ maxWidth: "100%", maxHeight: 500, borderRadius: 6 }}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
