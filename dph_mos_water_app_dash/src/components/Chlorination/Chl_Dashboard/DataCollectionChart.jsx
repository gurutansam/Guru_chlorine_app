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

// ---- Color Maps ----
const EXCEL_COLOR_MAP = {
  Adequate: "FF43A047",
  Inadequate: "FFFB8C00",
  Nil: "FFE53935",
};

const CHART_COLOR_MAP = {
  Adequate: "#43A047",
  Inadequate: "#FB8C00",
  Nil: "#E53935",
};

// ---- PPM Classification ----
const classifyPpm = (ppmValue, samplingPoint) => {
  const raw = parseFloat(ppmValue);
  if (isNaN(raw)) return { ppm: 0, status: "Nil" };

  const norm = raw > 0 && raw < 0.1 ? 0 : Math.round(raw * 10) / 10;
  const s = (samplingPoint || "").toUpperCase();
  let status = "Nil";

  if (s === "TAIL" || s === "MID") {
    if (norm === 0) status = "Nil";
    else if (norm < 0.2) status = "Inadequate";
    else status = "Adequate";
  } else if (s === "OHT") {
    if (norm === 0) status = "Nil";
    else if (norm < 1) status = "Inadequate";
    else status = "Adequate";
  } else {
    status = norm === 0 ? "Nil" : "Adequate";
  }

  return { ppm: norm, status };
};

// ---- Date Parsing ----
const parseDate = (timestamp) => {
  if (!timestamp) return null;
  const parts = timestamp.split(",");
  const datePart = parts[0].trim();
  const [day, month, year] = datePart.split("/").map(Number);
  if (!day || !month || !year) return null;

  let parsed;
  if (parts[1]) {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const timeStr = parts[1].trim();
    parsed = new Date(`${year}-${mm}-${dd} ${timeStr}`);
  } else {
    parsed = new Date(year, month - 1, day);
  }
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

// ---- Excel Export ----
const exportToExcel = async (rows, filename = "data.xlsx") => {
  if (!rows || rows.length === 0) {
    alert("No data available to export.");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("PPM Summary");

  sheet.addRow([
    "Sl. No",
    "Username",
    "HUD",
    "Block",
    "Address",
    "Actual PPM",
    "Measured PPM",
    "Sampling Point",
    "Timestamp",
    "Latitude",
    "Longitude",
    "Status",
  ]);

  rows.forEach((row, index) => {
    const { ppm, status } = classifyPpm(row.ppm, row.samplingPoint);
    sheet.addRow([
      index + 1,
      row.username,
      row.hub_name,
      row.block_name,
      row.address,
      row.actualPPM,
      ppm,
      row.samplingPoint,
      row.timestamp,
      row.latitude,
      row.longitude,
      status,
    ]);
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const actualStatus = classifyPpm(row.getCell(6).value, row.getCell(8).value).status;
    const measuredStatus = classifyPpm(row.getCell(7).value, row.getCell(8).value).status;
    const statusStatus = row.getCell(12).value;

    row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLOR_MAP[actualStatus] } };
    row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLOR_MAP[measuredStatus] } };
    row.getCell(12).fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLOR_MAP[statusStatus] } };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), filename);
};

