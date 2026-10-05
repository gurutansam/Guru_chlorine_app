import React, { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Helper to zoom into bounds
const FitBounds = ({ locations }) => {
  const map = useMap();
  useEffect(() => {
    if (locations && locations.length > 0) {
      const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, map]);
  return null;
};

const DistHiSupervisionMap = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [districtUser, setDistrictUser] = useState(null);

  // Filters
  const [districtFilter, setDistrictFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [blocks, setBlocks] = useState([]);
  const [usernameOptions, setUsernameOptions] = useState([]);


  //   const blockOptions = districtUser
  // ? [...new Set(
  //     blocks
  //       .filter((b) => {
  //         const userDistrict = districtUser.district_name?.toLowerCase() || "";
  //         const districtName = b.district_name?.toLowerCase() || "";
  //         const sim = similarity(userDistrict, districtName);
  //         return sim >= 70;
  //       })
  //       .map((b) => b.block_name)
  //   )].sort()
  // : [];

  // Fetch logged-in user details
  useEffect(() => {
    const fetchDistrictUser = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/district-officers");
        const users = await res.json();
        const loggedInUsername = localStorage.getItem("loggedInUsername");
        const matchedUser = users.find(
          (u) => u.username.toLowerCase() === loggedInUsername?.toLowerCase()
        );
        if (matchedUser) {
          setDistrictUser(matchedUser);
        } else {
          alert("User not authorized or not found");
        }
      } catch (err) {
        console.error("Error fetching district user:", err);
      }
    };
    fetchDistrictUser();
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
              if (lat && long) locations.push({ lat, lng: long });
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
        }).reverse();

        setData(mapped);
        setFilteredData(mapped);
      } catch (err) {
        console.error("Error fetching HI monitoring data", err);
      }
    };
    fetchData();
  }, []);

  // Distance calculator
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

  // Filtering
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
        if (sim < 85) {
          mismatched.push({
            dataDistrict: districtName,
            userDistrict,
            similarity: sim.toFixed(2),
          });
        }
        return sim >= 85;
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
        (d) => new Date(d.timestamp).toISOString().split("T")[0] >= fromDate
      );
    if (toDate)
      filtered = filtered.filter(
        (d) => new Date(d.timestamp).toISOString().split("T")[0] <= toDate
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


  // Derive block and username options from filtered data
  const blockOptions = [...new Set(filteredData.map((d) => d.block_name))].sort();
  // const usernameOptions = [...new Set(filteredData.map((d) => d.username))].sort();

  if (!data.length)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: 3, pl: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", textAlign: "left" }}>
        HI Supervision Map
      </Typography>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
        {/* District Filter (Commented out to enforce logged-in user's district) */}
        {/* <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>District</InputLabel>
          <Select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            label="District"
          >
            <MenuItem value="">All</MenuItem>
            {[...new Set(data.map((d) => d.district))].sort().map((d, i) => (
              <MenuItem key={i} value={d}>
                {d}
              </MenuItem>
            ))}
          </Select>
        </FormControl> */}

        <FormControl size="small" sx={{ minWidth: 150 }}>
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

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Username</InputLabel>
          <Select
            value={usernameFilter}
            onChange={(e) => setUsernameFilter(e.target.value)}
            label="Username"
          >
            <MenuItem value="">All Users</MenuItem>
            {usernameOptions.map((u, i) => (
              <MenuItem key={i} value={u}>
                {u}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          type="date"
          size="small"
          label="From Date"
          InputLabelProps={{ shrink: true }}
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />

        <TextField
          type="date"
          size="small"
          label="To Date"
          InputLabelProps={{ shrink: true }}
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
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
      </Box>

      {/* Map */}
      <MapContainer
        center={[12.9716, 77.5946]}
        zoom={8}
        style={{ height: "60vh", width: "100%" }}
        attributionControl={false} // <-- disable attribution
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />


        {/* Auto zoom to filtered data */}
        {!selectedUser && filteredData.length > 0 && (
          <FitBounds locations={filteredData.flatMap((item) => item.locations)} />
        )}

        {!selectedUser &&
          filteredData.map((item, idx) => {
            if (!item.locations.length) return null;
            const first = item.locations[0];
            const percent = item.total_target ? (item.count / item.total_target) * 100 : 0;
            const color = percent < 80 ? "red" : percent < 100 ? "orange" : "green";

            // Custom icon based on percentage
            const customIcon = L.divIcon({
              className: "custom-icon",
              html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            });

            return (
              <Marker
                key={idx}
                position={[first.lat, first.lng]}
                icon={customIcon}
                eventHandlers={{
                  click: () => setSelectedUser(item),
                }}
              >
                <Popup>
                  <b>{item.username}</b> <br />
                  District: {item.district} <br />
                  Block: {item.block_name} <br />
                  Visited: {item.count} / {item.total_target} ({percent.toFixed(2)}%) <br />
                  DBCs: {item.num_dbcs} <br />
                  Verified: {item.verified}
                </Popup>
              </Marker>
            );
          })}

        {selectedUser && selectedUser.locations.length > 0 && (
          <>
            <div
              style={{
                position: "absolute",
                top: 15,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(255,255,255,0.95)",
                padding: "10px 20px",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: "15px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                zIndex: 1000,
                fontWeight: "bold",
              }}
            >
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  background: "#e53935",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                ← Back
              </button>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: "#1a73e8" }}>
                  👤 {selectedUser.username} – 📏 {calculateDistance(selectedUser.locations)} km
                </span>
                <span style={{ fontSize: "0.9rem", color: "#444" }}>
                  🏢 District: {selectedUser.district} | Block: {selectedUser.block_name}
                </span>
                <span style={{ fontSize: "0.9rem", color: "#444" }}>
                  Visited: {selectedUser.count} / {selectedUser.total_target} ({((selectedUser.count / selectedUser.total_target) * 100).toFixed(2)}%)
                </span>
              </div>
            </div>

            <FitBounds locations={selectedUser.locations} />

            {/* Render markers for all locations */}
            {selectedUser.locations.map((loc, i) => (
              <Marker key={i} position={[loc.lat, loc.lng]}>
                <Popup>
                  {i === 0 ? "Start: " : i === selectedUser.locations.length - 1 ? "End: " : "Point: "}
                  {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                  {i === selectedUser.locations.length - 1 && selectedUser.locations.length > 1 && (
                    <> <br /> Distance: {calculateDistance(selectedUser.locations)} km</>
                  )}
                </Popup>
              </Marker>
            ))}

            {/* Polyline only if more than 1 location */}
            {selectedUser.locations.length > 1 && (
              <Polyline
                positions={selectedUser.locations.map((loc) => [loc.lat, loc.lng])}
                color="blue"
                weight={3}
                opacity={0.7}
              />
            )}
          </>
        )}
      </MapContainer>
    </Box>
  );
};

export default DistHiSupervisionMap;