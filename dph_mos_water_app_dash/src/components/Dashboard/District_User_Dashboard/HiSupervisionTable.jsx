import React, { useEffect, useState } from "react";
import {
  Box,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Typography,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  TablePagination,
  TextField,
} from "@mui/material";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DashboardLayout from "./DashboardLayout";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ---------------- DATE SAFE HELPERS ----------------
const parseDBDate = (dbDate) => {
  if (!dbDate) return null;

  // Handles: "DD/MM/YYYY, HH:mm:ss"
  if (typeof dbDate === "string" && dbDate.includes("/")) {
    const [datePart, timePart = "00:00:00"] = dbDate.split(", ");
    const [day, month, year] = datePart.split("/").map(Number);
    const [h = 0, m = 0, s = 0] = timePart.split(":").map(Number);
    return new Date(year, month - 1, day, h, m, s);
  }

  // Fallback for ISO
  return new Date(dbDate);
};

const getLocalDateOnly = (dbDate) => {
  const d = parseDBDate(dbDate);
  if (!d || isNaN(d)) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};


const DistHISupervisionTable = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [districtFilter, setDistrictFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [photoModal, setPhotoModal] = useState({ open: false, photos: [], index: 0 });
  const [mapModal, setMapModal] = useState({ open: false, locations: [] });
  const [errorLogs, setErrorLogs] = useState([]); // collect row-level errors
  const [blocks, setBlocks] = useState([]);
  const [usernameOptions, setUsernameOptions] = useState([]);


  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [districtUser, setDistrictUser] = useState(null);
  // Inside your component, define blockOptions after districtUser is available
  const blockOptions = districtUser
    ? [...new Set(
      blocks
        .filter((b) => {
          const userDistrict = districtUser.district_name?.toLowerCase() || "";
          const districtName = b.district_name?.toLowerCase() || "";
          const sim = similarity(userDistrict, districtName);
          return sim >= 85;
        })
        .map((b) => b.block_name)
    )].sort()
    : [];

  // const usernameOptions = [...new Set(data.map((d) => d.username))].sort();



  useEffect(() => {
    const fetchDistrictUser = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/district-officers");
        const users = await res.json();
        const loggedInUsername = localStorage.getItem("loggedInUsername");
        const matchedUser = users.find(
          (u) => u.username.toLowerCase() === loggedInUsername?.toLowerCase()
        );
        if (matchedUser) setDistrictUser(matchedUser);
        else alert("User not authorized or not found");
      } catch (err) {
        // console.error("Error fetching district user:", err);
      }
    };
    fetchDistrictUser();
  }, []);


  useEffect(() => {
    const fetchBlocks = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/mosquito-blocks");
        const json = await res.json();
        setBlocks(json); // Assuming json = [{ block_name, district_name }, ...]
      } catch (err) {
        console.error("Error fetching blocks:", err);
      }
    };
    fetchBlocks();
  }, []);

  // Fetch HI monitoring data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/hi-monitoring");
        const json = await res.json();

        const mapped = json.map((item) => {
          const photos = [];
          const locations = [];
          for (let i = 0; i < 10; i++) {
            const path = item[`photo${i}`];
            const lat = item[`photo${i}_lat`];
            const long = item[`photo${i}_long`];
            if (path) {
              const uri = path.startsWith("http") ? path : `http://localhost:3000${path}`;
              photos.push(uri);
              if (lat && long && !isNaN(lat) && !isNaN(long)) {
                locations.push({ lat: Number(lat), lng: Number(long) });
              } else if (lat || long) {
                console.warn(
                  `⚠️ Invalid coordinates for user ${item.hi_name}: lat=${lat}, long=${long}`
                );
              }
            }
          }

          return {
            username: item.hi_name,
            district: item.district_name || "N/A",
            block_name: item.block_name || "N/A",
            count: item.total_visited || 0,
            total_target: item.total_target || 0,
            num_dbcs: item.num_dbcs || 0,
            verified: item.verified || "No",
            timestamp: item.timestamp,
            photos,
            locations,
          };
        });

        setData(mapped);
        setFilteredData(mapped);
      } catch (err) {
        console.error("❌ Error fetching HI monitoring data:", err);
        alert("Failed to load HI Monitoring data. Check console for details.");
      }
    };
    fetchData();
  }, []);

  const calculateDistance = (locations) => {
    if (!locations || locations.length < 2) return 0;
    const toRad = (val) => (val * Math.PI) / 180;
    const R = 6371;
    let dist = 0;
    for (let i = 1; i < locations.length; i++) {
      const { lat: lat1, lng: lon1 } = locations[i - 1];
      const { lat: lat2, lng: lon2 } = locations[i];
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      dist += R * c;
    }
    return dist.toFixed(2);
  };

  function levenshteinDistance(a = "", b = "") {
    const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
      Array(a.length + 1).fill(0)
    );
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        if (a[i - 1] === b[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] =
            Math.min(
              matrix[j - 1][i - 1] + 1,
              matrix[j][i - 1] + 1,
              matrix[j - 1][i] + 1
            );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
    const maxLen = Math.max(a.length, b.length);
    return ((maxLen - distance) / maxLen) * 100;
  }

  useEffect(() => {
    const fetchUsernames = async () => {
      if (!districtUser) return;

      try {
        const res = await fetch("http://localhost:3000/dashboard/village-user");
        const allUsers = await res.json();

        const userDistrict = (districtUser.district_name || "").toLowerCase();

        const filteredUsers = allUsers.filter(u => {
          const uDistrict = (u.hud_name || "").toLowerCase(); // <-- use hud_name here
          const sim = similarity(userDistrict, uDistrict);
          // console.log("Comparing:", userDistrict, "vs", uDistrict, "=>", sim);
          return sim >= 85; // 60% similarity threshold
        });

        if (filteredUsers.length === 0) {
          // console.warn("No users found for district:", districtUser.district_name);
        }

        setUsernameOptions(filteredUsers.map(u => u.username).sort());
        // console.log("Filtered usernames:", filteredUsers.map(u => u.username));
      } catch (err) {
        console.error("Error fetching usernames:", err);
      }
    };

    fetchUsernames();
  }, [districtUser]);

  // Filtering logic
  useEffect(() => {
    let filtered = [...data];
    const mismatched = [];

    if (districtUser) {
      const userDistrict = districtUser.district_name?.toLowerCase() || "";

      filtered = filtered.filter((d) => {
        const districtName = d.district?.toLowerCase() || "";
        const sim = similarity(userDistrict, districtName);
        if (sim < 80) {
          mismatched.push({
            dataDistrict: districtName,
            userDistrict,
            similarity: sim.toFixed(2),
          });
        }
        return sim >= 80;
      });

      if (mismatched.length) {
        // console.warn("⚠️ Districts skipped due to low similarity:", mismatched);
      }
    }

    if (districtFilter)
      filtered = filtered.filter(
        (d) => d.district?.toLowerCase() === districtFilter.toLowerCase()
      );
    if (blockFilter)
      filtered = filtered.filter(
        (d) => d.block_name?.toLowerCase() === blockFilter.toLowerCase()
      );
    if (usernameFilter)
      filtered = filtered.filter(
        (d) => d.username?.toLowerCase() === usernameFilter.toLowerCase()
      );
    if (fromDate)
      filtered = filtered.filter(
        (d) => getLocalDateOnly(d.timestamp) >= fromDate
      );

    if (toDate)
      filtered = filtered.filter(
        (d) => getLocalDateOnly(d.timestamp) <= toDate
      );
    if (colorFilter) {
      filtered = filtered.filter((item) => {
        const percent = item.total_target
          ? (item.count / item.total_target) * 100
          : 0;
        if (percent < 80 && colorFilter === "red") return true;
        if (percent >= 80 && percent < 100 && colorFilter === "orange") return true;
        if (percent >= 100 && colorFilter === "green") return true;
        return false;
      });
    }

    setFilteredData(filtered);
    setPage(0);
  }, [districtFilter, blockFilter, usernameFilter, fromDate, toDate, colorFilter, data, districtUser]);

  const formatDate = (dbDate) => {
    const d = parseDBDate(dbDate);
    if (!d || isNaN(d)) return "N/A";

    return `${String(d.getDate()).padStart(2, "0")}-${String(
      d.getMonth() + 1
    ).padStart(2, "0")}-${d.getFullYear()}`;
  };

  // Excel download with error reporting
  const downloadExcel = async () => {
    try {
      if (!filteredData.length) {
        alert("No data available to download.");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("HI Monitoring");

      worksheet.columns = [
        { header: "S.No", key: "sno", width: 10 },
        { header: "HI Name", key: "username", width: 25 },
        { header: "District", key: "district", width: 25 },
        { header: "Block", key: "block", width: 20 },
        { header: "No. of DBCs", key: "num_dbcs", width: 15 },
        { header: "Visited", key: "count", width: 15 },
        { header: "Target", key: "total_target", width: 15 },
        { header: "Percentage", key: "percent", width: 15 },
        { header: "Verified", key: "verified", width: 15 },
        { header: "Date", key: "date", width: 15 },
        { header: "Geolocations", key: "latlongs", width: 50 },
      ];

      const localErrors = [];

      filteredData.forEach((item, index) => {
        try {
          const percent = item.total_target
            ? ((item.count / item.total_target) * 100).toFixed(2) + "%"
            : "0%";
          const latlongs = item.locations
            ?.map((l) => `(${l.lat.toFixed(6)}, ${l.lng.toFixed(6)})`)
            .join(", ");

          worksheet.addRow({
            sno: index + 1,
            username: item.username,
            district: item.district,
            block: item.block_name,
            num_dbcs: item.num_dbcs,
            count: item.count,
            total_target: item.total_target,
            percent,
            verified: item.verified,
            date: formatDate(item.timestamp),
            latlongs,
          });
        } catch (rowErr) {
          localErrors.push({
            district: item.district,
            username: item.username,
            message: rowErr.message,
          });
        }
      });

      if (localErrors.length) {
        console.error("⚠️ Some rows could not be added to Excel:", localErrors);
        setErrorLogs(localErrors);
        alert(
          `⚠️ ${localErrors.length} rows failed to add. Check console for details.`
        );
      }

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        "HI_Monitoring_Report.xlsx"
      );

      console.log("✅ Excel downloaded successfully!");
    } catch (err) {
      console.error("❌ Excel download failed:", err);
      alert("Excel download failed. Check console for error details.");
    }
  };

  if (!data.length)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  // const blockOptions = [...new Set(data.map((d) => d.block_name))].sort();
  // const usernameOptions = [...new Set(data.map((d) => d.username))].sort();

  const openPhotoModal = (photos, index = 0) => {
    setPhotoModal({ open: true, photos, index });
  };

  const openMapModal = (locations) => {
    if (!locations || locations.length === 0) return;
    setMapModal({ open: true, locations });
  };

  return (
    <DashboardLayout>
      <Box sx={{ marginLeft: 9, pt: 15, pb: 4 }}>
        <Typography variant="h5" fontWeight={700} mb={2}>
          HOUSES VISITED BY USERS
        </Typography>

        {/* Filters */}
        <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>Block</InputLabel>
            <Select
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
              label="Block"
            >
              <MenuItem value="">All Blocks</MenuItem>
              {blockOptions.map((b, i) => (
                <MenuItem key={i} value={b}>
                  {b}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>User</InputLabel>
            <Select
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
              label="User"
            >
              <MenuItem value="">All Users</MenuItem>
              {usernameOptions.map((u, i) => (
                <MenuItem key={i} value={u}>
                  {u}
                </MenuItem>
              ))}
            </Select>
          </FormControl>


          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>Color Filter</InputLabel>
            <Select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              label="Color Filter"
            >
              <MenuItem value="">All Colors</MenuItem>
              <MenuItem value="red">Red (&lt;80%)</MenuItem>
              <MenuItem value="orange">Orange (80-99%)</MenuItem>
              <MenuItem value="green">Green (100%)</MenuItem>
            </Select>
          </FormControl>

          <TextField
            type="date"
            label="From Date"
            InputLabelProps={{ shrink: true }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <TextField
            type="date"
            label="To Date"
            InputLabelProps={{ shrink: true }}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          <Button
            variant="contained"
            color="success"
            startIcon={<DownloadForOfflineIcon />}
            onClick={downloadExcel}
          >
            Download Excel
          </Button>
        </Box>


        {/* Table */}
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 670 }} size="small">
            <TableHead>
              <TableRow>
                {[
                  "S. No",
                  "Username",
                  "District",
                  "Block",
                  "No of DBCs",
                  "Visited",
                  "Target",
                  "Percentage",
                  "Verified",
                  "Date",
                  "Photos",
                  "Geolocations",
                  "Map",
                  "Distance (km)",
                ].map((head, idx) => (
                  <TableCell
                    key={idx}
                    sx={{
                      fontWeight: "bold",
                      bgcolor: "#fff",
                      color: "#333",
                      py: 2,
                      fontSize: "15px",
                      textAlign: "center",
                    }}
                  >
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredData
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((user, idx) => {
                  const percentValue = user.total_target
                    ? (user.count / user.total_target) * 100
                    : 0;
                  const bgcolor =
                    percentValue < 80
                      ? "#ca0b0b"
                      : percentValue < 100
                        ? "#FF8C00"
                        : "#006400";
                  const latlongs = user.locations
                    .map((l) => `(${l.lat.toFixed(6)}, ${l.lng.toFixed(6)})`)
                    .join(", ");

                  return (
                    <TableRow key={idx}>
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.district}</TableCell>
                      <TableCell>{user.block_name}</TableCell>
                      <TableCell>{user.num_dbcs}</TableCell>
                      <TableCell>{user.count}</TableCell>
                      <TableCell>{user.total_target}</TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          textAlign: "center",
                          color: "#fff",
                          bgcolor,
                        }}
                      >
                        {percentValue.toFixed(2)}%
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          textAlign: "center",
                          color: user.verified === "Yes" ? "green" : "red",
                        }}
                      >
                        {user.verified}
                      </TableCell>
                      <TableCell>{formatDate(user.timestamp)}</TableCell>

                      {/* Photos */}
                      <TableCell>
                        {user.photos.slice(0, 3).map((photo, i) => (
                          <Box
                            key={i}
                            component="img"
                            src={photo}
                            alt={`HI Photo ${i}`}
                            sx={{
                              width: 30,
                              height: 30,
                              mr: 0.5,
                              borderRadius: 1,
                              objectFit: "cover",
                              border: "1px solid #ccc",
                              cursor: "pointer",
                            }}
                            onClick={() => openPhotoModal(user.photos, i)}
                          />
                        ))}
                        {user.photos.length > 3 && (
                          <Box
                            component="span"
                            sx={{
                              ml: 0.5,
                              cursor: "pointer",
                              fontWeight: 600,
                              color: "#007bff",
                            }}
                            onClick={() => openPhotoModal(user.photos, 3)}
                          >
                            +{user.photos.length - 3}
                          </Box>
                        )}
                      </TableCell>

                      <TableCell sx={{ fontSize: "12px" }}>{latlongs || "N/A"}</TableCell>

                      {/* Geolocation Eye */}
                      <TableCell sx={{ textAlign: "center" }}>
                        {user.locations.length > 0 && (
                          <IconButton onClick={() => openMapModal(user.locations)}>
                            <VisibilityIcon />
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, textAlign: "center", color: "#1a73e8" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "center" }}>
                          {calculateDistance(user.locations)} km
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>

          {/* Pagination */}
          <TablePagination
            component="div"
            count={filteredData.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </TableContainer>

        {/* Photo Modal */}
        <Dialog
          open={photoModal.open}
          onClose={() => setPhotoModal({ open: false, photos: [], index: 0 })}
          maxWidth="lg"
          fullWidth
        >
          <DialogContent sx={{ position: "relative", textAlign: "center", p: 0 }}>
            <IconButton
              onClick={() => setPhotoModal({ open: false, photos: [], index: 0 })}
              sx={{ position: "absolute", top: 8, right: 8, bgcolor: "#fff", zIndex: 10 }}
            >
              <CloseIcon />
            </IconButton>
            {photoModal.photos.length > 0 && (
              <Box
                component="img"
                src={photoModal.photos[photoModal.index]}
                alt={`selected ${photoModal.index}`}
                sx={{ maxWidth: "90vw", maxHeight: "80vh" }}
              />
            )}
            <Button
              onClick={() =>
                setPhotoModal((prev) => ({
                  ...prev,
                  index: (prev.index - 1 + prev.photos.length) % prev.photos.length,
                }))
              }
              sx={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              ←
            </Button>
            <Button
              onClick={() =>
                setPhotoModal((prev) => ({
                  ...prev,
                  index: (prev.index + 1) % prev.photos.length,
                }))
              }
              sx={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              →
            </Button>
          </DialogContent>
        </Dialog>

        {/* Map Modal */}
        <Dialog
          open={mapModal.open}
          onClose={() => setMapModal({ open: false, locations: [] })}
          maxWidth="lg"
          fullWidth
        >
          <DialogContent sx={{ position: "relative", height: "80vh", p: 0 }}>
            {/* Close Button */}
            <IconButton
              onClick={() => setMapModal({ open: false, locations: [] })}
              sx={{ position: "absolute", top: 8, right: 8, bgcolor: "#fff", zIndex: 10 }}
            >
              <CloseIcon />
            </IconButton>

            {mapModal.locations.length > 0 && (() => {
              const positions = mapModal.locations.map((loc) => [loc.lat, loc.lng]);
              const first = positions[0];
              const last = positions[positions.length - 1];

              // Calculate total distance along the path
              const totalDistanceKm = (() => {
                const toRad = (val) => (val * Math.PI) / 180;
                const R = 6371;
                let dist = 0;
                for (let i = 1; i < positions.length; i++) {
                  const [lat1, lon1] = positions[i - 1];
                  const [lat2, lon2] = positions[i];
                  const dLat = toRad(lat2 - lat1);
                  const dLon = toRad(lon2 - lon1);
                  const a =
                    Math.sin(dLat / 2) ** 2 +
                    Math.cos(toRad(lat1)) *
                    Math.cos(toRad(lat2)) *
                    Math.sin(dLon / 2) ** 2;
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                  dist += R * c;
                }
                return dist.toFixed(2);
              })();

              return (
                <MapContainer
                  center={first}
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                  {/* Start Marker */}
                  <Marker position={first}>
                    <Popup>
                      Start: {first[0].toFixed(6)}, {first[1].toFixed(6)}
                    </Popup>
                  </Marker>

                  {/* End Marker */}
                  <Marker position={last}>
                    <Popup>
                      End: {last[0].toFixed(6)}, {last[1].toFixed(6)} <br />
                      Total Distance: {totalDistanceKm} km
                    </Popup>
                  </Marker>

                  {/* Path through all points */}
                  <Polyline positions={positions} color="blue" weight={3} opacity={0.7} />

                  {/* Distance overlay */}
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "rgba(255, 255, 255, 0.9)",
                      padding: "8px 14px",
                      borderRadius: 8,
                      zIndex: 1000,
                      fontWeight: "bold",
                      fontSize: "16px",
                      color: "#1a73e8",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>📏</span>
                    Path Distance: {totalDistanceKm} km
                  </div>
                </MapContainer>
              );
            })()}
          </DialogContent>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
};

export default DistHISupervisionTable;
