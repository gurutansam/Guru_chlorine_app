import React, { useEffect, useState } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  TextField,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Chip,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import DashboardLayout from "./DashboardLayout";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const LarvaEntry = () => {
  // ------------------------------------------
  // ✅ MAIN DATA
  // ------------------------------------------
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);

  // ------------------------------------------
  // ✅ MASTER FILTERS
  // ------------------------------------------
  const [hudMaster, setHudMaster] = useState([]);
  const [phcMaster, setPhcMaster] = useState([]);

  const [hud, setHud] = useState("");
  const [block, setBlock] = useState("");
  const [phc, setPhc] = useState("");
  const [village, setVillage] = useState("");

  // ------------------------------------------
  // ✅ OTHER FILTERS
  // ------------------------------------------
  const [user, setUser] = useState("");
  const [workType, setWorkType] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // ✅ NEW: Action Taken Filter (multi select)
  const [actionTaken, setActionTaken] = useState([]);

  // Photo modal
  const [openPhoto, setOpenPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");

  // Map modal
  const [mapModal, setMapModal] = useState({ open: false, locations: [] });

  // Action map modal
  const [actionMapModal, setActionMapModal] = useState({
    open: false,
    locations: [],
  });

  const calculateRawDistance = (lat1, lon1, lat2, lon2) => {
    // Convert to numbers (IMPORTANT)
    lat1 = parseFloat(lat1);
    lon1 = parseFloat(lon1);
    lat2 = parseFloat(lat2);
    lon2 = parseFloat(lon2);

    // Validate
    if (
      isNaN(lat1) || isNaN(lon1) ||
      isNaN(lat2) || isNaN(lon2)
    ) return null;

    const R = 6371e3; // meters
    const toRad = (v) => (v * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };



  // ------------------------------------------
  // ✅ FETCH MASTER DATA
  // ------------------------------------------
  useEffect(() => {
    const loadMaster = async () => {
      const v = await fetch("http://localhost:3000/dashboard/village").then((r) =>
        r.json()
      );
      const p = await fetch("http://localhost:3000/dashboard/phc").then((r) =>
        r.json()
      );

      setHudMaster(v);
      setPhcMaster(p);
    };
    loadMaster();
  }, []);

  // ------------------------------------------
  // ✅ FETCH LARVA ENTRIES
  // ------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(
        "http://localhost:3000/dashboard/get-larva-entries"
      );
      const json = await res.json();

      const list = json.map((row) => ({
        id: row.id,
        hi_name: row.hi_name,
        district_name: row.district_name,
        block_name: row.block_name,
        phc_name: row.phc_name,
        village_name: row.village_name,
        hud_name: row.hud_name,
        work_type: row.work_type,
        total_larvae: row.active_larval_source_count,
        submitted_at: row.submitted_at,

        latitude: Number(row.latitude),
        longitude: Number(row.longitude),

        sources:
          typeof row.sources === "string" ? JSON.parse(row.sources) : row.sources,

        image_url: row.image_path
          ? `http://localhost:3000${row.image_path}`
          : null,

        action_taken:
          typeof row.action_taken === "string"
            ? JSON.parse(row.action_taken)
            : row.action_taken,

        action_image_url: row.action_image_path
          ? `http://localhost:3000${row.action_image_path}`
          : null,

        action_date: row.action_date,

        action_location:
          typeof row.action_location === "string"
            ? JSON.parse(row.action_location)
            : row.action_location,
      }));

      setData(list);
      setFiltered(list);
    };

    fetchData();
  }, []);

  // ------------------------------------------
  // ✅ DEPENDENT DROPDOWNS
  // ------------------------------------------
  const hudOptions = [...new Set(hudMaster.map(d => d.hud_name))];

  const blockOptions = [
    ...new Set(
      hudMaster
        .filter(d => (hud ? d.hud_name === hud : true))
        .map(d => d.block_name)
    )
  ];


  const villageOptions = [
    ...new Set(
      hudMaster
        .filter(d => (block ? d.block_name === block : true))
        .map(d => d.village_name)
    )
  ];


  const phcOptions = [
    ...new Set(
      phcMaster
        .filter(p => (block ? p.block_name === block : true))
        .map(p => p.phc_name)
    )
  ];

  // ✅ NEW: action taken options
  const actionTakenOptions = [
    "Anti Larval Work",
    "Fogging",
    "Source Reduction",
  ];


  // ------------------------------------------
  // ✅ FILTERING
  // ------------------------------------------
  useEffect(() => {
    let f = [...data];

    // ✅ HUD Filter (maps hud_name → district_name)
    if (hud) {
      f = f.filter(d => d.district_name === hud);
    }

    // Block Filter
    if (block) {
      f = f.filter(d => d.block_name === block);
    }

    // Village Filter
    if (village) {
      f = f.filter(d => d.village_name === village);
    }

    // PHC Filter
    if (phc) {
      f = f.filter(d => d.phc_name === phc);
    }

    // User Filter
    if (user) f = f.filter(d => d.hi_name === user);

    // Work Type
    if (workType) f = f.filter(d => d.work_type === workType);

    // Source Name
    if (sourceName) {
      f = f.filter(d =>
        d.sources?.some(s =>
          s.sourceName.toLowerCase().includes(sourceName.toLowerCase())
        )
      );
    }

    // Action Taken (multi select)
    if (actionTaken.length > 0) {
      f = f.filter((d) => {
        if (!d.action_taken) return false;

        let parsed = d.action_taken;

        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            return false;
          }
        }

        const selected = parsed.selectedActions || [];

        return actionTaken.some((a) => selected.includes(a));
      });
    }

    // Dates
    if (fromDate) f = f.filter(d => d.submitted_at.split("T")[0] >= fromDate);
    if (toDate) f = f.filter(d => d.submitted_at.split("T")[0] <= toDate);

    setFiltered(f);
  }, [
    hud,
    block,
    phc,
    village,
    user,
    workType,
    sourceName,
    actionTaken,
    fromDate,
    toDate,
    data,
  ]);


  // ------------------------------------------
  // ✅ EXPORT EXCEL
  // ------------------------------------------
  const exportExcel = () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    const exportRows = filtered.map((r) => {
      // -----------------------
      // Parse action_taken safely
      // -----------------------
      let selectedActions = [];
      let sourceActionsText = "";

      if (r.action_taken) {
        let parsed = r.action_taken;

        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            parsed = {};
          }
        }

        selectedActions = parsed.selectedActions || [];

        if (selectedActions.includes("Source Reduction")) {
          const src = parsed.sourceActions || [];
          sourceActionsText = src
            .map((s) => `${s.sourceName} (${s.count}) - ${s.action}`)
            .join(", ");
        }
      }

      return {
        "HI Name": r.hi_name || "N/A",
        District: r.district_name || r.hud_name || "N/A", // ✅ fallback to HUD if district empty
        Block: r.block_name || "N/A",
        PHC: r.phc_name || "N/A",
        Village: r.village_name || "N/A",
        "Work Type": r.work_type || "N/A",
        Sources: r.sources
          ?.map((s) => `${s.sourceName} (${s.count})`)
          .join(", ") || "N/A",
        "Total Sources Count": r.total_larvae ?? "N/A",
        "Entry Date": r.submitted_at?.split("T")[0] || "N/A",
        "Action Taken": selectedActions.join(", ") || "N/A",
        "Source Actions": sourceActionsText || "N/A",
        "Action Date": r.action_date?.split("T")[0] || "N/A",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Larva");

    const fileName = `Larva_${fromDate || "all"}_${toDate || "all"}.xlsx`;

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/octet-stream" });

    saveAs(blob, fileName);
  };

  return (
    <DashboardLayout>
      <Box sx={{ marginLeft: 9, pt: 15, pb: 4 }}>

        <Typography variant="h5" fontWeight={700} mb={2}>
          LARVAL SURVEY REPORT
        </Typography>

        <Button
          variant="contained"
          color="success"
          sx={{ mb: 2 }}
          onClick={exportExcel}
        >
          Download Excel
        </Button>

        {/* ✅ FILTERS */}
        {/* ✅ FILTERS */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>

          {/* HUD */}
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>HUD</InputLabel>
            <Select
              value={hud}
              onChange={(e) => {
                setHud(e.target.value);
                setBlock("");
                setPhc("");
                setVillage("");
              }}
            >
              <MenuItem value="">All</MenuItem>
              {hudOptions.map((h) => (
                <MenuItem key={h} value={h}>{h}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* BLOCK */}
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>Block</InputLabel>
            <Select
              value={block}
              onChange={(e) => {
                setBlock(e.target.value);
                setPhc("");
                setVillage("");
              }}
            >
              <MenuItem value="">All</MenuItem>
              {blockOptions.map((b) => (
                <MenuItem key={b} value={b}>{b}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* PHC */}
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>PHC</InputLabel>
            <Select value={phc} onChange={(e) => setPhc(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {phcOptions.map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* VILLAGE */}
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>Village</InputLabel>
            <Select value={village} onChange={(e) => setVillage(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {villageOptions.map((v) => (
                <MenuItem key={v} value={v}>{v}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* USER */}
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>User</InputLabel>
            <Select value={user} onChange={(e) => setUser(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {[...new Set(data.map(d => d.hi_name))].map((u) => (
                <MenuItem key={u} value={u}>{u}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* WORK TYPE */}
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Work Type</InputLabel>
            <Select value={workType} onChange={(e) => setWorkType(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {[...new Set(data.map(d => d.work_type))].map((w) => (
                <MenuItem key={w} value={w}>{w}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* SOURCE NAME */}
          <TextField
            label="Source Name"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
          />

          {/* DATE FROM */}
          <TextField
            type="date"
            label="From"
            InputLabelProps={{ shrink: true }}
            onChange={(e) => setFromDate(e.target.value)}
          />

          {/* DATE TO */}
          <TextField
            type="date"
            label="To"
            InputLabelProps={{ shrink: true }}
            onChange={(e) => setToDate(e.target.value)}
          />

          {/* ✅ NEW ACTION TAKEN MULTISELECT */}
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Action Taken</InputLabel>
            <Select
              multiple
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} />
                  ))}
                </Box>
              )}
            >
              {actionTakenOptions.map((a) => (
                <MenuItem key={a} value={a}>
                  {a}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

        </Box>

        {/* ✅ TABLE (FULL – YOU PROVIDED – UNCHANGED) */}
        <TableContainer component={Paper} sx={{ maxHeight: "70vh", overflow: "auto" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {[
                  "HI Name",
                  "District",
                  "Block",
                  "PHC",
                  "Village",
                  "Work Type",
                  "Sources",
                  "Total Sources count",
                  "Entry Image",
                  "Location",
                  "Entry Date",
                  "Action Taken",
                  "Action Image",
                  "Action Location",
                  "Action Date",
                  "Distance",
                ].map((col) => (
                  <TableCell
                    key={col}
                    sx={{
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                      textAlign: "center",
                    }}
                  >
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>

                  <TableCell>{r.hi_name}</TableCell>
                  <TableCell>{r.district_name}</TableCell>
                  <TableCell>{r.block_name}</TableCell>
                  <TableCell>{r.phc_name}</TableCell>
                  <TableCell>{r.village_name}</TableCell>
                  <TableCell>{r.work_type}</TableCell>


                  <TableCell>
                    {r.sources?.map((s, i) => (
                      <div key={i}>{s.sourceName}: <b>{s.count}</b></div>
                    ))}
                  </TableCell>

                  <TableCell>{r.total_larvae}</TableCell>

                  {/* ENTRY PHOTO */}
                  <TableCell>
                    {r.image_url ? (
                      <img
                        src={r.image_url}
                        width={55}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setPhotoUrl(r.image_url);
                          setOpenPhoto(true);
                        }}
                      />
                    ) : "N/A"}
                  </TableCell>

                  {/* ENTRY MAP */}
                  <TableCell>
                    {r.latitude ? (
                      <Button
                        size="small"
                        onClick={() =>
                          setMapModal({
                            open: true,
                            locations: [{ lat: r.latitude, lng: r.longitude }],
                          })
                        }
                      >
                        View
                      </Button>
                    ) : "N/A"}
                  </TableCell>

                  <TableCell>{r.submitted_at?.split("T")[0]}</TableCell>

                  {/* ACTION TAKEN */}
                  <TableCell>
                    {(() => {
                      if (!r.action_taken) return "—";

                      let parsed = r.action_taken;

                      // Parse JSON safely
                      if (typeof parsed === "string") {
                        try {
                          parsed = JSON.parse(parsed);
                        } catch {
                          return r.action_taken; // fallback to raw string
                        }
                      }

                      const selected = parsed.selectedActions || [];
                      const sources = parsed.sourceActions || [];

                      return (
                        <div>
                          {/* Selected Actions Chips */}
                          {selected.length > 0 && (
                            <div style={{ marginBottom: "6px" }}>
                              {selected.map((a, i) => (
                                <Chip
                                  key={`sel-${i}-${a}`}
                                  label={a}
                                  size="small"
                                  color="primary"
                                  style={{ marginRight: 4 }}
                                />
                              ))}
                            </div>
                          )}

                          {/* Source Reduction details */}
                          {selected.includes("Source Reduction") && sources.length > 0 && (
                            <div style={{ marginTop: 6 }}>
                              {sources.map((src, i) => (
                                <div key={`src-${i}-${src.sourceName}`} style={{ fontSize: 12, marginTop: 2 }}>
                                  <strong>{src.sourceName}</strong> — {src.count} ({src.action})
                                </div>
                              ))}
                            </div>
                          )}

                        </div>
                      );
                    })()}
                  </TableCell>

                  {/* ACTION PHOTO */}
                  <TableCell>
                    {r.action_image_url ? (
                      <img
                        src={r.action_image_url}
                        width={55}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setPhotoUrl(r.action_image_url);
                          setOpenPhoto(true);
                        }}
                      />
                    ) : "N/A"}
                  </TableCell>

                  {/* ACTION LOCATION */}
                  <TableCell>
                    {r.action_location ? (
                      <Button
                        size="small"
                        onClick={() =>
                          setActionMapModal({
                            open: true,
                            locations: [
                              {
                                lat: r.action_location.latitude,
                                lng: r.action_location.longitude,
                              },
                            ],
                          })
                        }
                      >
                        View
                      </Button>
                    ) : "N/A"}
                  </TableCell>

                  <TableCell>
                    {r.action_date ? r.action_date.split("T")[0] : "N/A"}
                  </TableCell>
                  <TableCell>
                    {r.latitude &&
                      r.longitude &&
                      r.action_location?.latitude &&
                      r.action_location?.longitude ? (
                      (() => {
                        const rawDistance = calculateRawDistance(
                          r.latitude,
                          r.longitude,
                          r.action_location.latitude,
                          r.action_location.longitude
                        );

                        const formatted =
                          rawDistance >= 1000
                            ? (rawDistance / 1000).toFixed(2) + " km"
                            : Math.round(rawDistance) + " m";

                        const isOk = rawDistance <= 10;

                        return (
                          <span
                            style={{
                              color: isOk ? "green" : "red",
                              fontWeight: 700,
                            }}
                          >
                            {formatted}
                          </span>
                        );
                      })()
                    ) : (
                      "N/A"
                    )}
                  </TableCell>


                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ✅ PHOTO MODAL */}
        <Dialog open={openPhoto} onClose={() => setOpenPhoto(false)}>
          <DialogContent>
            <img src={photoUrl} width="100%" />
          </DialogContent>
        </Dialog>

        {/* ✅ ENTRY MAP MODAL */}
        <Dialog
          open={mapModal.open}
          onClose={() => setMapModal({ open: false, locations: [] })}
          fullWidth
          maxWidth="lg"
        >
          <DialogContent sx={{ height: "80vh", p: 0, position: "relative" }}>
            <IconButton
              onClick={() => setMapModal({ open: false, locations: [] })}
              sx={{ position: "absolute", top: 10, right: 10, zIndex: 1000 }}
            >
              <CloseIcon />
            </IconButton>

            {mapModal.locations.length > 0 && (
              <MapContainer
                center={[mapModal.locations[0].lat, mapModal.locations[0].lng]}
                zoom={14}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {mapModal.locations.map((loc, i) => (
                  <Marker key={i} position={[loc.lat, loc.lng]}>
                    <Popup>{loc.lat}, {loc.lng}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </DialogContent>
        </Dialog>

        {/* ✅ ACTION MAP MODAL */}
        <Dialog
          open={actionMapModal.open}
          onClose={() => setActionMapModal({ open: false, locations: [] })}
          fullWidth
          maxWidth="lg"
        >
          <DialogContent sx={{ height: "80vh", p: 0, position: "relative" }}>

            <IconButton
              onClick={() => setActionMapModal({ open: false, locations: [] })}
              sx={{ position: "absolute", top: 10, right: 10, zIndex: 1000 }}
            >
              <CloseIcon />
            </IconButton>

            {actionMapModal.locations.length > 0 && (
              <MapContainer
                center={[actionMapModal.locations[0].lat, actionMapModal.locations[0].lng]}
                zoom={14}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {actionMapModal.locations.map((loc, i) => (
                  <Marker key={i} position={[loc.lat, loc.lng]}>
                    <Popup>{loc.lat}, {loc.lng}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}

          </DialogContent>
        </Dialog>

      </Box>
    </DashboardLayout>
  );
};

export default LarvaEntry;
