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
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const [hudMaster, setHudMaster] = useState([]);
  const [phcMaster, setPhcMaster] = useState([]);

  const [hud, setHud] = useState("");
  const [block, setBlock] = useState("");
  const [blocks, setBlocks] = useState([]); // blocks for dropdown
  const [selectedBlock, setSelectedBlock] = useState(""); // selected block

  const [phc, setPhc] = useState("");
  const [phcs, setPhcs] = useState([]);
  const [villages, setVillages] = useState([]);
  const [selectedPhc, setSelectedPhc] = useState("");
  const [selectedVillage, setSelectedVillage] = useState("");

  const [village, setVillage] = useState("");
  const [user, setUser] = useState("");
  const [workType, setWorkType] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [actionTaken, setActionTaken] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [openPhoto, setOpenPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");

  const [mapModal, setMapModal] = useState({ open: false, locations: [] });
  const [actionMapModal, setActionMapModal] = useState({ open: false, locations: [] });

  const [districtUser, setDistrictUser] = useState(null);

  const actionTakenOptions = ["Anti Larval Work", "Fogging", "Source Reduction"];

  // ------------------- HELPER -------------------
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


  // ------------------- LEVENSHTEIN DISTANCE & SIMILARITY -------------------
  const levenshteinDistance = (a = "", b = "") => {
    const matrix = Array.from({ length: b.length + 1 }, () =>
      Array(a.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i - 1] + 1,
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  };

  const similarity = (a, b) => {
    if (!a || !b) return 0;
    const dist = levenshteinDistance(a, b);
    return ((Math.max(a.length, b.length) - dist) / Math.max(a.length, b.length)) * 100;
  };

  // ------------------- FETCH DISTRICT USER -------------------
  useEffect(() => {
    const fetchDistrictUser = async () => {
      const res = await fetch("http://localhost:3000/dashboard/district-officers");
      const users = await res.json();
      const loggedInUsername = localStorage.getItem("loggedInUsername");

      const matched = users.find(
        (u) => u.username?.toLowerCase() === loggedInUsername?.toLowerCase()
      );

      if (matched) setDistrictUser(matched);
    };
    fetchDistrictUser();
  }, []);

  // ------------------- FETCH MASTER DATA -------------------
  useEffect(() => {
    const loadMaster = async () => {
      const v = await fetch("http://localhost:3000/dashboard/village").then((r) => r.json());
      const p = await fetch("http://localhost:3000/dashboard/phc").then((r) => r.json());
      setHudMaster(v);
      setPhcMaster(p);
    };
    loadMaster();
  }, []);

  // ------------------- FETCH LARVA ENTRIES -------------------
  useEffect(() => {
    if (!districtUser) return;

    const fetchData = async () => {
      const res = await fetch("http://localhost:3000/dashboard/get-larva-entries");
      const json = await res.json();

      if (!Array.isArray(json)) {
        console.error("Larva API returned non-array:", json);
        return;
      }

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
        sources: Array.isArray(row.sources)
          ? row.sources
          : row.sources === null || row.sources === undefined
            ? []
            : typeof row.sources === "string"
              ? (() => {
                try { return JSON.parse(row.sources); }
                catch { return []; }
              })()
              : [],
        image_url: row.image_path ? `http://localhost:3000${row.image_path}` : null,
        action_taken: row.action_taken,
        action_image_url: row.action_image_path ? `http://localhost:3000${row.action_image_path}` : null,
        action_date: row.action_date,
        action_location: row.action_location
          ? JSON.parse(row.action_location)
          : null,
      }));

      const filteredByDistrict = list.filter((d) => {
        const sim = similarity(d.district_name, districtUser.district_name);
        return sim >= 80;
      });

      setData(filteredByDistrict);
      const badRecords = filteredByDistrict.filter(r => r.sources && !Array.isArray(r.sources));
      if (badRecords.length > 0) {
        console.warn(` Found ${badRecords.length} records with invalid 'sources' in production`);
        console.log("Sample bad record:", badRecords[0]);
      }
      setFiltered(filteredByDistrict);
    };

    fetchData();
  }, [districtUser]);

  useEffect(() => {
    if (!districtUser) return;

    fetch("http://localhost:3000/dashboard/mosquito-blocks")
      .then((res) => res.json())
      .then((res) => {
        const userBlocks = res.filter(
          (b) => b.district_code === districtUser.district_code
        );
        setBlocks(userBlocks);
        if (userBlocks.length === 1) setSelectedBlock(userBlocks[0].block_name);
      });
  }, [districtUser]);

  useEffect(() => {
    if (!selectedBlock) {
      setPhcs([]);
      setSelectedPhc("");
      setVillages([]);
      setSelectedVillage("");
      return;
    }

    // Fetch PHC for the selected block
    fetch(`http://localhost:3000/dashboard/phc?block_name=${selectedBlock}`)
      .then((res) => res.json())
      .then((data) => {
        setPhcs(data);
        if (data.length === 1) setSelectedPhc(data[0].phc_name);
      });

    // Fetch Villages for the selected block
    fetch(`http://localhost:3000/dashboard/village?block_name=${selectedBlock}`)
      .then((res) => res.json())
      .then((data) => {
        setVillages(data);
        if (data.length === 1) setSelectedVillage(data[0].village_name);
      });
  }, [selectedBlock]);

  // ------------------- DEPENDENT DROPDOWNS -------------------
  // const hudOptions = [...new Set(hudMaster.map((d) => d.hud_name))];
  // const blockOptions = [
  //   ...new Set(
  //     hudMaster.filter((d) => (hud ? d.hud_name === hud : true)).map((d) => d.block_name)
  //   ),
  // ];
  // const villageOptions = [
  //   ...new Set(
  //     hudMaster.filter((d) => (block ? d.block_name === block : true)).map((d) => d.village_name)
  //   ),
  // ];
  // const phcOptions = [
  //   ...new Set(
  //     phcMaster.filter((p) => (block ? p.block_name === block : true)).map((p) => p.phc_name)
  //   ),
  // ];

  // ------------------- APPLY FILTERS -------------------
  useEffect(() => {
    let f = [...data];

    // if (hud) f = f.filter((d) => d.hud_name === hud);
    if (selectedBlock) f = f.filter((d) => d.block_name === selectedBlock);
    if (selectedPhc) f = f.filter((d) => d.phc_name === selectedPhc);
    if (selectedVillage) f = f.filter((d) => d.village_name === selectedVillage);

    if (user) f = f.filter((d) => d.hi_name === user);
    if (workType) f = f.filter((d) => d.work_type === workType);
    if (sourceName)
      f = f.filter((d) =>
        d.sources?.some((s) =>
          s.sourceName.toLowerCase().includes(sourceName.toLowerCase())
        )
      );
    if (actionTaken.length > 0) {
      f = f.filter((d) => {
        if (!d.action_taken) return false;
        let parsed = d.action_taken;
        if (typeof parsed === "string") parsed = JSON.parse(parsed);
        const selected = parsed.selectedActions || [];
        return actionTaken.some((a) => selected.includes(a));
      });
    }
    if (fromDate) f = f.filter((d) => d.submitted_at.split("T")[0] >= fromDate);
    if (toDate) f = f.filter((d) => d.submitted_at.split("T")[0] <= toDate);

    setFiltered(f);
  }, [hud, block, phc, village, user, workType, sourceName, actionTaken, fromDate, toDate, data]);

  // ------------------- EXPORT EXCEL -------------------
  const exportExcel = () => {
    if (filtered.length === 0) return alert("No data to export");

    const exportRows = filtered.map((r) => {
      let selectedActions = [];
      let sourceActionsText = "";

      if (r.action_taken) {
        let parsed = r.action_taken;
        if (typeof parsed === "string") parsed = JSON.parse(parsed);
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
        District: r.district_name || r.hud_name || "N/A",
        Block: r.block_name || "N/A",
        PHC: r.phc_name || "N/A",
        Village: r.village_name || "N/A",
        "Work Type": r.work_type || "N/A",
        Sources: Array.isArray(r.sources)
          ? r.sources.map((s) => `${s?.sourceName || "?"} (${s?.count ?? 0})`).join(", ") || "N/A"
          : "N/A",
        "Total Source Reduction": r.total_larvae ?? "N/A",
        "Entry Date": r.submitted_at?.split("T")[0] || "N/A",
        "Action Taken": selectedActions.join(", ") || "N/A",
        "Source Actions": sourceActionsText || "N/A",
        "Action Date": r.action_date?.split("T")[0] || "N/A",
        Distance: r.latitude && r.longitude && r.action_location
          ? Math.round(calculateRawDistance(
            r.latitude,
            r.longitude,
            r.action_location?.lat || 0,
            r.action_location?.lng || 0
          ))
          : "-"
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

  // ------------------- RENDER -------------------
  return (
    <DashboardLayout>
      <Box sx={{ marginLeft: 5, pt: 5, pb: 4 }}>
        <Typography variant="h5" fontWeight={700} mb={2}>
          LARVAL SURVEY REPORT - {districtUser?.district_name || "N/A"}
        </Typography>

        <Button variant="contained" color="success" sx={{ mb: 2 }} onClick={exportExcel}>
          Download Excel
        </Button>

        {/* FILTERS */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
          {/* HUD */}
          {/* <FormControl sx={{ minWidth: 180 }}>
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
          </FormControl> */}

          {/* BLOCK */}
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>Block</InputLabel>
            <Select
              value={selectedBlock}
              onChange={(e) => {
                setSelectedBlock(e.target.value);
                setPhc(""); // reset dependent filters
                setVillage("");
              }}
            >
              <MenuItem value="">All</MenuItem>
              {blocks.map((b) => (
                <MenuItem key={b.block_name} value={b.block_name}>
                  {b.block_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>


          {/* PHC */}
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>PHC</InputLabel>
            <Select
              value={selectedPhc}
              onChange={(e) => setSelectedPhc(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {phcs.map((p) => (
                <MenuItem key={p.phc_name} value={p.phc_name}>
                  {p.phc_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>


          {/* VILLAGE */}
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>Village</InputLabel>
            <Select
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {villages.map((v) => (
                <MenuItem key={v.village_name} value={v.village_name}>
                  {v.village_name}
                </MenuItem>
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

          {/* ACTION TAKEN */}
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
                <MenuItem key={a} value={a}>{a}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* TABLE */}
        <TableContainer component={Paper} sx={{ maxHeight: "70vh", overflow: "auto" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {[
                  "HI Name", "District", "Block", "PHC", "Village",
                  "Work Type", "Sources", "Total Source Reduction", "Entry Image", "Location",
                  "Entry Date", "Action Taken", "Action Image", "Action Location",
                  "Action Date", "Distance"
                ].map((col) => (
                  <TableCell key={col} sx={{ fontWeight: "bold", whiteSpace: "nowrap", textAlign: "center" }}>
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
                  <TableCell>{r.phc_name || "N/A"}</TableCell>
                  <TableCell>{r.village_name || "N/A"}</TableCell>
                  <TableCell>{r.work_type}</TableCell>
                  <TableCell>
                    {Array.isArray(r.sources) && r.sources.length > 0
                      ? r.sources.map((s) => `${s?.sourceName || "?"} (${s?.count ?? 0})`).join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell>{r.total_larvae}</TableCell>
                  <TableCell>
                    {r.image_url && (
                      <img
                        src={r.image_url}
                        alt="Entry"
                        style={{ width: 60, cursor: "pointer" }}
                        onClick={() => { setPhotoUrl(r.image_url); setOpenPhoto(true); }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {r.latitude && r.longitude && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setMapModal({ open: true, locations: [r] })}
                      >
                        Map
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>{r.submitted_at?.split("T")[0]}</TableCell>
                  <TableCell>{r.action_taken || "N/A"}</TableCell>
                  <TableCell>
                    {r.action_image_url && (
                      <img
                        src={r.action_image_url}
                        alt="Action"
                        style={{ width: 60 }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {r.action_location && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setActionMapModal({ open: true, locations: [r] })}
                      >
                        Map
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>{r.action_date?.split("T")[0]}</TableCell>
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

        {/* PHOTO MODAL */}
        <Dialog open={openPhoto} onClose={() => setOpenPhoto(false)} maxWidth="md">
          <DialogContent>
            <img src={photoUrl} alt="Larva" style={{ width: "100%" }} />
          </DialogContent>
        </Dialog>

        {/* MAP MODAL */}
        <Dialog
          open={mapModal.open}
          onClose={() => setMapModal({ open: false, locations: [] })}
          maxWidth="md"
          fullWidth
        >
          <DialogContent>
            <MapContainer
              center={[11, 78]}
              zoom={7}
              style={{ height: 400, width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {mapModal.locations.map((loc) => (
                <Marker key={loc.id} position={[loc.latitude, loc.longitude]}>
                  <Popup>
                    {loc.hi_name} <br /> {loc.block_name} <br /> {loc.village_name}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </DialogContent>
        </Dialog>

        {/* ACTION MAP MODAL */}
        <Dialog
          open={actionMapModal.open}
          onClose={() => setActionMapModal({ open: false, locations: [] })}
          maxWidth="md"
          fullWidth
        >
          <DialogContent>
            <MapContainer
              center={[11, 78]}
              zoom={7}
              style={{ height: 400, width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {actionMapModal.locations.map((loc) => (
                <Marker
                  key={loc.id}
                  position={[loc.action_location?.lat || 0, loc.action_location?.lng || 0]}
                >
                  <Popup>
                    {loc.hi_name} <br /> {loc.block_name} <br /> {loc.village_name}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </DialogContent>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
};

export default LarvaEntry;
