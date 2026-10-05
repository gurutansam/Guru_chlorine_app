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
  Menu,
  CircularProgress,
  TextField,
} from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Legend,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from "recharts";
import DownloadIcon from "@mui/icons-material/Download";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// ---- Color Mapping ----
const COLOR_MAP = {
  Adequate: "00AA00", // Green
  Inadequate: "FF9900", // Orange
  Nil: "FF0000", // Red
};

// ---- Utils ----
const parseTimestamp = (timestamp) => {
  if (!timestamp) return null;
  const clean = String(timestamp).trim();
  const re =
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:,\s*|\s+)?(?:(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?\s*(am|pm|AM|PM)?)?$/;
  const m = clean.match(re);
  if (!m) return null;
  const [, dd, mm, yyyy, hhRaw, minRaw, ssRaw, apRaw] = m;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10) - 1;
  const year = parseInt(yyyy, 10);
  let hour = hhRaw ? parseInt(hhRaw, 10) : 0;
  const minute = minRaw ? parseInt(minRaw, 10) : 0;
  const second = ssRaw ? parseInt(ssRaw, 10) : 0;
  if (apRaw) {
    const ap = apRaw.toLowerCase();
    if (ap === "pm" && hour < 12) hour += 12;
    if (ap === "am" && hour === 12) hour = 0;
  }
  return new Date(year, month, day, hour, minute, second);
};

const isWithinDateRange = (timestamp, from, to) => {
  const rowDate = parseTimestamp(timestamp);
  if (!rowDate) return false;
  let fromD = from ? new Date(from) : null;
  let toD = to ? new Date(to) : null;
  if (fromD && toD && fromD > toD) [fromD, toD] = [toD, fromD];
  if (fromD) fromD.setHours(0, 0, 0, 0);
  if (toD) toD.setHours(23, 59, 59, 999);
  if (fromD && toD) return rowDate >= fromD && rowDate <= toD;
  if (fromD) return rowDate >= fromD;
  if (toD) return rowDate <= toD;
  return true;
};

// ---- Unified PPM Classifier ----
const classifyPpm = (ppm, sampling) => {
  const raw = parseFloat(ppm);
  if (isNaN(raw)) return { ppm: 0, status: "Nil" };

  // normalize ppm (round to 1 decimal, treat 0 < ppm < 0.1 as 0)
  const norm = raw > 0 && raw < 0.1 ? 0 : Math.round(raw * 10) / 10;
  const s = (sampling || "").toUpperCase();

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
    // default fallback
    status = norm === 0 ? "Nil" : "Adequate";
  }

  return { ppm: norm, status };
};


