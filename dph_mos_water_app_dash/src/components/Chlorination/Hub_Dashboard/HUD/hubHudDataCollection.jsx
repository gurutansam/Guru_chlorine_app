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
import DashboardLayout from "../DashboardLayout";
import { DataGrid } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export default function ChlhubHudStateData() {
  const [rows, setRows] = useState([]);
  const [blockList, setBlockList] = useState([]);
  const [blockFilter, setBlockFilter] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [openMap, setOpenMap] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: 0, lng: 0 });
  const [openImg, setOpenImg] = useState(false);
  const [imgSrcs, setImgSrcs] = useState([]);
  const [imgIndex, setImgIndex] = useState(0);
  const [userHubId, setUserHubId] = useState(null);

  // ✅ Fetch data
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const userStr = localStorage.getItem("loggedInUser");
        const userObj = userStr ? JSON.parse(userStr) : null;
        if (!userObj?.username) return;

        const userRes = await fetch("http://localhost:3000/dashboard/chl-hubusers");
        const userData = await userRes.json();
        const loggedUser = userData.find((u) => u.username === userObj.username);
        if (!loggedUser) return;
        setUserHubId(loggedUser.hub_id);

        const [blockRes, hudRes] = await Promise.all([
          fetch("http://localhost:3000/dashboard/hud-blocks"),
          fetch("http://localhost:3000/dashboard/hud"),
        ]);
        const blocks = await blockRes.json();
        const huds = await hudRes.json();
        setBlockList(blocks);

        const blockToHub = {};
        blocks.forEach((block) => {
          const hud = huds.find((h) => h.hud_id === block.hud_id);
          if (hud) blockToHub[block.block_id] = hud.hub_id;
        });

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

        const chlRes = await fetch(url);
        const chlData = await chlRes.json();

        const filtered = chlData
          .filter((item) => blockToHub[item.block_id] === loggedUser.hub_id)
          .map((item, index) => ({ id: index + 1, ...item }));

        setRows(filtered);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }
    };
    fetchAllData();
  }, [fromDate, toDate]);

  // ✅ Parse timestamp "DD/MM/YYYY, hh:mm:ss am/pm"
  const parseDate = (timestamp) => {
    if (!timestamp) return null;
    const [datePart, timePart] = timestamp.split(", ");
    const [day, month, year] = datePart.split("/").map(Number);
    return new Date(`${year}-${month}-${day} ${timePart}`);
  };

  // ✅ Filter rows with block + date
  const filteredRows = rows.filter((row) => {
    if (blockFilter && row.block_id !== blockFilter) return false;
    return true;
  });

  const getColorBySampling = (value, sampling) => {
    if (sampling === "TAIL" || sampling === "MID") {
      if (value === 0) return "red";
      if (value < 0.2) return "orange";
      return "green";
    } else if (sampling === "OHT" || sampling === "GLR" || sampling === "SUMP") {
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

    filteredRows.forEach((row, index) => {
      const rawPpm = parseFloat(row.ppm);
      const measuredPpm = rawPpm > 0 && rawPpm < 0.1 ? 0 : Math.round(rawPpm * 10) / 10;

      const { status: measuredStatus } = classifyPpm(measuredPpm, row.samplingPoint);
      const { status: actualStatus } = classifyPpm(row.actualPPM, row.samplingPoint);

      const excelRow = worksheet.addRow({
        id: index + 1,
        username: row.username || "",
        hud_name: row.hud_name || "",
        block_name: row.block_name || "",
        address: row.address || "",
        actualPPM: row.actualPPM,
        samplingPoint: row.samplingPoint || "",
        ppm: measuredPpm, // moved after samplingPoint
        timestamp: row.timestamp || "",
        latitude: row.latitude || "",
        longitude: row.longitude || "",
      });

      // Color for Actual PPM
      const actualCell = excelRow.getCell("actualPPM");
      actualCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_MAP[actualStatus] } };
      actualCell.font = { color: { argb: "FFFFFFFF" }, bold: true };

      // Color for Measured PPM
      const measuredCell = excelRow.getCell("ppm");
      measuredCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_MAP[measuredStatus] } };
      measuredCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `Hud_datacollection(${yyyy}-${mm}-${dd}).xlsx`
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
            <Typography
              sx={{
                backgroundColor: color,
                color: "white",
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontWeight: 600,
                fontFamily: "Nunito, sans-serif",
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
      headerName: "Measured PPm by the AI",
      width: 170,
      renderCell: (params) => {
        const rawPpm = parseFloat(params.row.ppm);
        const ppm = rawPpm > 0 && rawPpm < 0.1 ? 0 : Math.round(rawPpm * 10) / 10;

        const sampling = (params.row.samplingPoint || "").toUpperCase();
        const color = getColorBySampling(ppm, sampling);
        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <Typography
              sx={{
                backgroundColor: color,
                color: "white",
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontWeight: 600,
                fontFamily: "Nunito, sans-serif",
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
            <Typography sx={{ fontWeight: 600 }}>{displayValue}</Typography>
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
        ) : (
          <Typography variant="body2" color="text.secondary">N/A</Typography>
        );
      },
    },
    {
      field: "images",
      headerName: "Image",
      width: 100,
      renderCell: (params) => {
        const imagePath = params.row.image_path;
        if (!imagePath || !imagePath.includes("chlorine_image_")) return <Typography variant="body2" color="text.secondary">N/A</Typography>;
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
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>
          DATA SET
        </Typography>

        {/* Filters + Download */}
        <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
          <FormControl sx={{ minWidth: 200 }} size="small">
            <Select displayEmpty value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)}>
              <MenuItem value=""><em>All Blocks</em></MenuItem>
              {blockList.map((block) => (
                <MenuItem key={block.block_id} value={block.block_id}>{block.block_name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="From Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            sx={{ minWidth: 140 }}
          />

          <TextField
            label="To Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            sx={{ minWidth: 140 }}
          />

          <Button onClick={handleDownloadExcel} variant="contained" color="success" startIcon={<DownloadForOfflineIcon />} sx={{ fontFamily: "Nunito, sans-serif", textTransform: "none" }}>
            Download as Excel
          </Button>
        </Box>

        <Box style={{ height: "auto", minHeight: 600, width: "100%" }}>
          <DataGrid rows={filteredRows} columns={columns} pageSize={20} rowsPerPageOptions={[20]} sx={{
            fontFamily: "Nunito, sans-serif",
            border: "2px solid #2A2F5B",
            borderRadius: 2,
            boxShadow: 2,
            "& .MuiDataGrid-columnHeaders": { color: "black", fontWeight: 900, fontSize: "1.1rem", letterSpacing: "0.5px", textTransform: "uppercase", borderBottom: "3px solid black", background: "transparent" },
            "& .MuiDataGrid-cell": { borderBottom: "1px solid #ddd", fontSize: "0.95rem" },
            "& .MuiDataGrid-row:hover": { backgroundColor: "#f0f4ff" },
            "& .MuiDataGrid-footerContainer": { backgroundColor: "#f9f9f9" },
          }} />
        </Box>

        {/* Map Dialog */}
        <Dialog open={openMap} onClose={() => setOpenMap(false)} maxWidth="md">
          <DialogTitle sx={{ fontFamily: "Nunito, sans-serif" }}>
            Location Map
            <IconButton aria-label="close" onClick={() => setOpenMap(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <iframe title="Map" width="100%" height="400" frameBorder="0" style={{ border: 0 }} src={`https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&z=15&output=embed`} allowFullScreen></iframe>
          </DialogContent>
        </Dialog>

        {/* Image Viewer Dialog */}
        <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: "Nunito, sans-serif" }}>
            Image Viewer
            <IconButton aria-label="close" onClick={() => setOpenImg(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 2, backgroundColor: "#f5f5f5" }}>
            {imgSrcs.length > 0 ? (
              <Box sx={{ backgroundColor: "#fff", borderRadius: 2, boxShadow: 2 }}>
                <Box sx={{ width: "100%", height: "45vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
                  <img src={imgSrcs[imgIndex]} alt={`img-${imgIndex}`} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </Box>
              </Box>
            ) : <Typography sx={{ fontFamily: "Nunito, sans-serif" }}>No Image Available</Typography>}
          </DialogContent>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}