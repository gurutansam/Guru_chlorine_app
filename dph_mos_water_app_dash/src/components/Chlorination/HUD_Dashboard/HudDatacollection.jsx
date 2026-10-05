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
} from "@mui/material";
import DashboardLayout from "./DashboardLayout";
import { DataGrid } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export default function HudStateData() {
  const [rows, setRows] = useState([]);
  const [blockList, setBlockList] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState("all");
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [openMap, setOpenMap] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: 0, lng: 0 });
  const [openImg, setOpenImg] = useState(false);
  const [imgSrcs, setImgSrcs] = useState([]);
  const [imgIndex, setImgIndex] = useState(0);
  const [loggedInHudId, setLoggedInHudId] = useState(null);

  // Get logged-in HUD ID
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (user?.hud_id) setLoggedInHudId(user.hud_id);
  }, []);

  // Fetch HUD blocks and chlorine data
  useEffect(() => {
    if (!loggedInHudId) return;

    const fetchData = async () => {
      try {
        let url = "http://localhost:3000/dashboard/chl_hud_datacollection";
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
          url += `?${queryParams.join("&")}`;
        }

        const [chlRes, blockRes] = await Promise.all([
          fetch(url),
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
      }
    };

    fetchData();
  }, [loggedInHudId, fromDate, toDate]);

  // Parse timestamp "DD/MM/YYYY, hh:mm:ss am/pm" → Date object
  const parseTimestamp = (timestamp) => {
    if (!timestamp) return null;
    const [datePart, timePart, ampm] = timestamp.split(/[\s,]+/);
    const [day, month, year] = datePart.split("/").map(Number);
    let [hours, minutes, seconds] = timePart.split(":").map(Number);
    if (ampm?.toLowerCase() === "pm" && hours < 12) hours += 12;
    if (ampm?.toLowerCase() === "am" && hours === 12) hours = 0;
    return new Date(year, month - 1, day, hours, minutes, seconds);
  };

  // Apply filters
  const filteredRows = rows.filter((row) => {
    if (selectedBlock !== "all" && row.block_id !== selectedBlock) return false;
    return true;
  });

  const getColorBySampling = (value, sampling) => {
    if (sampling === "TAIL" || sampling === "MID") {
      if (value === 0) return "red";
      if (value < 0.2) return "orange";
      return "green";
    } else if (sampling === "OHT" || sampling === "GLR" || sampling === "SUMP") { // <-- add GLR here
      if (value === 0) return "red";
      if (value < 1) return "orange";
      return "green";
    }
    return "inherit";
  };
  const handleDownloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Chlorine Data");

    worksheet.columns = [
      { header: "S.No", key: "id", width: 10 },
      { header: "Username", key: "username", width: 20 },
      { header: "HUD Name", key: "hud_name", width: 20 },
      { header: "Block Name", key: "block_name", width: 20 },
      { header: "Address", key: "address", width: 20 },
      { header: "Observed PPM by the user", key: "actualPPM", width: 20 },
      { header: "Sampling Point", key: "samplingPoint", width: 20 },
      { header: "Measured PPM by the AI", key: "ppm", width: 15 },
      { header: "Timestamp", key: "timestamp", width: 25 },
      { header: "Latitude", key: "latitude", width: 15 },
      { header: "Longitude", key: "longitude", width: 15 },
    ];

    filteredRows.forEach((row) => {
      // Format ppm with one decimal
      const rawPpm = parseFloat(row.ppm);
      const ppm = rawPpm > 0 && rawPpm < 0.1 ? 0 : Math.round(rawPpm * 10) / 10;

      const rowData = {
        ...row,
        ppm, // overwrite ppm with formatted value
      };

      const newRow = worksheet.addRow(rowData);

      // --- Color coding for Actual PPM ---
      const actual = parseFloat(row.actualPPM);
      const sampling = (row.samplingPoint || "").toUpperCase();
      const actualColor = getColorBySampling(actual, sampling);

      if (actualColor !== "inherit") {
        const excelColor =
          actualColor === "red" ? "FF0000" :
            actualColor === "orange" ? "FFA500" :
              "008000"; // green

        newRow.getCell("actualPPM").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: excelColor },
        };
        newRow.getCell("actualPPM").font = {
          color: { argb: "FFFFFF" },
          bold: true,
        };
      }

      // --- Color coding for AI PPM ---
      const ppmColor = getColorBySampling(ppm, sampling);

      if (ppmColor !== "inherit") {
        const excelColor =
          ppmColor === "red" ? "FF0000" :
            ppmColor === "orange" ? "FFA500" :
              "008000"; // green

        newRow.getCell("ppm").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: excelColor },
        };
        newRow.getCell("ppm").font = {
          color: { argb: "FFFFFF" },
          bold: true,
        };
      }
    });

    // Add today's date in filename
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const fileName = `chlorine_Data_${dd}_${mm}_${yyyy}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      fileName
    );
  };

  const columns = [
    { field: "id", headerName: "S.No", width: 80 },
    { field: "username", headerName: "Username", width: 140 },
    { field: "hud_name", headerName: "HUD Name", width: 140 },
    { field: "block_name", headerName: "Block Name", width: 140 },
    { field: "address", headerName: "Address", width: 190 },
    {
      field: "actualPPM",
      headerName: "Observed PPM by the user",
      width: 150,
      renderCell: (params) => {
        const actual = parseFloat(params.row.actualPPM);
        const sampling = (params.row.samplingPoint || "").toUpperCase();
        const color = getColorBySampling(actual, sampling);
        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <Typography sx={{ backgroundColor: color, color: "white", px: 1, py: 0.5, borderRadius: 1, fontWeight: 600 }}>
              {actual}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "ppm",
      headerName: "Measured PPM by the AI",
      width: 170,
      renderCell: (params) => {
        const rawPpm = parseFloat(params.row.ppm);
        const ppm = rawPpm > 0 && rawPpm < 0.1 ? 0 : Math.round(rawPpm * 10) / 10;
        const sampling = (params.row.samplingPoint || "").toUpperCase();
        const color = getColorBySampling(ppm, sampling);
        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <Typography sx={{ backgroundColor: color, color: "white", px: 1, py: 0.5, borderRadius: 1, fontWeight: 600 }}>
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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
            }}
          >
            <Typography sx={{ fontWeight: 600 }}>
              {displayValue}
            </Typography>
          </Box>
        );
      },
    },
    { field: "timestamp", headerName: "Date", width: 200 },
    { field: "latitude", headerName: "Latitude", width: 120 },
    { field: "longitude", headerName: "Longitude", width: 150 },
    {
      field: "map",
      headerName: "Map",
      width: 100,
      renderCell: (params) => {
        const lat = params.row.latitude;
        const lng = params.row.longitude;
        return lat != null && lng != null ? (
          <IconButton onClick={() => { setMapCoords({ lat, lng }); setOpenMap(true); }}>
            <VisibilityIcon />
          </IconButton>
        ) : <Typography variant="body2" color="text.secondary">N/A</Typography>;
      },
    },
    {
      field: "images",
      headerName: "Image",
      width: 100,
      renderCell: (params) => {
        const imagePath = params.row.image_path;
        if (!imagePath) return <Typography variant="body2" color="text.secondary">N/A</Typography>;
        const imageUrl = `http://localhost:3000${imagePath}`;
        return (
          <IconButton onClick={() => { setImgSrcs([imageUrl]); setImgIndex(0); setOpenImg(true); }}>
            <VisibilityIcon />
          </IconButton>
        );
      },
    },
  ];

  return (
    <DashboardLayout>
      <Box p={2} sx={{ paddingTop: 20, paddingLeft: 10 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
          DATA SET
        </Typography>

        <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
          <FormControl sx={{ minWidth: 200 }}>
            <Select value={selectedBlock} onChange={(e) => setSelectedBlock(e.target.value)}>
              <MenuItem value="all">All Blocks</MenuItem>
              {blockList.map((block) => (
                <MenuItem key={block.block_id} value={block.block_id}>{block.block_name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField type="date" label="From Date" size="small" InputLabelProps={{ shrink: true }} inputProps={{ min: minDate, max: maxDate }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} sx={{ minWidth: 140 }} />
          <TextField type="date" label="To Date" size="small" InputLabelProps={{ shrink: true }} inputProps={{ min: minDate, max: maxDate }} value={toDate} onChange={(e) => setToDate(e.target.value)} sx={{ minWidth: 140 }} />

          <Button onClick={handleDownloadExcel} variant="contained" color="success" startIcon={<DownloadForOfflineIcon />} sx={{ textTransform: "none" }}>
            Download as Excel
          </Button>
        </Box>

        <Box style={{ height: "auto", minHeight: 600, width: "100%" }}>
          <DataGrid rows={filteredRows} columns={columns} pageSize={20} rowsPerPageOptions={[20]} sx={{
            "& .MuiDataGrid-columnHeaders": { color: "black", fontWeight: 900, fontSize: "1.1rem", borderBottom: "3px solid black", background: "transparent" },
            "& .MuiDataGrid-cell": { borderBottom: "1px solid #ddd", fontSize: "0.95rem" },
            "& .MuiDataGrid-row:hover": { backgroundColor: "#f0f4ff" },
            "& .MuiDataGrid-footerContainer": { backgroundColor: "#f9f9f9" },
          }} />
        </Box>

        {/* Map Dialog */}
        <Dialog open={openMap} onClose={() => setOpenMap(false)} maxWidth="md">
          <DialogTitle>
            Location Map
            <IconButton onClick={() => setOpenMap(false)} sx={{ position: "absolute", right: 8, top: 8 }}><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent>
            <iframe title="Map" width="100%" height="400" frameBorder="0" style={{ border: 0 }}
              src={`https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&z=15&output=embed`} allowFullScreen></iframe>
          </DialogContent>
        </Dialog>

        {/* Image Dialog */}
        <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Image Viewer
            <IconButton onClick={() => setOpenImg(false)} sx={{ position: "absolute", right: 8, top: 8 }}><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 2, backgroundColor: "#f5f5f5" }}>
            {imgSrcs.length > 0 ? (
              <Box sx={{ width: "100%", height: "45vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
                <img src={imgSrcs[imgIndex]} alt={`img-${imgIndex}`} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              </Box>
            ) : <Typography>No Image Available</Typography>}
          </DialogContent>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}