import React, { useEffect, useState } from "react";
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
import { Typography } from "@mui/material";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import DashboardLayout from "./DashboardLayout";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom Icon (optional)
const customIcon = new L.Icon({
  iconUrl: "/keepPing.svg",
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

// Tamil Nadu bounds
const BOUNDS = [
  [8, 75],
  [15, 82],
];

function FitToTN() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(BOUNDS);
    map.setMaxBounds(BOUNDS);
    map.scrollWheelZoom.enable();
    map.dragging.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
  }, [map]);
  return null;
}

function ZoomControls() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  const zoomIn = () => {
    const newZoom = Math.min(zoom + 1, map.getMaxZoom());
    map.setZoom(newZoom);
    setZoom(newZoom);
  };

  const zoomOut = () => {
    const newZoom = Math.max(zoom - 1, map.getMinZoom());
    map.setZoom(newZoom);
    setZoom(newZoom);
  };

  return (

    <div style={{
      position: "absolute",
      top: 10,
      left: 10,
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      gap: "5px",

    }}>
      <button onClick={zoomIn} style={zoomButtonStyle}>+</button>
      <button onClick={zoomOut} style={zoomButtonStyle}>−</button>
    </div>
  );
}

const zoomButtonStyle = {
  backgroundColor: "#fff",
  border: "1px solid #ccc",
  borderRadius: "4px",
  width: "30px",
  height: "30px",
  fontSize: "20px",
  cursor: "pointer",
  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
};

const TamilNaduMap = () => {
  const [geoData, setGeoData] = useState(null);
  const [pinData, setPinData] = useState([]);
  const [districtFilter, setDistrictFilter] = useState("");
  const [districtsFromAPI, setDistrictsFromAPI] = useState([]);

  useEffect(() => {
    fetch("/maps/tamil-nadu.geojson")
      .then((res) => res.json())
      .then((data) => setGeoData(data))
      .catch((err) => console.error("Failed to load GeoJSON:", err));

    fetch("http://localhost:3000/dashboard/mos-district")
      .then((res) => res.json())
      .then((data) => setDistrictsFromAPI(data))
      .catch((err) => console.error("Failed to load district master:", err));
  }, []);

  useEffect(() => {
    const fetchMapPins = async () => {
      const username = "mosadmin@example.com";
      try {
        const [districtResp, dashboardResp] = await Promise.all([
          fetch("http://localhost:3000/dashboard/mos-district"),
          fetch("http://localhost:3000/dashboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username }),
          }),
        ]);

        const districtsData = await districtResp.json();
        setDistrictsFromAPI(districtsData);

        if (!dashboardResp.ok) {
          console.error("Dashboard fetch error:", await dashboardResp.json());
          return;
        }

        const dashboardData = await dashboardResp.json();

        const pins = dashboardData.map((d, i) => {
          let lat = null, lng = null;
          try {
            const geoObj = typeof d.geolocation === "string"
              ? JSON.parse(d.geolocation)
              : d.geolocation;
            lat = parseFloat(geoObj?.latitude);
            lng = parseFloat(geoObj?.longitude);
          } catch (err) {
            console.warn(`Row ${i}: Invalid geolocation`, d.geolocation, err);
          }

          if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
            return null;
          }

          // Extract district_code from user_id
          const userId = d.user_id || "";
          const codePrefix = userId.substring(0, 7).toUpperCase();

          const matchedDistrict = districtsData.find((dm) =>
            dm.district_code?.toUpperCase().startsWith(codePrefix)
          );

          return {
            lat,
            lng,
            district: matchedDistrict?.district_name || "Unknown",
            username: d.username || "Unknown",
            date: d.date || "",
            time: d.time || "",
          };
        }).filter(Boolean);

        console.log("✅ Pins parsed:", pins.length, pins.slice(0, 2));
        setPinData(pins);
      } catch (err) {
        console.error("Error loading map pins:", err);
      }
    };

    fetchMapPins();
  }, []);


  const districts = [...new Set(pinData.map((d) => d.district))];
  const allDistricts = Array.from(new Set([...districts, ...districtsFromAPI.map((d) => d.district_name)]));

  const filteredPins = districtFilter
    ? pinData.filter((d) => d.district === districtFilter)
    : pinData;

  return (
    <DashboardLayout>
      <div style={{ height: "500px", position: "relative" }}>

        <Typography variant="h5" sx={{ textAlign: "left", fontWeight: "bold", pl: 8, pb: 1, pt: 15 }}>
          DBC Monitoring Data Map
        </Typography>
        <div style={{ position: "absolute", top: 35, right: 10, zIndex: 1000 }}>
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "14px",
            }}
          >
            <option value="">All Districts</option>
            {allDistricts.map((dist, i) => (
              <option key={i} value={dist}>{dist}</option>
            ))}
          </select>
        </div>

        <MapContainer
          center={[11, 78]}
          zoom={7}
          style={{ height: "100%", width: "100%", borderRadius: "0.25rem" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitToTN />
          <ZoomControls />
          {geoData && (
            <GeoJSON
              data={geoData}
              style={{
                fillColor: "#E0BC00", // light yellow fill
                color: "grey",     // yellow border
                weight: 1,
                fillOpacity: 0.5,
              }}
            />
          )}


          {filteredPins.map((pin, i) => (
            <Marker key={i} position={[pin.lat, pin.lng]} icon={customIcon}>
              <Popup>
                <div>
                  <strong>{pin.district}</strong><br />
                  Username: {pin.username}<br />
                  Date: {pin.date}  ,Time: {pin.time}<br />
                  GeoLocation: {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

      </div>
    </DashboardLayout>

  );
};

export default TamilNaduMap;
