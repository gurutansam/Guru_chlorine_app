import React, { useEffect, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "./DashboardLayout";
import {
  Box,
  IconButton,
  Typography,
  MenuItem,
  FormControl,
  Select,
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";

// Convert UTC ISO timestamp to correct IST DD-MM-YYYY date
const formatUTCToISTDate = (utcIsoString) => {
  if (!utcIsoString) return "N/A";

  const utcDate = new Date(utcIsoString);
  if (isNaN(utcDate.getTime())) return "Invalid Date";

  // Add IST offset: +5 hours 30 minutes
  const istDate = new Date(utcDate.getTime() + 5.5 * 60 * 60 * 1000);

  const day = String(istDate.getUTCDate()).padStart(2, "0");
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const year = istDate.getUTCFullYear();

  return `${day}-${month}-${year}`;
};

// Helper: Convert YYYY-MM-DD (from date input) to DD-MM-YYYY for comparison
const formatInputDateToDDMMYYYY = (input) => {
  if (!input) return null;
  const [year, month, day] = input.split("-");
  return `${day}-${month}-${year}`;
};

export default function UserTable() {
  const [rows, setRows] = useState([]);
  const [districtUser, setDistrictUser] = useState(null);
  const [areaFilter, setAreaFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openImg, setOpenImg] = useState(false);
  const [imgSrcs, setImgSrcs] = useState([]);
  const [imgIndex, setImgIndex] = useState(0);
  const [openMap, setOpenMap] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: 0, lng: 0 });

  // Fetch logged-in district user
  useEffect(() => {
    const fetchUser = async () => {
      const loggedInUsername = localStorage.getItem("loggedInUsername");
      try {
        const res = await fetch("http://localhost:3000/dashboard/district-officers");
        const data = await res.json();
        const match = data.find(u => u.username === loggedInUsername);
        if (match) setDistrictUser(match);
      } catch (err) {
        console.error("Error fetching district user:", err);
      }
    };
    fetchUser();
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    if (!districtUser) return;

    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/datacollection");
        const data = await res.json();

        // Filter by district_name of logged-in user
        const filtered = data
          .filter(d =>
            d.district_name?.trim().toLowerCase() === districtUser.district_name?.trim().toLowerCase()
          )
          .map((d, i) => {
            const lat = d.geolocation?.latitude || 0;
            const lng = d.geolocation?.longitude || 0;

            // Fix: Convert UTC timestamp to correct IST date
            const displayDate = formatUTCToISTDate(d.date);

            return {
              id: i + 1,
              district_name: d.district_name,
              username: d.username,
              block_name: d.block_name || "N/A",
              monitoringArea: d.monitoringArea || "N/A",
              areaType: d.areaType || "",
              date: displayDate, // Now correct IST date, e.g., 30-11-2025 instead of 01-12-2025
              time: d.time,
              geo: lat && lng ? `Lat: ${lat}, Lng: ${lng}` : "N/A",
              lat,
              lng,
              address: d.address || "N/A",
              pictures: d.image_base64
                ? [`http://localhost:3000${d.image_base64.replace(/\\/g, "/")}`]
                : [],
            };
          });

        setRows(filtered);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      }
    };

    fetchData();
  }, [districtUser]);

  // Compute unique blocks for filter dropdown
  const uniqueBlocks = [...new Set(rows.map(row => row.block_name))];

  // Filter rows dynamically by area, block, and date
  const filteredRows = rows.filter(row => {
    const matchesArea = areaFilter ? row.areaType.toLowerCase() === areaFilter.toLowerCase() : true;
    const matchesBlock = blockFilter ? row.block_name === blockFilter : true;

    // Convert input dates to DD-MM-YYYY for correct comparison
    const fromFormatted = fromDate ? formatInputDateToDDMMYYYY(fromDate) : null;
    const toFormatted = toDate ? formatInputDateToDDMMYYYY(toDate) : null;

    const matchesDate =
      (!fromFormatted || row.date >= fromFormatted) &&
      (!toFormatted || row.date <= toFormatted);

    return matchesArea && matchesBlock && matchesDate;
  });

  const columns = [
    { field: "id", headerName: "ID", width: 70 },
    { field: "district_name", headerName: "District", width: 130 },
    { field: "block_name", headerName: "Block", width: 130 },
    { field: "username", headerName: "UserName", width: 130 },
    { field: "areaType", headerName: "Area Type", width: 120 },
    { field: "monitoringArea", headerName: "DBC Monitoring Area", width: 120 },
    { field: "date", headerName: "Date", width: 130 },
    { field: "time", headerName: "Time", width: 130 },
    { field: "geo", headerName: "Geolocation", width: 250 },
    { field: "address", headerName: "Address", width: 250 },
    {
      field: "pictures",
      headerName: "Images",
      width: 100,
      renderCell: (params) => (
        <IconButton onClick={() => { setImgSrcs(params.value || []); setImgIndex(0); setOpenImg(true); }}>
          <VisibilityIcon />
        </IconButton>
      ),
    },
    {
      field: "mapView",
      headerName: "Map",
      width: 100,
      renderCell: (params) => (
        <IconButton onClick={() => { setMapCoords({ lat: params.row.lat, lng: params.row.lng }); setOpenMap(true); }}>
          <VisibilityIcon />
        </IconButton>
      ),
    },
  ];

  const downloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("District Data");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "District", key: "district_name", width: 20 },
      { header: "Block", key: "block_name", width: 20 },
      { header: "Username", key: "username", width: 20 },
      { header: "Area Type", key: "areaType", width: 15 },
      { header: "DBC Monitoring Area", key: "monitoringArea", width: 15 },
      { header: "Date", key: "date", width: 15 },
      { header: "Time", key: "time", width: 15 },
      { header: "Geolocation", key: "geo", width: 30 },
      { header: "Address", key: "address", width: 40 },
    ];

    filteredRows.forEach(row => {
      worksheet.addRow({
        id: row.id,
        district_name: row.district_name,
        block_name: row.block_name,
        username: row.username,
        areaType: row.areaType,
        monitoringArea: row.monitoringArea || "",
        date: row.date, // Correct IST date
        time: row.time,
        geo: row.geo,
        address: row.address,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "DistrictData.xlsx");
  };

  return (
    <DashboardLayout>
      <Box p={2}>
        <Typography variant="h5" gutterBottom>District Data Set</Typography>

        <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
          {/* Area Filter */}
          <FormControl sx={{ minWidth: 120 }} size="small">
            <Select displayEmpty value={areaFilter} onChange={e => setAreaFilter(e.target.value)}>
              <MenuItem value="">All Areas</MenuItem>
              <MenuItem value="Urban">Urban</MenuItem>
              <MenuItem value="Rural">Rural</MenuItem>
            </Select>
          </FormControl>

          {/* Block Filter */}
          <FormControl sx={{ minWidth: 120 }} size="small">
            <Select displayEmpty value={blockFilter} onChange={e => setBlockFilter(e.target.value)}>
              <MenuItem value="">All Blocks</MenuItem>
              {uniqueBlocks.map((block, idx) => (
                <MenuItem key={idx} value={block}>{block}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Date Filters - unchanged */}
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={toDate} onChange={e => setToDate(e.target.value)} />

          <Button variant="contained" color="success" onClick={downloadExcel} startIcon={<DownloadForOfflineIcon />}>Download</Button>
        </Box>

        <Box style={{ height: 600, width: "100%" }}>
          <DataGrid rows={filteredRows} columns={columns} pageSize={10} sx={{
            fontFamily: "Nunito, Poppins, sans-serif",
            "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f5f5f5", fontWeight: 400, fontSize: "1.08rem", color: "#222" },
            "& .MuiDataGrid-cell": { fontSize: "1.08rem", fontWeight: 500, color: "#425466" },
          }} />
        </Box>

        {/* Image Dialog */}
        <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="md">
          <DialogTitle>
            Image Viewer
            <IconButton aria-label="close" onClick={() => setOpenImg(false)} sx={{ position: "absolute", right: 8, top: 8 }}><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent>
            {imgSrcs.length > 0 ? <img src={imgSrcs[imgIndex]} alt={`img-${imgIndex}`} style={{ maxWidth: "100%", maxHeight: "70vh" }} /> : <Typography>No Image Available</Typography>}
          </DialogContent>
        </Dialog>

        {/* Map Dialog */}
        <Dialog open={openMap} onClose={() => setOpenMap(false)} maxWidth="md">
          <DialogTitle>
            Location Map
            <IconButton aria-label="close" onClick={() => setOpenMap(false)} sx={{ position: "absolute", right: 8, top: 8 }}><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent>
            {mapCoords.lat !== 0 && mapCoords.lng !== 0 ? (
              <iframe
                title="Map View"
                width="100%"
                height="400"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                src={`https://www.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&z=15&output=embed`}
              ></iframe>
            ) : <Typography>Invalid Coordinates</Typography>}
          </DialogContent>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}