const exportToExcel = async (data, filename = "data.xlsx") => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("HUD Data");


  sheet.addRow([
    "Sl. No",
    "Block",
    "Sampling Point",
    "PPM (User)",
    "Measured PPM (AI)",
    "Latitude",
    "Longitude",
    "Address",
    "HUD Name",
    "Timestamp",
  ]);


  data.forEach((row, idx) => {

    const rawUserPpm = row.actualPPM ?? 0;
    const userPpm =
      rawUserPpm > 0 && rawUserPpm < 0.1
        ? 0
        : Math.round(parseFloat(rawUserPpm || 0) * 10) / 10;


    const rawAiPpm = row.ppm ?? 0;
    const aiPpm =
      rawAiPpm > 0 && rawAiPpm < 0.1
        ? 0
        : Math.round(parseFloat(rawAiPpm || 0) * 10) / 10;


    const userClass = classifyPpm(userPpm, row.samplingPoint);
    const aiClass = classifyPpm(aiPpm, row.samplingPoint);

    const excelRow = sheet.addRow([
      idx + 1,
      row.block_name || row.block_id,
      row.samplingPoint,
      userPpm,
      aiPpm,
      row.latitude,
      row.longitude,
      row.address || "",
      row.hud_name,
      row.timestamp,
    ]);


    excelRow.getCell(4).font = { color: { argb: COLOR_MAP[userClass.status] } };
    excelRow.getCell(5).font = { color: { argb: COLOR_MAP[aiClass.status] } };
  });


  sheet.columns.forEach((col) => {
    let maxLength = 15;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const len = cell.value ? cell.value.toString().length : 0;
      if (len > maxLength) maxLength = len;
    });
    col.width = maxLength + 2;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), filename);
};

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
    { label: "Adequate", value: counts.Adequate, color: "#43a047" },
    { label: "Inadequate", value: counts.Inadequate, color: "#fb8c00" },
    { label: "Nil", value: counts.Nil, color: "#e53935" },
    { label: "Total", value: counts.Total, color: "#607d8b" },
  ];

  return (
    <Box
      sx={{
        mt: 3,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 2,
      }}
    >
      {cardData.map((c) => {
        const percentage =
          c.label !== "Total" ? (c.value / (counts.Total || 1)) * 100 : 100;
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
            <Typography
              sx={{
                fontWeight: 700,
                color: c.color,
                mb: 1,
                textTransform: "uppercase",
                fontSize: 14,
              }}
            >
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
export default function DataCollectionChart() {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPPM, setSelectedPPM] = useState("All");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [selectedBlock, setSelectedBlock] = useState("All");
  const [anchorEl, setAnchorEl] = useState(null);
  const downloadMenuOpen = Boolean(anchorEl);

  const [loggedInHudId, setLoggedInHudId] = useState(null);
  const [blockList, setBlockList] = useState([]);

  // Get HUD ID from logged-in user
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (user?.hud_id) setLoggedInHudId(user.hud_id);
  }, []);

  // Fetch HUD data
  useEffect(() => {
    if (!loggedInHudId) return;
    const fetchData = async () => {
      try {
        let chlUrl = "http://localhost:3000/dashboard/chl_hud_datacollection";
        const queryParams = [];
        if (fromDate) {
          const [y, m, d] = fromDate.split("-");
          queryParams.push(`fromDate=${d}/${m}/${y}`);
        }
        if (toDate) {
          const [y, m, d] = toDate.split("-");
          queryParams.push(`toDate=${d}/${m}/${y}`);
        }
        if (queryParams.length > 0) {
          chlUrl += `?${queryParams.join("&")}`;
        }

        const [chlRes, blockRes] = await Promise.all([
          fetch(chlUrl),
          fetch("http://localhost:3000/dashboard/hud-blocks"),
        ]);

        const chlData = await chlRes.json();
        const blockData = await blockRes.json();

        if (Array.isArray(blockData)) {
          const allowedBlocks = blockData.filter((b) => b.hud_id === loggedInHudId);
          setBlockList(allowedBlocks);

          if (Array.isArray(chlData)) {
            const filteredChl = chlData.filter((row) =>
              allowedBlocks.some((b) => b.block_id === row.block_id)
            );
            setRows(filteredChl.map((item, idx) => ({ id: idx + 1, ...item })));
          }
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [loggedInHudId, fromDate, toDate]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    let data = [...rows];

    if (selectedPPM !== "All") {
      data = data.filter((row) => {
        const { status } = classifyPpm(row.ppm, row.samplingPoint);
        return status === selectedPPM;
      });
    }

    if (selectedBlock !== "All") {
      data = data.filter((row) => row.block_id === selectedBlock);
    }

    return data;
  }, [rows, selectedPPM, selectedBlock]);

  // Chart data
  const chartData = useMemo(() => {
    const counts = { Adequate: 0, Inadequate: 0, Nil: 0 };
    filteredRows.forEach((row) => {
      const { status } = classifyPpm(row.ppm, row.samplingPoint);
      counts[status] += 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: name === "Adequate" ? "#43a047" : name === "Inadequate" ? "#fb8c00" : "#e53935",
    }));
  }, [filteredRows]);

  // Download
  const handleDownload = () => {
    setAnchorEl(null);
    if (!filteredRows.length) return alert("No data to download for selected filter.");

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const filename = `HUD_Data_${dd}_${mm}_${yyyy}.xlsx`;

    exportToExcel(filteredRows, filename);
  };

  return (
    <Paper
      sx={{
        width: "100%",
        maxWidth: 1100,
        mx: "auto",
        p: 3,
        mb: 4,
        borderRadius: 3,
        background: "#f9fbfd",
      }}
    >
      {/* Header + Filters */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Chlorination Monitoring - HUD
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            alignItems: "center",
          }}
        >
          {/* Block Filter */}
          <FormControl sx={{ minWidth: 150 }} size="small">
            <InputLabel>Block</InputLabel>
            <Select
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
            >
              <MenuItem value="All">All</MenuItem>
              {blockList.map((b) => (
                <MenuItem key={b.block_id} value={b.block_id}>
                  {b.block_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* PPM Status Filter */}
          <FormControl sx={{ minWidth: 150 }} size="small">
            <InputLabel>PPM Status</InputLabel>
            <Select
              value={selectedPPM}
              onChange={(e) => setSelectedPPM(e.target.value)}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Adequate">Adequate</MenuItem>
              <MenuItem value="Inadequate">Inadequate</MenuItem>
              <MenuItem value="Nil">Nil</MenuItem>
            </Select>
          </FormControl>

          {/* Date Filters */}
          <TextField
            type="date"
            size="small"
            label="From Date"
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: minDate, max: maxDate }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <TextField
            type="date"
            size="small"
            label="To Date"
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: minDate, max: maxDate }}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          {/* Download */}
          <Tooltip title="Download Data">
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
              <DownloadIcon color="primary" />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={downloadMenuOpen}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem onClick={handleDownload}>Download as Excel</MenuItem>
          </Menu>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Chart */}
      <Box
        sx={{
          width: "100%",
          height: 350,
          background: "#f5f7fa",
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        {loading ? (
          <CircularProgress />
        ) : filteredRows.length > 0 ? (
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <ReTooltip />
              <Legend />
              <Bar dataKey="value" barSize={50}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Typography sx={{ fontStyle: "italic" }}>
            No data available for this selection.
          </Typography>
        )}
      </Box>

      {/* Summary Cards */}
      <SummaryCards rows={filteredRows} />
    </Paper>
  );
}