// ---- Summary Cards ----
const SummaryCards = ({ rows, serverCounts }) => {
  const counts = useMemo(() => {
    if (serverCounts) {
      const { Total, ...rest } = serverCounts;
      return { ...rest, Total: Total || (rest.Adequate + rest.Inadequate + rest.Nil) };
    }
    const c = { Adequate: 0, Inadequate: 0, Nil: 0 };
    (rows || []).forEach((row) => {
      const { status } = classifyPpm(row.ppm, row.samplingPoint);
      if (c[status] !== undefined) c[status] += 1;
    });
    c.Total = c.Adequate + c.Inadequate + c.Nil;
    return c;
  }, [rows, serverCounts]);

  const cardData = [
    { label: "Adequate", value: counts.Adequate, color: CHART_COLOR_MAP.Adequate },
    { label: "Inadequate", value: counts.Inadequate, color: CHART_COLOR_MAP.Inadequate },
    { label: "Nil", value: counts.Nil, color: CHART_COLOR_MAP.Nil },
    { label: "Total", value: counts.Total, color: "#607d8b" },
  ];

  return (
    <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 2 }}>
      {cardData.map((c) => {
        const percentage = c.label !== "Total" ? (c.value / (cardData[3].value || 1)) * 100 : 100;
        return (
          <Box
            key={c.label}
            sx={{
              background: "#f5f7fa",
              borderRadius: 2,
              p: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: 1,
              position: "relative",
              minHeight: 80,
              "&:hover": { boxShadow: 3 },
            }}
          >
            <Typography sx={{ fontWeight: 700, color: c.color, mb: 1, textTransform: "uppercase", fontSize: 14 }}>
              {c.label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {c.value}
            </Typography>
            {c.label !== "Total" && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  height: 6,
                  width: `${percentage}%`,
                  backgroundColor: c.color,
                  borderRadius: "0 0 4px 4px",
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

// ---- Main Component ----
export default function DataCollectionChart({ rows = [] }) {
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [rwalHub, setRwalHub] = useState("All");
  const [rwalPpmFilter, setRwalPpmFilter] = useState("All");
  const [rwalFromDate, setRwalFromDate] = useState(getTodayDateString());
  const [rwalToDate, setRwalToDate] = useState(getTodayDateString());
  const [rwalSourceRows, setRwalSourceRows] = useState([]);
  const [loadingRwalRows, setLoadingRwalRows] = useState(true);

  const [hudList, setHudList] = useState([]);
  const [hudBlock, setHudBlock] = useState("All");
  const [hudSelected, setHudSelected] = useState(""); // HUD filter
  const [hudPpmFilter, setHudPpmFilter] = useState("All");
  const [hudFromDate, setHudFromDate] = useState(getTodayDateString());
  const [hudToDate, setHudToDate] = useState(getTodayDateString());

  const [allHudRows, setAllHudRows] = useState([]);
  const [blockNames, setBlockNames] = useState(["All"]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [loadingHudRows, setLoadingHudRows] = useState(true);

  // Fetch RWAL
  useEffect(() => {
    const fetchRwal = async () => {
      setLoadingRwalRows(true);
      try {
        const params = new URLSearchParams();
        if (rwalFromDate) {
          const [yyyy, mm, dd] = rwalFromDate.split('-');
          params.append("fromDate", `${dd}/${mm}/${yyyy}`);
        }
        if (rwalToDate) {
          const [yyyy, mm, dd] = rwalToDate.split('-');
          params.append("toDate", `${dd}/${mm}/${yyyy}`);
        }

        const res = await fetch(`http://localhost:3000/dashboard/chl_datacollection?${params.toString()}`);
        const data = await res.json();
        setRwalSourceRows(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setRwalSourceRows([]);
      } finally {
        setLoadingRwalRows(false);
      }
    };
    fetchRwal();
  }, [rwalFromDate, rwalToDate]);

  const [hudCounts, setHudCounts] = useState(null);
  const [allBlocksMaster, setAllBlocksMaster] = useState([]);

  // Fetch HUD Summary (Server-Side)
  useEffect(() => {
    const fetchHudSummary = async () => {
      setLoadingHudRows(true);
      try {
        const params = new URLSearchParams();
        if (hudSelected && hudSelected !== "All") params.append("hud_name", hudSelected);
        if (hudBlock && hudBlock !== "All") params.append("block_name", hudBlock);
        if (hudPpmFilter && hudPpmFilter !== "All") params.append("ppm_status", hudPpmFilter);

        // Date format convert to DD/MM/YYYY for the backend
        if (hudFromDate) {
          const [yyyy, mm, dd] = hudFromDate.split('-');
          params.append("fromDate", `${dd}/${mm}/${yyyy}`);
        }
        if (hudToDate) {
          const [yyyy, mm, dd] = hudToDate.split('-');
          params.append("toDate", `${dd}/${mm}/${yyyy}`);
        }

        const res = await fetch(`http://localhost:3000/dashboard/chl_hud_dashboard_summary?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setAllHudRows(data.rows || []);
          setHudCounts(data.counts);

          // Only update masters on initial load to avoid losing options
          if (!hudSelected && !hudBlock && !hudFromDate && !hudToDate && hudPpmFilter === "All") {
            setHudList(data.huds || []);
            setAllBlocksMaster(data.blocks || []);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingHudRows(false);
      }
    };
    fetchHudSummary();
  }, [hudSelected, hudBlock, hudPpmFilter, hudFromDate, hudToDate]);

  // Filtered blocks based on HUD
  const filteredBlocks = useMemo(() => {
    if (!hudSelected) return ["All"];
    const blocks = allBlocksMaster
      .filter((r) => r.hud_name === hudSelected)
      .map((r) => r.block_name)
      .filter(Boolean);
    return ["All", ...Array.from(new Set(blocks))];
  }, [allBlocksMaster, hudSelected]);

  const hubs = useMemo(() => {
    const allHubs = (rwalSourceRows || []).map((r) => r.hub_name).filter(Boolean);
    return ["All", ...Array.from(new Set(allHubs))];
  }, [rwalSourceRows]);

  const filterRows = (rows, hubOrBlock, ppmFilter, fromDate, toDate, isHub = true) => {
    let result = [...(rows || [])];
    if (hubOrBlock !== "All")
      result = result.filter((r) => (isHub ? r.hub_name === hubOrBlock : r.block_name === hubOrBlock));
    if (ppmFilter !== "All") result = result.filter((r) => classifyPpm(r.ppm || 0, r.samplingPoint || "").status === ppmFilter);
    result = result.filter((r) => isWithinDateRange(r.timestamp, fromDate, toDate));
    return result;
  };

  const rwalRows = useMemo(
    () => filterRows(rwalSourceRows, rwalHub, rwalPpmFilter, rwalFromDate, rwalToDate, true),
    [rwalSourceRows, rwalHub, rwalPpmFilter, rwalFromDate, rwalToDate]
  );

  // Server already filtered the rows!
  const hudFilteredRows = allHudRows;

  const getChartData = (filteredRows) => {
    const counts = { Adequate: 0, Inadequate: 0, Nil: 0 };
    (filteredRows || []).forEach((r) => {
      const { status } = classifyPpm(r.ppm || 0, r.samplingPoint || "");
      counts[status] += 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const rwalChartData = useMemo(() => getChartData(rwalRows), [rwalRows]);
  const hudChartData = useMemo(() => {
    if (hudCounts) {
      return [
        { name: "Adequate", value: hudCounts.Adequate || 0 },
        { name: "Inadequate", value: hudCounts.Inadequate || 0 },
        { name: "Nil", value: hudCounts.Nil || 0 },
      ];
    }
    return getChartData(hudFilteredRows);
  }, [hudFilteredRows, hudCounts]);

  const exportRowsWithTimestamp = (exportRowsData, baseName) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const filename = `${baseName}_${dd}_${mm}_${yyyy}_${hh}${min}${ss}.xlsx`;
    exportToExcel(exportRowsData, filename);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={4}>
        {/* RWAL */}
        <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3 }}>
          <Typography variant="h6" fontWeight="bold" mb={2}>
            Chlorination Monitoring-RWAL
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Region</InputLabel>
              <Select value={rwalHub} onChange={(e) => setRwalHub(e.target.value)} label="Hub">
                {hubs.map((hub) => (
                  <MenuItem key={hub} value={hub}>
                    {hub}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>PPM</InputLabel>
              <Select value={rwalPpmFilter} onChange={(e) => setRwalPpmFilter(e.target.value)} label="PPM">
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Adequate">Adequate</MenuItem>
                <MenuItem value="Inadequate">Inadequate</MenuItem>
                <MenuItem value="Nil">Nil</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="From"
              type="date"
              size="small"
              value={rwalFromDate}
              onChange={(e) => setRwalFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={rwalToDate}
              onChange={(e) => setRwalToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box display="flex" justifyContent="flex-end" mb={1}>
            <Tooltip title="Download Excel">
              <IconButton onClick={() => exportRowsWithTimestamp(rwalRows, "RWAL_Chlorination")}>
                <DownloadIcon sx={{ color: "primary.main" }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ height: 300 }}>
            {loadingRwalRows ? (
              <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                <CircularProgress />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rwalChartData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <ReTooltip />
                  <Legend />
                  <Bar dataKey="value" barSize={50}>
                    {rwalChartData.map((entry, index) => (
                      <Cell key={index} fill={CHART_COLOR_MAP[entry.name]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>
          <SummaryCards rows={rwalRows} />
        </Paper>

        {/* HUD */}
        <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3 }}>
          <Typography variant="h6" fontWeight="bold" mb={2}>
            Chlorination Monitoring - HUD
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>HUD</InputLabel>
              <Select value={hudSelected} onChange={(e) => setHudSelected(e.target.value)} label="HUD">
                <MenuItem value="">Select HUD</MenuItem>
                {hudList.map((hud) => (
                  <MenuItem key={hud} value={hud}>
                    {hud}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Block</InputLabel>
              <Select value={hudBlock} onChange={(e) => setHudBlock(e.target.value)} label="Block">
                {filteredBlocks.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>PPM</InputLabel>
              <Select value={hudPpmFilter} onChange={(e) => setHudPpmFilter(e.target.value)} label="PPM">
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Adequate">Adequate</MenuItem>
                <MenuItem value="Inadequate">Inadequate</MenuItem>
                <MenuItem value="Nil">Nil</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="From"
              type="date"
              size="small"
              value={hudFromDate}
              onChange={(e) => setHudFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={hudToDate}
              onChange={(e) => setHudToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box display="flex" justifyContent="flex-end" mb={1}>
            <Tooltip title="Download Excel">
              <IconButton onClick={() => exportRowsWithTimestamp(hudFilteredRows, "HUD_Chlorination")}>
                <DownloadIcon sx={{ color: "primary.main" }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ height: 300 }}>
            {loadingHudRows ? (
              <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                <CircularProgress />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hudChartData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <ReTooltip />
                  <Legend />
                  <Bar dataKey="value" barSize={50}>
                    {hudChartData.map((entry, index) => (
                      <Cell key={index} fill={CHART_COLOR_MAP[entry.name]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>
          <SummaryCards rows={hudFilteredRows} serverCounts={hudCounts} />
        </Paper>
      </Box>
    </Box>
  );
}
