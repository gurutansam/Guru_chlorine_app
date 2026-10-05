import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Paper,
} from "@mui/material";

// 🟢 Auto-zoom to marker data
const FitToData = ({ rows }) => {
  const map = useMap();

  useEffect(() => {
    if (!rows || rows.length === 0) return;

    const bounds = L.latLngBounds(
      rows.map((r) => [Number(r.latitude), Number(r.longitude)])
    );
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [rows, map]);

  return null;
};

// 🟢 Custom zoom control buttons
const ZoomControls = () => {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  const zoomIn = () => {
    const z = Math.min(zoom + 1, map.getMaxZoom());
    map.setZoom(z);
    setZoom(z);
  };
  const zoomOut = () => {
    const z = Math.max(zoom - 1, map.getMinZoom());
    map.setZoom(z);
    setZoom(z);
  };

  return (
    <Box
      sx={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 1000,
        display: "flex",
        gap: "5px",
      }}
    >
      <button style={buttonStyle} onClick={zoomIn}>
        +
      </button>
      <button style={buttonStyle} onClick={zoomOut}>
        −
      </button>
    </Box>
  );
};

const buttonStyle = {
  background: "#fff",
  border: "1px solid #ccc",
  width: 30,
  height: 30,
  borderRadius: 4,
  cursor: "pointer",
  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
};

