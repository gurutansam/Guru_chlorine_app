import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  useMap,
  Circle,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BOUNDS = [
  [8, 75],
  [15, 82],
];

const pinLocations = [
  { lat: 13.0827, lng: 80.2707, label: "Chennai", code: "hud001" },
  { lat: 11.0168, lng: 76.9558, label: "Coimbatore", code: "hud002" },
  { lat: 10.7905, lng: 78.7047, label: "Tiruchirapalli", code: "hud003" },
  { lat: 8.7378, lng: 77.7081, label: "Tirunelveli", code: "hud004" },
];

const customIcon = (color = "#007BFF") =>
  new L.DivIcon({
    className: "custom-pin",
    html: `<div style="
      width: 18px;
      height: 18px;
      background-color: ${color};
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 4px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9],
  });

const FitToTN = () => {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(BOUNDS);
    map.setMaxBounds(BOUNDS);
  }, [map]);
  return null;
};

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
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 1000,
        display: "flex",
        gap: "5px",
      }}
    >
      <button onClick={zoomIn} style={buttonStyle}>+</button>
      <button onClick={zoomOut} style={buttonStyle}>−</button>
    </div>
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
  const [userBlockId, setUserBlockId] = useState(null);
  const [userHud, setUserHud] = useState("");
  const mapRef = useRef();

  // Load Tamil Nadu GeoJSON
  useEffect(() => {
    fetch("/maps/tamil-nadu.geojson")
      .then(res => res.json())
      .then(setGeoData)
      .catch(err => console.error("GeoJSON fetch error:", err));
  }, []);

  // Get logged-in user info
  useEffect(() => {
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) {
      try {
        const userObj = JSON.parse(storedUser);
        if (userObj?.block_id) setUserBlockId(userObj.block_id);
        if (userObj?.hud_name) setUserHud(userObj.hud_name);
      } catch (err) {
        console.error("Error parsing loggedInUser:", err);
      }
    }
  }, []);

  // Fetch chlorination data for user's block
  useEffect(() => {
    if (!userBlockId) return;

    fetch("http://localhost:3000/dashboard/chl_hud_datacollection")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setChlData(data.filter(item => item.block_id === userBlockId));
        } else if (Array.isArray(data.data)) {
          setChlData(data.data.filter(item => item.block_id === userBlockId));
        } else {
          setChlData([]);
        }
      })
      .catch(err => console.error("Failed to fetch chlorine data:", err));
  }, [userBlockId]);

  // Auto zoom to user's block
  useEffect(() => {
    if (!userBlockId || !chlData.length || !mapRef.current) return;
    const blockMarker = chlData[0];
    const lat = Number(blockMarker.latitude);
    const lng = Number(blockMarker.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      setTimeout(() => {
        mapRef.current.flyTo([lat, lng], 13, { duration: 2 });
      }, 100);
    }
  }, [chlData, userBlockId]);

  const styleDistrict = (feature) => ({
    fillColor: "#A0C4FF",
    weight: 1,
    color: "#666",
    fillOpacity: 0.4,
  });

  return (
    <div style={{ height: 500, position: "relative", paddingLeft: 28 }}>
      <MapContainer
        center={[11, 78]}
        zoom={7}
        style={{ height: "100%" }}
        zoomControl={false}
        whenCreated={map => (mapRef.current = map)}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitToTN />
        <ZoomControls />

        {geoData && <GeoJSON data={geoData} style={styleDistrict} />}

        {/* Hub markers */}
        {pinLocations.map((loc, i) => (
          <Marker key={i} position={[loc.lat, loc.lng]} icon={customIcon()}>
            <Popup>
              <div style={{ fontFamily: "Nunito, sans-serif" }}>
                <div style={{ fontWeight: "bold" }}>{loc.label} HUD</div>
                <div>Lat: {loc.lat.toFixed(4)}<br />Lng: {loc.lng.toFixed(4)}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Chlorination markers for user's block */}
        {chlData.map((entry, i) => {
          const lat = Number(entry.latitude);
          const lng = Number(entry.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;

          // ✅ Round-off + PPM logic
          const raw = parseFloat(entry.ppm);
          const ppm = raw > 0 && raw < 0.1 ? 0 : Math.round(raw * 10) / 10;
          const s = (entry.samplingPoint || "").toUpperCase();

          let status = "Nil";
          if ((s === "TAIL" || s === "MID") && ppm >= 0.2) status = "Adequate";
          else if ((s === "OHT" || s === "GLR" || s === "SUMP") && ppm >= 1) status = "Adequate";
          else if ((s === "TAIL" || s === "MID") && ppm > 0 && ppm < 0.2) status = "Inadequate";
          else if ((s === "OHT" || s === "GLR" || s === "SUMP") && ppm > 0 && ppm < 1) status = "Inadequate";
          else if (ppm === 0) status = "Nil";

          const color = status === "Adequate" ? "green" : status === "Inadequate" ? "orange" : "red";

          // ✅ Format date as DD-MM-YYYY hh:mm:ss AM/PM
          const timestamp = new Date(entry.timestamp);
          let formattedDateTime = "Invalid Date";
          if (!isNaN(timestamp.getTime())) {
            const day = String(timestamp.getDate()).padStart(2, "0");
            const month = String(timestamp.getMonth() + 1).padStart(2, "0");
            const year = timestamp.getFullYear();

            let hours = timestamp.getHours();
            const minutes = String(timestamp.getMinutes()).padStart(2, "0");
            const seconds = String(timestamp.getSeconds()).padStart(2, "0");
            const ampm = hours >= 12 ? "PM" : "AM";
            hours = hours % 12 || 12;

            formattedDateTime = `${day}-${month}-${year} ${hours}:${minutes}:${seconds} ${ampm}`;
          }

          return (
            <Marker key={`chl-${i}`} position={[lat, lng]} icon={customIcon(color)}>
              <Popup maxWidth={300}>
                <div style={{ fontFamily: "Nunito, sans-serif" }}>
                  <div><strong>Block:</strong> {entry.block_name}</div>
                  <div><strong>Collected by:</strong> {entry.username}</div>
                  <div>
                    <strong>PPM:</strong>{" "}
                    <span style={{ color, fontWeight: "bold" }}>{ppm}</span> ({status})
                  </div>
                  <div><strong>Date & Time:</strong> {formattedDateTime}</div>
                  <div><strong>Lat:</strong> {lat}</div>
                  <div><strong>Lng:</strong> {lng}</div>
                  {entry.image_url && (
                    <div style={{ marginTop: "8px" }}>
                      <img src={entry.image_url} alt="Chlorination" style={{ width: "100%", borderRadius: "6px" }} />
                    </div>
                  )}
                </div>
              </Popup>
              <Circle center={[lat, lng]} radius={500} pathOptions={{ color: "#007BFF", fillOpacity: 0.2 }} />
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default TamilNaduMap;
