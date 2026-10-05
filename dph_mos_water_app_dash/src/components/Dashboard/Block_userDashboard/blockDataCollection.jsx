import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "./DashboardLayout";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export default function BlockDataTable() {
  const [user, setUser] = useState(null);
  const [blockUsers, setBlockUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [openImg, setOpenImg] = useState(false);
  const [imgSrcs, setImgSrcs] = useState([]);
  const [openMap, setOpenMap] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: 0, lng: 0 });
  const [selectedUsername, setSelectedUsername] = useState("all");
  const [selectedBlock, setSelectedBlock] = useState("all");

  // Fetch logged-in user and all block users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/mosquito-block-users");
        const data = await res.json();
        const loggedInUsername = localStorage.getItem("loggedInUsername");
        const matchedUser = data.find((u) => u.username === loggedInUsername);
        if (matchedUser) setUser(matchedUser);
        setBlockUsers(data);
      } catch (err) {
        console.error("Error fetching block user", err);
      }
    };
    fetchUsers();
  }, []);

  // Fetch data collection based on block
  useEffect(() => {
    if (!user?.block_id || blockUsers.length === 0) return;

    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/datacollection");
        const data = await res.json();

        const filtered = data.filter((entry) => {
          const matchingUser = blockUsers.find((u) => u.user_id === entry.user_id);
          return matchingUser?.block_id === user.block_id;
        });

        const formatted = filtered.map((d, i) => {
          const matchingUser = blockUsers.find((u) => u.user_id === d.user_id);
          const blockName = matchingUser?.block_name || "Unknown";

          const lat = d.geolocation?.latitude || 0;
          const lng = d.geolocation?.longitude || 0;

          return {
            id: i + 1,
            userId: d.user_id,
            username: d.username,
            block_name: blockName,
            monitoringArea: d.monitoringArea || "N/A",
            date: d.date,
            time: d.time,
            areaType: d.areaType || "",
            geo: lat && lng ? `Lat: ${lat}, Lng: ${lng}` : "N/A",
            address: d.address || "N/A",
            lat,
            lng,
            pictures: d.image_base64?.trim()
              ? [`http://localhost:3000${d.image_base64.replace(/\\/g, "/")}`]
              : [],
          };
        });

        setRows(formatted);
      } catch (err) {
        console.error("Error fetching data collection", err);
      }
    };

    fetchData();
  }, [user, blockUsers]);

  // Filter rows based on selected username and block
  const filteredRows = rows.filter((row) => {
    const matchUsername = selectedUsername === "all" || row.username === selectedUsername;
    const matchBlock = selectedBlock === "all" || row.block_name === selectedBlock;
    return matchUsername && matchBlock;
  });

  const uniqueUsernames = [...new Set(rows.map((row) => row.username))];
  const uniqueBlocks = [...new Set(rows.map((row) => row.block_name))];

  const columns = [
    { field: "id", headerName: "ID", width: 70 },
    { field: "userId", headerName: "User ID", width: 280 },
    { field: "username", headerName: "User Name", width: 150 },
    { field: "block_name", headerName: "Block", width: 140 },
    { field: "areaType", headerName: "Area Type", width: 100 },
    { field: "monitoringArea", headerName: "DBC Monitoring Area", width: 100 },
    { field: "date", headerName: "Date", width: 130 },
    { field: "time", headerName: "Time", width: 130 },
    { field: "geo", headerName: "Geolocation", width: 300 },
    { field: "address", headerName: "Address", width: 250 },
    {
      field: "pictures",
      headerName: "Images",
      width: 100,
      renderCell: (params) => (
        <IconButton onClick={() => { setImgSrcs(params.value || []); setOpenImg(true); }}>
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

  // Excel Export
  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Block Data");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Block", key: "block_name", width: 20 },
      { header: "User ID", key: "userId", width: 30 },
      { header: "Username", key: "username", width: 20 },
      { header: "Area Type", key: "areaType", width: 15 },
      { header: "DBC Monitoring Area", key: "monitoringArea", width: 30 },
      { header: "Date", key: "date", width: 15 },
      { header: "Time", key: "time", width: 15 },
      { header: "Geolocation", key: "geo", width: 30 },
      { header: "Address", key: "address", width: 40 },
    ];

    worksheet.addRows(filteredRows);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    saveAs(blob, `block_data.xlsx`);
  };

  return (
    <DashboardLayout>
      <Box p={2}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: "#2A2F5B", mb: 2 }}>
          BLOCK DATA SET – {user?.block_name ? `(${user.block_name})` : ""}
        </Typography>

        {/* Filters */}
        <Box display="flex" gap={2} mb={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Username</InputLabel>
            <Select value={selectedUsername} onChange={(e) => setSelectedUsername(e.target.value)} label="Filter by Username">
              <MenuItem value="all">All</MenuItem>
              {uniqueUsernames.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Block</InputLabel>
            <Select value={selectedBlock} onChange={(e) => setSelectedBlock(e.target.value)} label="Filter by Block">
              <MenuItem value="all">All</MenuItem>
              {uniqueBlocks.map((block) => <MenuItem key={block} value={block}>{block}</MenuItem>)}
            </Select>
          </FormControl>

          <Button variant="contained" onClick={handleExport} sx={{ backgroundColor: "green", "&:hover": { backgroundColor: "#2e7d32" } }}>
            Download Excel
          </Button>
        </Box>

        <DataGrid
          rows={filteredRows}
          columns={columns}
          pageSize={10}
          sx={{
            fontFamily: "Nunito, Poppins, sans-serif",
            height: 600,
            "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f5f5f5", fontWeight: 400, fontSize: "1.08rem", color: "#222" },
            "& .MuiDataGrid-cell": { fontSize: "1.08rem", fontWeight: 500, color: "#425466" },
          }}
        />

        {/* Image Dialog */}
        <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="md">
          <DialogTitle>
            Image Viewer
            <IconButton onClick={() => setOpenImg(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {imgSrcs.length > 0 ? (
              <img src={imgSrcs[0]} alt="block image" style={{ maxWidth: "100%", maxHeight: "70vh" }} />
            ) : (
              <Typography>No Image Available</Typography>
            )}
          </DialogContent>
        </Dialog>

        {/* Map Dialog */}
        <Dialog open={openMap} onClose={() => setOpenMap(false)} maxWidth="md">
          <DialogTitle>
            Location Map
            <IconButton onClick={() => setOpenMap(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
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
              />
            ) : (
              <Typography>Invalid Coordinates</Typography>
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
