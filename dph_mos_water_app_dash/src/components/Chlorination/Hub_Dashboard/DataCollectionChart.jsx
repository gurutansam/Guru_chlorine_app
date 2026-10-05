import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  TextField,
  CircularProgress,
} from "@mui/material";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import DownloadIcon from "@mui/icons-material/Download";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";

// ---- Color Mapping ----
const COLOR_MAP = { Adequate: "#43a047", Inadequate: "#fb8c00", Nil: "#e53935" };

// ---- Unified PPM Classification ----
const classifyPpm = (ppm, sampling) => {
  const raw = parseFloat(ppm);
  if (isNaN(raw)) return { ppm: 0, status: "Nil" };
  const norm = raw > 0 && raw < 0.1 ? 0 : Math.round(raw * 10) / 10;
  const s = (sampling || "").toUpperCase();

  if (s === "TAIL" || s === "MID") {
    if (norm === 0) return { ppm: 0, status: "Nil" };
    if (norm < 0.2) return { ppm: norm, status: "Inadequate" };
    return { ppm: norm, status: "Adequate" };
  } else if (s === "OHT" || s === "GLR" || s === "SUMP") {
    if (norm === 0) return { ppm: 0, status: "Nil" };
    if (norm < 1) return { ppm: norm, status: "Inadequate" };
    return { ppm: norm, status: "Adequate" };
  }

  return { ppm: norm, status: "Nil" };
};

// ---- Date Parsing ----
const parseDate = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp.includes("T")) return new Date(timestamp);

  const parts = timestamp.split(",");
  const [day, month, year] = parts[0].trim().split("/").map(Number);
  if (!day || !month || !year) return null;

  let parsed;
  if (parts[1]) parsed = new Date(`${year}-${month}-${day} ${parts[1].trim()}`);
  else parsed = new Date(year, month - 1, day);

  return isNaN(parsed) ? null : parsed;
};

const isWithinDateRange = (timestamp, fromDate, toDate) => {
  const rowDate = parseDate(timestamp);
  if (!rowDate) return false;
  let fromD = fromDate ? new Date(fromDate) : null;
  let toD = toDate ? new Date(toDate) : null;
  if (fromD && toD && fromD > toD) [fromD, toD] = [toD, fromD];
  if (fromD) fromD.setHours(0, 0, 0, 0);
  if (toD) toD.setHours(23, 59, 59, 999);
  if (fromD && toD) return rowDate >= fromD && rowDate <= toD;
  if (fromD) return rowDate >= fromD;
  if (toD) return rowDate <= toD;
  return true;
};

// ---- Export to Excel (All Fields) ----
const exportToExcel = async (rows, filename = "PPM_Summary.xlsx") => {
  if (!rows || rows.length === 0) {
    alert("No data available to export.");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("PPM Summary");

  const headers = [
    "Sl. No",
    "Username",
    "Hub/HUD",
    "Block",
    "Address",
    "Actual PPM",
    "Measured PPM",
    "Sampling Point",
    "Timestamp",
    "Latitude",
    "Longitude",
    "Status",
  ];
  sheet.addRow(headers);

  const getExcelColor = (value, sampling) => {
    const { status } = classifyPpm(value, sampling);
    switch (status) {
      case "Adequate": return "FF43A047";
      case "Inadequate": return "FFFB8C00";
      case "Nil": return "FFE53935";
      default: return "FFFFFFFF";
    }
  };

  rows.forEach((row, index) => {
    // Normalize measured PPM
    const rawPpm = parseFloat(row.ppm);
    const measuredPpm = rawPpm > 0 && rawPpm < 0.1 ? 0 : Math.round(rawPpm * 10) / 10;

    // Determine status using the existing classifyPpm function
    const { status: measuredStatus } = classifyPpm(measuredPpm, row.samplingPoint);

    const excelRow = sheet.addRow([
      index + 1,
      row.username || "",
      row.hub_name || row.hud_name || "",
      row.block_name || "",
      row.address || "",
      row.actualPPM || "",
      measuredPpm,
      row.samplingPoint || "",
      row.timestamp || "",
      row.latitude || "",
      row.longitude || "",
      measuredStatus,
    ]);

    // Color Actual PPM
    const actualCell = excelRow.getCell(6);
    actualCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: getExcelColor(row.actualPPM, row.samplingPoint) } };
    actualCell.font = { color: { argb: "FFFFFFFF" }, bold: true };

    // Color Measured PPM
    const measuredCell = excelRow.getCell(7);
    measuredCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: getExcelColor(measuredPpm, row.samplingPoint) } };
    measuredCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
  });

  try {
    const buf = await workbook.xlsx.writeBuffer();
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const datedFilename = filename.replace(".xlsx", `_${yyyy}-${mm}-${dd}_${hh}${min}${ss}.xlsx`);
    saveAs(new Blob([buf]), datedFilename);
    toast.success("Excel exported successfully");
  } catch (err) {
    console.error(err);
    toast.error("Failed to export Excel");
  }
};

