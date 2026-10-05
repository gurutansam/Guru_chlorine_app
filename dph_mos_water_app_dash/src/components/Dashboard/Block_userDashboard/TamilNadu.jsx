import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Marker icon fix
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom marker
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
    <div style={{ position: "absolute", top: 10, left: 10, zIndex: 1000, display: "flex", flexDirection: "column", gap: "5px" }}>
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
  const [blockUsers, setBlockUsers] = useState([]);
  const [pins, setPins] = useState([]);
  const [loggedInUser, setLoggedInUser] = useState(null);

  // Load Tamil Nadu GeoJSON
  useEffect(() => {
    fetch("/maps/tamil-nadu.geojson")
      .then((res) => res.json())
      .then((data) => setGeoData(data))
      .catch((err) => console.error("Failed to load GeoJSON:", err));
  }, []);

  // Fetch block users & determine logged-in user
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/mosquito-block-users");
        const data = await res.json();
        setBlockUsers(data);

        const loggedInUsername = localStorage.getItem("loggedInUsername");
        if (loggedInUsername) {
          const matchedUser = data.find((u) => u.username === loggedInUsername);
          if (matchedUser) setLoggedInUser(matchedUser);
        }
      } catch (err) {
        console.error("Error fetching block users:", err);
      }
    };
    fetchUsers();
  }, []);

  // Fetch dashboard data and map to pins
  useEffect(() => {
    if (!loggedInUser) return;

    const fetchPins = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/datacollection");
        const data = await res.json();

        // Only include pins for logged-in user's block
        const filteredPins = data
          .filter((d) => {
            const user = blockUsers.find((u) => u.user_id === d.user_id);
            return user?.block_id === loggedInUser.block_id;
          })
          .map((d, i) => {
            const user = blockUsers.find((u) => u.user_id === d.user_id);
            const blockName = user?.block_name || "Unknown";
            const lat = d.geolocation?.latitude || 0;
            const lng = d.geolocation?.longitude || 0;

            return {
              id: i + 1,
              username: d.username,
              block: blockName,
              date: d.date,
              time: d.time,
              lat,
              lng,
            };
          });

        setPins(filteredPins);
      } catch (err) {
        console.error("Error fetching pins:", err);
      }
    };

    fetchPins();
  }, [loggedInUser, blockUsers]);

  return (
    <div style={{ height: "500px", position: "relative" }}>
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

        {geoData && <GeoJSON data={geoData} style={{ fillColor: "#E0BC00", color: "grey", weight: 1, fillOpacity: 0.5 }} />}

        {pins.map((pin) => (
          <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={customIcon}>
            <Popup>
              <div>
                <strong>Block:</strong> {pin.block}<br />
                <strong>Username:</strong> {pin.username}<br />
                <strong>Date:</strong> {pin.date}<br />
                <strong>Time:</strong> {pin.time}<br />
                <strong>Location:</strong> {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default TamilNaduMap;
