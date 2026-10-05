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
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// Convert UTC ISO string to IST-local DD-MM-YYYY (robust)
const formatUTCToISTDate = (utcIsoString) => {
  if (!utcIsoString || utcIsoString.trim() === "") return "N/A";

  const utcDate = new Date(utcIsoString);
  if (isNaN(utcDate.getTime())) return "N/A"; // Invalid → show N/A, not "Invalid Date"

  // Add IST offset: +5 hours 30 minutes
  const istDate = new Date(utcDate.getTime() + 5.5 * 60 * 60 * 1000);

  const day = String(istDate.getUTCDate()).padStart(2, "0");
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const year = istDate.getUTCFullYear();

  return `${day}-${month}-${year}`;
};

export default function UserTable() {
  const [filter, setFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [rows, setRows] = useState([]);
  const [openImg, setOpenImg] = useState(false);
  const [imgSrcs, setImgSrcs] = useState([]);
  const [imgIndex, setImgIndex] = useState(0);
  const [openMap, setOpenMap] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: 0, lng: 0 });
  const [districtMaster, setDistrictMaster] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    const fetchDistrictMaster = async () => {
      try {
        const resp = await fetch("http://localhost:3000/dashboard/mos-district");
        const data = await resp.json();
        setDistrictMaster(data);
      } catch (e) {
        console.error("Error fetching district master", e);
      }
    };
    fetchDistrictMaster();
  }, []);

  useEffect(() => {
    if (districtMaster.length === 0) return;

    const fetchDashboardData = async () => {
      try {
        const resp = await fetch("http://localhost:3000/dashboard/datacollection");
        const data = await resp.json();

        const formatted = data.map((d, i) => {
          const districtOrHUD = d.district_name || "Unknown";

          let userLat = null;
          let userLng = null;
          if (typeof d.user_geolocation === "string" && d.user_geolocation.includes(",")) {
            const [latStr, lngStr] = d.user_geolocation.split(",");
            userLat = parseFloat(latStr.trim());
            userLng = parseFloat(lngStr.trim());
          } else if (d.user_geolocation?.latitude && d.user_geolocation?.longitude) {
            userLat = d.user_geolocation.latitude;
            userLng = d.user_geolocation.longitude;
          }

          let lat = null;
          let lng = null;
          if (d.geolocation) {
            lat = d.geolocation.latitude;
            lng = d.geolocation.longitude;
          }

          const displayDate = formatUTCToISTDate(d.date);

          return {
            id: i + 1,
            district_name: districtOrHUD,
            block_name: d.block_name || "N/A",
            userId: d.user_id,
            username: d.username,
            monitoringArea: d.monitoringArea || "N/A",
            userGeo: userLat && userLng ? `Lat: ${userLat}, Lng: ${userLng}` : "N/A",
            date: displayDate,
            time: d.time || "N/A",
            pictures: d.image_base64?.trim()
              ? [`http://localhost:3000${d.image_base64.replace(/\\/g, "/")}`]
              : [],
            geo: lat && lng ? `Lat: ${lat}, Lng: ${lng}` : "N/A",
            lat: lat || 0,
            lng: lng || 0,
            areaType: d.areaType || "",
            address: d.address || "",
          };
        });

        setRows(formatted);
      } catch (e) {
        console.error("Error fetching dashboard data", e);
      }
    };

    fetchDashboardData();
  }, [districtMaster]);

  // UPDATED & ROBUST DATE FILTERING ONLY
  // Only the filtering part is updated below — rest of the code is identical

  // FIXED: Inclusive date range filtering (includes selected From and To dates)
  const filteredRows = rows.filter((row) => {
    // Skip rows with no valid date
    if (!row.date || row.date === "N/A") return false;

    // Username filter
    const matchesFilter = filter
      ? row.username.toLowerCase().includes(filter.toLowerCase())
      : true;

    // District, Block, Area filters
    const matchesDistrict = districtFilter ? row.district_name === districtFilter : true;
    const matchesBlock = blockFilter ? row.block_name === blockFilter : true;
    const matchesArea = areaFilter
      ? (row.areaType || "").toLowerCase() === areaFilter.toLowerCase()
      : true;

    // Safely parse DD-MM-YYYY → Date object
    const parts = row.date.split("-");
    if (parts.length !== 3) return false;

    const [day, month, year] = parts.map(Number);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return false;

    const rowDateObj = new Date(year, month - 1, day);
    if (isNaN(rowDateObj.getTime())) return false;

    // Date range filtering - NOW INCLUSIVE
    let matchesDate = true;

    if (fromDate) {
      const fromObj = new Date(fromDate);
      fromObj.setHours(0, 0, 0, 0); // Start of the "From" day
      if (rowDateObj < fromObj) matchesDate = false;
    }

    if (toDate && matchesDate) {
      const toObj = new Date(toDate);
      toObj.setHours(23, 59, 59, 999); // End of the "To" day
      if (rowDateObj > toObj) matchesDate = false;
    }

    return matchesFilter && matchesDistrict && matchesBlock && matchesArea && matchesDate;
  });

  const uniqueDistricts = [...new Set(rows.map((row) => row.district_name))];
  const uniqueBlocks = [...new Set(rows.map((row) => row.block_name))];

  const downloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Collection");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "District", key: "district_name", width: 20 },
      { header: "Block", key: "block_name", width: 20 },
      { header: "Username", key: "username", width: 20 },
      { header: "DBC Monitoring Area", key: "monitoringArea", width: 20 },
      { header: "Area Type", key: "areaType", width: 15 },
      { header: "Date", key: "date", width: 15 },
      { header: "Time", key: "time", width: 15 },
      { header: "Geolocation", key: "geo", width: 30 },
      { header: "Address", key: "address", width: 40 },
    ];

    filteredRows.forEach((row) => {
      worksheet.addRow({
        id: row.id,
        district_name: row.district_name,
        block_name: row.block_name,
        username: row.username,
        monitoringArea: row.monitoringArea || "",
        areaType: row.areaType,
        date: row.date,
        time: row.time,
        geo: row.geo,
        address: row.address,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "DataCollection.xlsx");
  };

  const columns = [
    { field: "id", headerName: "ID", width: 70 },
    { field: "district_name", headerName: "District", width: 130 },
    { field: "block_name", headerName: "Block", width: 130 },
    { field: "username", headerName: "UserName", width: 130 },
    { field: "areaType", headerName: "Area Type", width: 120 },
    { field: "monitoringArea", headerName: "DBC Monitoring Area", width: 120 },
    { field: "date", headerName: "Date", width: 130 },
    { field: "time", headerName: "Time", width: 130 },
    { field: "geo", headerName: "Geolocation", width: 290 },
    { field: "address", headerName: "Address", width: 290 },
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

  return (
    <DashboardLayout>
      <Box p={2} sx={{ fontFamily: "Nunito, Poppins, sans-serif", paddingTop: "125px", paddingLeft: "100px" }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 550, color: "#2A2F5B", fontFamily: "Nunito, sans-serif" }}>
          DATA SET (District-Wise Information)
        </Typography>

        <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
          <FormControl sx={{ minWidth: 120 }} size="small">
            <Select displayEmpty value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
              <MenuItem value=""><em>All Districts</em></MenuItem>
              {uniqueDistricts.map((district, index) => (
                <MenuItem key={index} value={district}>{district}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }} size="small">
            <Select displayEmpty value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)}>
              <MenuItem value=""><em>All Blocks</em></MenuItem>
              {uniqueBlocks.map((block, index) => (
                <MenuItem key={index} value={block}>{block}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }} size="small">
            <Select displayEmpty value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
              <MenuItem value=""><em>All Areas</em></MenuItem>
              <MenuItem value="Urban">Urban</MenuItem>
              <MenuItem value="Rural">Rural</MenuItem>
            </Select>
          </FormControl>

          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={toDate} onChange={(e) => setToDate(e.target.value)} />

          <Button onClick={downloadExcel} variant="contained" color="success" startIcon={<DownloadForOfflineIcon />} sx={{ textTransform: "none", fontWeight: 600, height: "35px" }}>
            Download Excel
          </Button>
        </Box>

        <Box style={{ height: 600, width: "100%" }}>
          <DataGrid
            rows={filteredRows}
            columns={columns}
            pageSize={10}
            rowsPerPageOptions={[10]}
            sx={{
              "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f5f5f5", fontWeight: 400, fontSize: "1.08rem", color: "#222" },
              "& .MuiDataGrid-cell": { fontSize: "1.08rem", fontWeight: 500, color: "#425466" },
            }}
          />
        </Box>

        <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="md">
          <DialogTitle>
            Image Viewer
            <IconButton aria-label="close" onClick={() => setOpenImg(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {imgSrcs.length > 0 ? (
              <img src={imgSrcs[imgIndex]} alt={`img-${imgIndex}`} style={{ maxWidth: "100%", maxHeight: "70vh" }} />
            ) : (
              <Typography>No Image Available</Typography>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={openMap} onClose={() => setOpenMap(false)} maxWidth="md">
          <DialogTitle>
            Location Map
            <IconButton aria-label="close" onClick={() => setOpenMap(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
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
            ) : (
              <Typography>Invalid Coordinates</Typography>
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}