// ---- Summary Cards ----
const SummaryCards = ({ rows }) => {
  const counts = useMemo(() => {
    const c = { Adequate: 0, Inadequate: 0, Nil: 0 };
    rows.forEach((row) => {
      const { status } = classifyPpm(row.ppm, row.samplingPoint);
      c[status] += 1;
    });
    c.Total = c.Adequate + c.Inadequate + c.Nil;
    return c;
  }, [rows]);

  const cardData = [
    { label: "Adequate", value: counts.Adequate, color: COLOR_MAP.Adequate },
    { label: "Inadequate", value: counts.Inadequate, color: COLOR_MAP.Inadequate },
    { label: "Nil", value: counts.Nil, color: COLOR_MAP.Nil },
    { label: "Total", value: counts.Total, color: "#607d8b" },
  ];

  return (
    <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 2 }}>
      {cardData.map((c) => {
        const percentage = c.label !== "Total" ? (c.value / (counts.Total || 1)) * 100 : 100;
        return (
          <Box key={c.label} sx={{ background: "#f5f7fa", borderRadius: 2, p: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: 1, position: "relative", minHeight: 80, "&:hover": { boxShadow: 3 } }}>
            <Typography sx={{ fontWeight: 700, color: c.color, mb: 1, textTransform: "uppercase", fontSize: 14 }}>{c.label}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>{c.value}</Typography>
            {c.label !== "Total" && (
              <Box sx={{ position: "absolute", bottom: 0, left: 0, height: 6, width: `${percentage}%`, backgroundColor: c.color, borderRadius: "0 0 4px 4px" }} />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

// ---- Main Component ----
export default function DataCollectionChart() {
  const [userHubId, setUserHubId] = useState(null);
  const [hubRows, setHubRows] = useState([]);
  const [hudRows, setHudRows] = useState([]);
  const [blockList, setBlockList] = useState([]);
  const [hudList, setHudList] = useState([]); // Added hudList state
  const [loading, setLoading] = useState(true);

  const [rwalHub, setRwalHub] = useState("All");
  const [rwalPpmFilter, setRwalPpmFilter] = useState("All");
  const [rwalFromDate, setRwalFromDate] = useState("");
  const [rwalToDate, setRwalToDate] = useState("");

  const [hudBlock, setHudBlock] = useState("");
  const [selectedHud, setSelectedHud] = useState(""); // Added selectedHud state
  const [hudPpmFilter, setHudPpmFilter] = useState("All");
  const [hudFromDate, setHudFromDate] = useState("");
  const [hudToDate, setHudToDate] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const userStr = localStorage.getItem("loggedInUser");
        const userObj = userStr ? JSON.parse(userStr) : null;
        if (!userObj?.username) return;

        const userRes = await fetch("http://localhost:3000/dashboard/chl-hubusers");
        const userData = await userRes.json();
        const loggedUser = userData.find((u) => u.username === userObj.username);
        if (!loggedUser) return;
        setUserHubId(loggedUser.hub_id);

        const [blockRes, hudRes] = await Promise.all([
          fetch("http://localhost:3000/dashboard/hud-blocks"),
          fetch("http://localhost:3000/dashboard/hud"),
        ]);
        const blocks = await blockRes.json();
        const huds = await hudRes.json();
        setBlockList(blocks);
        setHudList(huds); // Set HUD list

        const blockToHub = {};
        blocks.forEach((block) => {
          const hud = huds.find((h) => h.hud_id === block.hud_id);
          if (hud) blockToHub[block.block_id] = hud.hub_id;
        });

        const hubRes = await fetch(`http://localhost:3000/dashboard/chl_datacollection/hubid?hub_id=${loggedUser.hub_id}`, { credentials: "include" });
        const hubData = await hubRes.json();
        setHubRows(Array.isArray(hubData) ? hubData : hubData?.data || []);

        const hudResData = await fetch("http://localhost:3000/dashboard/chl_hud_datacollection");
        const hudData = await hudResData.json();
        const filteredHud = hudData
          .filter((item) => blockToHub[item.block_id] === loggedUser.hub_id)
          .map((item, index) => ({ id: index + 1, ...item }));
        setHudRows(filteredHud);
      } catch (err) {
        console.error(err);
        toast.error("Network error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const rwalFiltered = useMemo(() => {
    let result = [...hubRows];
    if (rwalHub !== "All") result = result.filter((r) => r.hub_name === rwalHub);
    if (rwalPpmFilter !== "All")
      result = result.filter((r) => classifyPpm(r.ppm, r.samplingPoint).status === rwalPpmFilter);
    return result.filter((r) => isWithinDateRange(r.timestamp, rwalFromDate, rwalToDate));
  }, [hubRows, rwalHub, rwalPpmFilter, rwalFromDate, rwalToDate]);

  const hudFiltered = useMemo(() => {
    let result = [...hudRows];
    if (selectedHud) {
      const hudBlocks = blockList
        .filter((b) => b.hud_id === selectedHud)
        .map((b) => b.block_id);
      result = result.filter((r) => hudBlocks.includes(r.block_id));
    }
    if (hudBlock && hudBlock !== "All") result = result.filter((r) => r.block_id === hudBlock);
    if (hudPpmFilter !== "All")
      result = result.filter((r) => classifyPpm(r.ppm, r.samplingPoint).status === hudPpmFilter);
    return result.filter((r) => isWithinDateRange(r.timestamp, hudFromDate, hudToDate));
  }, [hudRows, selectedHud, hudBlock, blockList, hudPpmFilter, hudFromDate, hudToDate]);

  const getChartData = (filteredRows) => {
    const counts = { Adequate: 0, Inadequate: 0, Nil: 0 };
    filteredRows.forEach((r) => {
      const { status } = classifyPpm(r.ppm, r.samplingPoint);
      counts[status] += 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: COLOR_MAP[name] }));
  };

  const rwalChartData = useMemo(() => getChartData(rwalFiltered), [rwalFiltered]);
  const hudChartData = useMemo(() => getChartData(hudFiltered), [hudFiltered]);

  if (loading) return <CircularProgress />;

  return (
    <Box sx={{ p: 4, pl: 10 }}>
      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={4}>
        {/* RWAL Section */}
        <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3 }}>
          <Typography variant="h6" fontWeight="bold" mb={2}> Chlorination Monitoring - RWAL</Typography>
          <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Region</InputLabel>
              <Select value={rwalHub} onChange={(e) => setRwalHub(e.target.value)}>
                {["All", ...Array.from(new Set(hubRows.map((r) => r.hub_name).filter(Boolean)))].map(
                  (hub) => <MenuItem key={hub} value={hub}>{hub}</MenuItem>
                )}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>PPM</InputLabel>
              <Select value={rwalPpmFilter} onChange={(e) => setRwalPpmFilter(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Adequate">Adequate</MenuItem>
                <MenuItem value="Inadequate">Inadequate</MenuItem>
                <MenuItem value="Nil">Nil</MenuItem>
              </Select>
            </FormControl>
            <TextField label="From" type="date" size="small" value={rwalFromDate} onChange={(e) => setRwalFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="To" type="date" size="small" value={rwalToDate} onChange={(e) => setRwalToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box display="flex" justifyContent="flex-end" mb={1}>
            <Tooltip title="Download Excel">
              <IconButton onClick={() => exportToExcel(rwalFiltered, "RWAL_Chlorination.xlsx")}>
                <DownloadIcon sx={{ color: "primary.main" }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rwalChartData}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <ReTooltip />
                <Legend />
                <Bar dataKey="value" barSize={50}>
                  {rwalChartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <SummaryCards rows={rwalFiltered} />
        </Paper>

        {/* HUD Section */}
        <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3 }}>
          <Typography variant="h6" fontWeight="bold" mb={2}>Chlorination Monitoring - HUD</Typography>
          <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>HUD</InputLabel>
              <Select
                value={selectedHud}
                onChange={(e) => {
                  setSelectedHud(e.target.value);
                  setHudBlock(""); // Reset block when HUD changes
                }}
              >
                <MenuItem value="">All HUDs</MenuItem>
                {hudList.map((h) => (
                  <MenuItem key={h.hud_id} value={h.hud_id}>
                    {h.hud_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }} disabled={!selectedHud}>
              <InputLabel>Block</InputLabel>
              <Select value={hudBlock} onChange={(e) => setHudBlock(e.target.value)}>
                <MenuItem value="">All Blocks</MenuItem>
                {blockList
                  .filter((b) => b.hud_id === selectedHud)
                  .map((block) => (
                    <MenuItem key={block.block_id} value={block.block_id}>
                      {block.block_name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>PPM</InputLabel>
              <Select value={hudPpmFilter} onChange={(e) => setHudPpmFilter(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Adequate">Adequate</MenuItem>
                <MenuItem value="Inadequate">Inadequate</MenuItem>
                <MenuItem value="Nil">Nil</MenuItem>
              </Select>
            </FormControl>
            <TextField label="From" type="date" size="small" value={hudFromDate} onChange={(e) => setHudFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="To" type="date" size="small" value={hudToDate} onChange={(e) => setHudToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box display="flex" justifyContent="flex-end" mb={1}>
            <Tooltip title="Download Excel">
              <IconButton onClick={() => exportToExcel(hudFiltered, `HUD_${hudBlock}_Chlorination.xlsx`)}>
                <DownloadIcon sx={{ color: "primary.main" }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hudChartData}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <ReTooltip />
                <Legend />
                <Bar dataKey="value" barSize={50}>
                  {hudChartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <SummaryCards rows={hudFiltered} />
        </Paper>
      </Box>
    </Box>
  );
}