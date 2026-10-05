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

const BlockHiSupervisionMap = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  // Filters (only username, dates)
  const [usernameFilter, setUsernameFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const fetchLoggedInUserAndData = async () => {
      try {
        // Step 1: Get logged-in user
        const userRes = await fetch("http://localhost:3000/dashboard/mosquito-block-users");
        const users = await userRes.json();
        const loggedInUsername = localStorage.getItem("loggedInUsername");
        const matchedUser = users.find((u) => u.username === loggedInUsername);
        if (matchedUser) setUser(matchedUser);

        // Step 2: Fetch HI monitoring data
        const res = await fetch("http://localhost:3000/dashboard/hi-monitoring");
        const json = await res.json();

        // Step 3: Filter by logged-in user's block
        const mapped = json
          .filter((item) => {
            if (!matchedUser) return false;
            return (
              item.block_name?.toLowerCase().trim() ===
              matchedUser.block_name?.toLowerCase().trim()
            );
          })
          .map((item) => {
            const locations = [];
            for (let i = 0; i < 10; i++) {
              const lat = item[`photo${i}_lat`];
              const long = item[`photo${i}_long`];
              if (lat && long) {
                locations.push({ lat: parseFloat(lat), lng: parseFloat(long) });
              }
            }

            return {
              id: item.id,
              username: item.hi_name || "N/A",
              district: item.district_name || "N/A",
              block_name: item.block_name || "N/A",
              count: item.total_visited || 0,
              total_target: item.total_target || 0,
              timestamp: item.timestamp,
              locations,
            };
          })
          .reverse();

        setData(mapped);
        setFilteredData(mapped);
      } catch (err) {
        console.error("Error fetching HI monitoring data", err);
      }
    };

    fetchLoggedInUserAndData();
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

  // Filtering (only username + dates)
  useEffect(() => {
    let filtered = [...data];
    if (usernameFilter) filtered = filtered.filter((d) => d.username === usernameFilter);
    if (fromDate)
      filtered = filtered.filter(
        (d) => new Date(d.timestamp).toISOString().split("T")[0] >= fromDate
      );
    if (toDate)
      filtered = filtered.filter(
        (d) => new Date(d.timestamp).toISOString().split("T")[0] <= toDate
      );
    setFilteredData(filtered);
    setSelectedUser(null);
  }, [usernameFilter, fromDate, toDate, data]);

  if (!data.length && user)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  const usernameOptions = [...new Set(data.map((d) => d.username))].sort();

  return (
    <Box sx={{ p: 3, pl: 10, pt: 10 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
        HI Supervision Map — {user?.block_name || "Your Block"}
      </Typography>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
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
      </Box>

      {/* Map */}
      <MapContainer
        center={[12.9716, 77.5946]} // fallback
        zoom={8}
        style={{ height: "60vh", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Auto zoom to block data */}
        {!selectedUser && filteredData.length > 0 && (
          <FitBounds locations={filteredData.flatMap((item) => item.locations)} />
        )}

        {/* Markers for each user (first point only) */}
        {!selectedUser &&
          filteredData.map((item, idx) => {
            if (!item.locations.length) return null;
            const first = item.locations[0];
            return (
              <Marker
                key={item.id || idx}
                position={[first.lat, first.lng]}
                eventHandlers={{
                  click: () => setSelectedUser(item),
                }}
              >
                <Popup>
                  <b>{item.username}</b> <br />
                  {item.district}, {item.block_name}
                </Popup>
              </Marker>
            );
          })}

        {/* Selected User Path */}
        {selectedUser && selectedUser.locations.length > 1 && (() => {
          const positions = selectedUser.locations.map((loc) => [loc.lat, loc.lng]);
          const first = positions[0];
          const last = positions[positions.length - 1];
          const distance = calculateDistance(selectedUser.locations);

          return (
            <>
              {/* Top Control Panel */}
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
                  Back
                </button>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ color: "#1a73e8" }}>
                    User: {selectedUser.username} – Distance: {distance} km
                  </span>
                  <span style={{ fontSize: "0.9rem", color: "#444" }}>
                    District: {selectedUser.district}
                  </span>
                </div>
              </div>

              {/* Auto zoom to user path */}
              <FitBounds locations={selectedUser.locations} />

              {/* Start & End markers */}
              <Marker position={first}>
                <Popup>
                  Start: {first[0].toFixed(6)}, {first[1].toFixed(6)}
                </Popup>
              </Marker>
              <Marker position={last}>
                <Popup>
                  End: {last[0].toFixed(6)}, {last[1].toFixed(6)} <br />
                  Distance: {distance} km
                </Popup>
              </Marker>

              {/* Path */}
              <Polyline positions={positions} color="blue" weight={3} opacity={0.7} />
            </>
          );
        })()}
      </MapContainer>
    </Box>
  );
};

export default BlockHiSupervisionMap;