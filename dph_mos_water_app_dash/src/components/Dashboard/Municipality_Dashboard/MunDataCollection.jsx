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
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";

export default function MunUserTable() {
  const [rows, setRows] = useState([]);
  const [districtMaster, setDistrictMaster] = useState([]);
  const [districtUser, setDistrictUser] = useState(null);
  const [districtFilter, setDistrictFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState(""); // Added block filter
  const [openImg, setOpenImg] = useState(false);
  const [imgSrcs, setImgSrcs] = useState([]);
  const [imgIndex, setImgIndex] = useState(0);
  const [openMap, setOpenMap] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: 0, lng: 0 });

  // Fetch logged-in user (district officer)
  useEffect(() => {
    const fetchOnlyCorporationUsers = async () => {
      const loggedInUsername = localStorage.getItem("loggedInUsername");
      try {
        const res = await fetch(`http://localhost:3000/dashboard/district-officers?type=municipality_user`);
        const data = await res.json();

        const match = data.find(u => u.username === loggedInUsername);
        if (match) setDistrictUser(match);
      } catch (err) {
        console.error("Error fetching corporation-only data:", err);
      }
    };

    fetchOnlyCorporationUsers();
  }, []);

  // Fetch district master
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/mos-district");
        const data = await res.json();
        setDistrictMaster(data);
      } catch (e) {
        console.error("Error fetching district master", e);
      }
    };
    fetchDistricts();
  }, []);

  // Fetch data collection once user and master loaded
  useEffect(() => {
    if (!districtUser || districtMaster.length === 0) return;

    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/datacollection");
        const data = await res.json();

        const filtered = data
          .filter(d => d.user_id?.toUpperCase().startsWith(districtUser.district_code.slice(0, 7).toUpperCase()))
          .map((d, i) => {
            const matchedDistrict = districtMaster.find(dm =>
              dm.district_code.toUpperCase().startsWith(districtUser.district_code.slice(0, 7).toUpperCase())
            );

            let lat = 0;
            let lng = 0;
            if (d.geolocation && typeof d.geolocation === "object") {
              lat = d.geolocation.latitude || 0;
              lng = d.geolocation.longitude || 0;
            }

            return {
              id: i + 1,
              district_name: matchedDistrict?.district_name || "Unknown",
              block_name: d.block_name || "N/A",
              monitoringArea: d.monitoringArea || "N/A",
              userId: d.user_id,
              username: d.username,
              areaType: d.areaType || "",
              date: d.date,
              time: d.time,
              geo: lat && lng ? `Lat: ${lat}, Lng: ${lng}` : "N/A",
              lat,
              lng,
              pictures: d.image_base64
                ? [`http://localhost:3000${d.image_base64.replace(/\\/g, '/')}`]
                : [],
            };
          });

        setRows(filtered);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      }
    };

    fetchData();
  }, [districtUser, districtMaster]);

  const filteredRows = rows.filter((row) => {
    const matchesDistrict = districtFilter ? row.district_name === districtFilter : true;
    const matchesArea = areaFilter ? (row.areaType || "").toLowerCase() === areaFilter.toLowerCase() : true;
    const matchesBlock = blockFilter ? row.block_name === blockFilter : true;
    return matchesDistrict && matchesArea && matchesBlock;
  });

  const uniqueDistricts = [...new Set(rows.map((row) => row.district_name))];
  const uniqueBlocks = [...new Set(rows.map((row) => row.block_name))]; // Unique blocks for dropdown

  const columns = [
    { field: "id", headerName: "ID", width: 70 },
    { field: "district_name", headerName: "District", width: 130 },
    { field: "block_name", headerName: "Block", width: 130 },
    { field: "userId", headerName: "User ID", width: 280 },
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
        <IconButton
          onClick={() => {
            setImgSrcs(params.value || []);
            setImgIndex(0);
            setOpenImg(true);
          }}
        >
          <VisibilityIcon />
        </IconButton>
      ),
    },
    {
      field: "mapView",
      headerName: "Map",
      width: 100,
      renderCell: (params) => (
        <IconButton
          onClick={() => {
            setMapCoords({ lat: params.row.lat, lng: params.row.lng });
            setOpenMap(true);
          }}
        >
          <VisibilityIcon />
        </IconButton>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <Box p={2}>
        <Typography variant="h5" gutterBottom>
          Data Set
        </Typography>

        <Box display="flex" gap={2} alignItems="center" mb={2}>
          {/* District Filter */}
          <FormControl sx={{ minWidth: 120 }} size="small">
            <Select
              displayEmpty
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
            >
              <MenuItem value="">
                <em>All Districts</em>
              </MenuItem>
              {uniqueDistricts.map((district, index) => (
                <MenuItem key={index} value={district}>
                  {district}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Block Filter */}
          <FormControl sx={{ minWidth: 120 }} size="small">
            <Select
              displayEmpty
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
            >
              <MenuItem value="">
                <em>All Blocks</em>
              </MenuItem>
              {uniqueBlocks.map((block, idx) => (
                <MenuItem key={idx} value={block}>{block}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Area Filter */}
          <FormControl sx={{ minWidth: 120 }} size="small">
            <Select
              displayEmpty
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
            >
              <MenuItem value="">
                <em>All Areas</em>
              </MenuItem>
              <MenuItem value="Urban">Urban</MenuItem>
              <MenuItem value="Rural">Rural</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box style={{ height: 600, width: "100%" }}>
          <DataGrid
            rows={filteredRows}
            columns={columns}
            pageSize={10}
            sx={{
              fontFamily: "Nunito, Poppins, sans-serif",
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#f5f5f5",
                fontWeight: 400,
                fontSize: "1.08rem",
                color: "#222",
              },
              "& .MuiDataGrid-cell": {
                fontSize: "1.08rem",
                fontWeight: 500,
                color: "#425466",
              },
            }}
          />
        </Box>

        <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="md">
          <DialogTitle>
            Image Viewer
            <IconButton
              aria-label="close"
              onClick={() => setOpenImg(false)}
              sx={{ position: "absolute", right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {imgSrcs.length > 0 ? (
              <img
                src={imgSrcs[imgIndex]}
                alt={`img-${imgIndex}`}
                style={{ maxWidth: "100%", maxHeight: "70vh" }}
              />
            ) : (
              <Typography>No Image Available</Typography>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={openMap} onClose={() => setOpenMap(false)} maxWidth="md">
          <DialogTitle>
            Location Map
            <IconButton
              aria-label="close"
              onClick={() => setOpenMap(false)}
              sx={{ position: "absolute", right: 8, top: 8 }}
            >
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