const TamilNaduMap = () => {
  const [geoData, setGeoData] = useState(null);
  const [chlData, setChlData] = useState([]);
  const [blockList, setBlockList] = useState([]);
  const [loggedInHudId, setLoggedInHudId] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState("");

  const mapRef = useRef();

  // 🟢 Load logged-in HUD ID from localStorage
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (user?.hud_id) setLoggedInHudId(user.hud_id);
    else console.error("No HUD ID found in logged-in user");
  }, []);

  // 🟢 Fetch HUD blocks + chlorine data for logged-in HUD
  useEffect(() => {
    if (!loggedInHudId) return;

    const fetchData = async () => {
      try {
        const [chlRes, blockRes] = await Promise.all([
          fetch("http://localhost:3000/dashboard/chl_hud_datacollection"),
          fetch("http://localhost:3000/dashboard/hud-blocks"),
        ]);

        const chlJson = await chlRes.json();
        const blockJson = await blockRes.json();

        if (Array.isArray(blockJson)) {
          const allowedBlocks = blockJson.filter(
            (b) => b.hud_id === loggedInHudId
          );
          setBlockList(allowedBlocks);

          if (Array.isArray(chlJson)) {
            const filteredChl = chlJson.filter((row) =>
              allowedBlocks.some((b) => b.block_id === row.block_id)
            );
            setChlData(filteredChl);
          }
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }
    };

    fetchData();
  }, [loggedInHudId]);

  // 🟢 Fetch Tamil Nadu GeoJSON
  useEffect(() => {
    fetch("/maps/tamil-nadu.geojson")
      .then((res) => res.json())
      .then(setGeoData)
      .catch((err) => console.error("GeoJSON fetch error:", err));
  }, []);

  // 🟢 Filter chlData based on selected block
  const displayedChlData = selectedBlock
    ? chlData.filter((row) => row.block_id === selectedBlock)
    : chlData;

  const styleDistrict = () => ({
    fillColor: "#A0C4FF",
    weight: 1,
    color: "#666",
    fillOpacity: 0.4,
  });

  return (
    <div style={{ height: 550, position: "relative" }}>
      {/* 🟢 Floating Filter Box */}
      <Paper
        elevation={3}
        sx={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 1000,
          padding: "10px 15px",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          gap: 2,
          minWidth: 280,
        }}
      >
        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel>Filter by Block</InputLabel>
          <Select
            value={selectedBlock}
            onChange={(e) => setSelectedBlock(e.target.value)}
            label="Filter by Block"
          >
            <MenuItem value="">All Blocks</MenuItem>
            {blockList.map((block) => (
              <MenuItem key={block.block_id} value={block.block_id}>
                {block.block_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography
          variant="body2"
          sx={{ fontWeight: "bold", whiteSpace: "nowrap" }}
        >
          Pins: {displayedChlData.length}
        </Typography>
      </Paper>

      <MapContainer
        center={[11, 78]}
        zoom={7}
        style={{ height: "100%" }}
        zoomControl={false}
        whenCreated={(mapInstance) => {
          mapRef.current = mapInstance;
        }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitToData rows={displayedChlData} />
        <ZoomControls />
        {geoData && <GeoJSON data={geoData} style={styleDistrict} />}

        {/* 🟢 Chlorination markers with round-off + samplingPoint logic */}
        {displayedChlData.map((entry, i) => {
          const lat = Number(entry.latitude);
          const lng = Number(entry.longitude);

          if (isNaN(lat) || isNaN(lng)) return null;

          // ✅ Round-off + logic
          const raw = parseFloat(entry.ppm);
          const ppm = raw > 0 && raw < 0.1 ? 0 : Math.round(raw * 10) / 10;
          const s = (entry.samplingPoint || "").toUpperCase();

          let status = "Nil";
          if ((s === "TAIL" || s === "MID") && ppm >= 0.2) status = "Adequate";
          else if ((s === "OHT" || s === "GLR" || s === "SUMP") && ppm >= 1)
            status = "Adequate";
          else if ((s === "TAIL" || s === "MID") && ppm > 0 && ppm < 0.2)
            status = "Inadequate";
          else if ((s === "OHT" || s === "GLR" || s === "SUMP") && ppm > 0 && ppm < 1)
            status = "Inadequate";
          else if (ppm === 0) status = "Nil";

          const color =
            status === "Adequate" ? "green" :
              status === "Inadequate" ? "orange" :
                "red";

          const customPin = L.divIcon({
            className: "custom-pin",
            html: `<div style="
              width: 18px; height: 18px;
              background-color: ${color};
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 0 4px rgba(0,0,0,0.5);
            "></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            popupAnchor: [0, -9],
          });

          const timestamp = new Date(entry.timestamp);

          // Manual formatting to DD-MM-YYYY hh:mm:ss AM/PM
          const day = String(timestamp.getDate()).padStart(2, "0");
          const month = String(timestamp.getMonth() + 1).padStart(2, "0"); // Months are 0-based
          const year = timestamp.getFullYear();

          let hours = timestamp.getHours();
          const minutes = String(timestamp.getMinutes()).padStart(2, "0");
          const seconds = String(timestamp.getSeconds()).padStart(2, "0");
          const ampm = hours >= 12 ? "PM" : "AM";
          hours = hours % 12 || 12; // convert 0 to 12
          const formattedDateTime = `${day}-${month}-${year} ${hours}:${minutes}:${seconds} ${ampm}`;

          return (
            <Marker key={`chl-${i}`} position={[lat, lng]} icon={customPin}>
              <Popup maxWidth={250}>
                <Box sx={{ fontFamily: "Nunito, sans-serif" }}>
                  <div><strong>Collected by:</strong> {entry.username}</div>
                  <div><strong>Block Name:</strong> {entry.block_name}</div>
                  <div>
                    <strong>PPM:</strong>{" "}
                    <span style={{ color, fontWeight: "bold" }}>{ppm}</span>{" "}
                    ({status})
                  </div>
                  <div><strong>Date & Time:</strong> {formattedDateTime}</div>
                  <div><strong>Lat:</strong> {lat}</div>
                  <div><strong>Lng:</strong> {lng}</div>
                  {entry.image_url && (
                    <Box mt={1}>
                      <img
                        src={entry.image_url}
                        alt="Chlorination"
                        style={{ width: "100%", borderRadius: "6px" }}
                      />
                    </Box>
                  )}
                </Box>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* 🟢 Legend */}
      <Paper
        elevation={3}
        sx={{
          position: "absolute",
          bottom: 150,
          right: 10,
          zIndex: 1000,
          padding: "10px 12px",
          borderRadius: "8px",
          fontSize: "13px",
          fontFamily: "Nunito, sans-serif",
          width: "220px",
        }}
      >
        <Typography sx={{ fontWeight: "bold", mb: 1 }}>PPM Status</Typography>
        <Box display="flex" flexDirection="column" gap={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 12, height: 12, bgcolor: "red", borderRadius: "50%" }} />
            <Typography variant="body2" sx={{ color: "text.primary" }}>Nil</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 12, height: 12, bgcolor: "green", borderRadius: "50%" }} />
            <Typography variant="body2" sx={{ color: "text.primary" }}>Adequate</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 12, height: 12, bgcolor: "orange", borderRadius: "50%" }} />
            <Typography variant="body2" sx={{ color: "text.primary" }}>Inadequate</Typography>
          </Box>
        </Box>
      </Paper>
    </div>
  );
};

export default TamilNaduMap;
