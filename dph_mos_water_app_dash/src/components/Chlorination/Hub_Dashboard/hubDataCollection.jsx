import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  IconButton,
  Typography,
  Dialog,
  DialogContent,
  DialogTitle,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import DashboardLayout from "./DashboardLayout";
import { DataGrid } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import { toast } from "react-toastify";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export default function HubStateData() {
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [openMap, setOpenMap] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: 0, lng: 0 });
  const [openImg, setOpenImg] = useState(false);
  const [imgSrc, setImgSrc] = useState("");
  const [imgMeta, setImgMeta] = useState({
    timestamp: "",
    latitude: "",
    longitude: "",
    hub_name: "",
  });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [ppmFilter, setPpmFilter] = useState("");

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

  // Fetch Hub-specific data
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!user?.hub_id) {
      toast.error("Hub ID missing. Please log in again.");
      return;
    }

    fetch(
      `http://localhost:3000/dashboard/chl_datacollection/hubid?hub_id=${user.hub_id}`,
      { credentials: "include" }
    )
      .then((res) => res.json())
      .then((data) => {
        const result = Array.isArray(data) ? data : data?.data;
        if (Array.isArray(result)) {
          setRows(result);
          setFilteredRows(result);
        } else {
          toast.error("Unexpected API response");
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Network error");
      });
  }, []);

  // Safe date parser for dd/mm/yyyy, hh:mm:ss am/pm
  const parseDate = (timestamp) => {
    if (!timestamp) return null;
    try {
      if (timestamp.includes("/")) {
        const parts = timestamp.split(", ");
        if (parts.length < 2) return new Date(timestamp);
        const [datePart, timePart] = parts;
        const [day, month, year] = datePart.split("/").map(Number);

        let [time, modifier] = timePart.split(" ");
        if (!time) return new Date(timestamp);
        let [hours, minutes, seconds] = time.split(":").map(Number);

        if (modifier?.toLowerCase() === "pm" && hours < 12) hours += 12;
        if (modifier?.toLowerCase() === "am" && hours === 12) hours = 0;

        return new Date(year, month - 1, day, hours, minutes, seconds || 0);
      }
      const d = new Date(timestamp);
      return isNaN(d.getTime()) ? null : d;
    } catch (err) {
      console.error("parseDate error:", err, "for timestamp:", timestamp);
      return null;
    }
  };

  // Filter rows based on date and PPM
  useEffect(() => {
    const filtered = rows.filter((row) => {
      const ppm = parseFloat(row.ppm);
      const date = parseDate(row.timestamp);

      const from = fromDate ? new Date(fromDate + "T00:00:00") : null;
      const to = toDate ? new Date(toDate + "T23:59:59") : null;
      const isWithinRange = (!from || date >= from) && (!to || date <= to);

      const sampling = (row.samplingPoint || "").toUpperCase();
      let ppmStatus = "";
      if (ppm === 0) ppmStatus = "Nil";
      else if (
        (sampling === "OHT" && ppm >= 1) ||
        ((sampling === "TAIL" || sampling === "MID") && ppm >= 0.2)
      ) {
        ppmStatus = "Adequate";
      } else {
        ppmStatus = "Inadequate";
      }

      const matchesPPM = !ppmFilter || ppmStatus === ppmFilter;
      return isWithinRange && matchesPPM;
    });
    setFilteredRows(filtered);
  }, [rows, fromDate, toDate, ppmFilter]);

  // Export to Excel
  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Chlorination Data");

    sheet.columns = [
      { header: "Username", key: "username" },
      { header: "RWAL Name", key: "hub_name" },
      { header: "Observed PPM by the user", key: "actualPPM", width: 20 },
      { header: "Sampling Point", key: "samplingPoint" },
      { header: "Measured PPM by the AI", key: "ppm", width: 20 },
      { header: "Timestamp", key: "timestamp" },
      { header: "Latitude", key: "latitude" },
      { header: "Longitude", key: "longitude" },
      { header: "Address", key: "address" },
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

      const excelRow = sheet.addRow({
        username: row.username || "",
        hub_name: row.hub_name || "",
        actualPPM: row.actualPPM,
        samplingPoint: row.samplingPoint || "",
        ppm: measuredPpm,
        timestamp: row.timestamp || "",
        latitude: row.latitude || "",
        longitude: row.longitude || "",
        address: row.address || "",
      });

      const actualCell = excelRow.getCell("actualPPM");
      actualCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_MAP[actualStatus] } };
      actualCell.font = { color: { argb: "FFFFFFFF" }, bold: true };

      const measuredCell = excelRow.getCell("ppm");
      measuredCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_MAP[measuredStatus] } };
      measuredCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    const buf = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `Regional_chl_data(${yyyy}-${mm}-${dd}).xlsx`
    );
  };


  const columns = useMemo(
    () => [
      { field: "id", headerName: "S.No", width: 80 },
      { field: "username", headerName: "Username", width: 140 },
      { field: "hub_name", headerName: "RWAL Name", width: 140 },
      {
        field: "ppm",
        headerName: "Measured PPm by the AI",
        width: 120,
        renderCell: (params) => {
          const rawPpm = parseFloat(params.row.ppm);
          const ppm = rawPpm > 0 && rawPpm < 0.1 ? 0 : Math.round(rawPpm * 10) / 10;

          const sampling = (params.row.samplingPoint || "").toUpperCase();
          const color = getColorBySampling(ppm, sampling);
          return (
            <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
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
                {isNaN(ppm) ? "-" : ppm}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: "actualPPM",
        headerName: "Observed PPM by the user",
        width: 120,
        renderCell: (params) => {
          const actual = parseFloat(params.row.actualPPM);
          const sampling = (params.row.samplingPoint || "").toUpperCase();
          const color = getColorBySampling(actual, sampling);
          return (
            <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
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
                {isNaN(actual) ? "-" : actual}
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
              <Typography sx={{ fontWeight: 600 }}>{displayValue}</Typography>
            </Box>
          );
        },
      },
      { field: "timestamp", headerName: "Timestamp", width: 220 },
      { field: "latitude", headerName: "Latitude", width: 120 },
      { field: "longitude", headerName: "Longitude", width: 120 },
      { field: "address", headerName: "Address", width: 170 },
      {
        field: "map",
        headerName: "Map",
        width: 100,
        renderCell: (params) => {
          const { latitude: lat, longitude: lng } = params.row;
          return lat && lng ? (
            <IconButton
              onClick={() => {
                setMapCoords({ lat, lng });
                setOpenMap(true);
              }}
            >
              <VisibilityIcon />
            </IconButton>
          ) : (
            <Typography variant="body2" color="text.secondary">
              N/A
            </Typography>
          );
        },
      },
      {
        field: "images",
        headerName: "Image",
        width: 100,
        renderCell: (params) => {
          const imagePath = params.row.image_path;
          if (!imagePath || !imagePath.includes("chlorine_image_")) {
            return <Typography variant="body2" color="text.secondary">N/A</Typography>;
          }
          const imageUrl = `http://localhost:3000${imagePath}`;
          return (
            <IconButton
              onClick={() => {
                setImgSrc(imageUrl);
                setImgMeta({
                  timestamp: params.row.timestamp,
                  latitude: params.row.latitude,
                  longitude: params.row.longitude,
                  hub_name: params.row.hub_name,
                });
                setOpenImg(true);
              }}
            >
              <VisibilityIcon />
            </IconButton>
          );
        },
      },
    ],
    []
  );

  return (
    <DashboardLayout>
      <Box sx={{ paddingLeft: "60px", paddingTop: "150px" }}>
        <Box p={2}>
          <Typography variant="h5" gutterBottom fontWeight={600}>
            DATA SET
          </Typography>

          <Box display="flex" gap={2} mb={2} alignItems="center">
            <TextField
              label="From Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <TextField
              label="To Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel id="ppm-status-label">PPM Status</InputLabel>
              <Select
                labelId="ppm-status-label"
                value={ppmFilter}
                label="PPM Status"
                onChange={(e) => setPpmFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="Adequate">Adequate</MenuItem>
                <MenuItem value="Inadequate">Inadequate</MenuItem>
                <MenuItem value="Nil">Nil</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              color="success"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
            >
              Download Excel
            </Button>
          </Box>

          <DataGrid
            rows={filteredRows}
            columns={columns}
            pageSize={5}
            rowsPerPageOptions={[5]}
            autoHeight
            sx={{
              fontFamily: "Nunito, sans-serif",
              border: "2px solid #2A2F5B",
              borderRadius: 2,
              boxShadow: 2,
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#2A2F5B",
                color: "black",
                fontWeight: "bold",
                fontSize: "1rem",
              },
              "& .MuiDataGrid-cell": {
                borderBottom: "1px solid #ddd",
              },
              "& .MuiDataGrid-row:hover": {
                backgroundColor: "#f0f4ff",
              },
              "& .MuiDataGrid-columnHeaderTitle": {
                fontWeight: "bold",
                color: "#333",
              },
            }}
          />
        </Box>

        {/* Map Dialog */}
        <Dialog open={openMap} onClose={() => setOpenMap(false)} maxWidth="md">
          <DialogTitle>
            Location Map
            <IconButton onClick={() => setOpenMap(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <iframe
              title="Map"
              width="100%"
              height="400"
              frameBorder="0"
              style={{ border: 0 }}
              src={`https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&z=15&output=embed`}
              allowFullScreen
            ></iframe>
          </DialogContent>
        </Dialog>

        {/* Image Dialog */}
        <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="md">
          <DialogTitle>
            Image Viewer
            <IconButton onClick={() => setOpenImg(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box position="relative">
              <img src={imgSrc} alt="Preview" style={{ maxWidth: "100%", maxHeight: "400px" }} />
              <Box mt={2}>
                <Typography variant="body2"><strong>Timestamp:</strong> {imgMeta.timestamp || "N/A"}</Typography>
                <Typography variant="body2"><strong>Location:</strong> {imgMeta.latitude}, {imgMeta.longitude}</Typography>
                <Typography variant="body2"><strong>Region:</strong> {imgMeta.hub_name || "N/A"}</Typography>
              </Box>
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
