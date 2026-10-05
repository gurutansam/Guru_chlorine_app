import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
} from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import * as XLSX from "xlsx";
import { Download } from "@mui/icons-material";

export default function HudDashboard() {
  const [rows, setRows] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [userBlockId, setUserBlockId] = useState(null);
  const [ppmStatus, setPpmStatus] = useState("all");

  // Get logged-in user's block
  useEffect(() => {
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) {
      try {
        const userObj = JSON.parse(storedUser);
        if (userObj?.block_id) {
          setUserBlockId(userObj.block_id);
        }
      } catch (err) {
        console.error("Error parsing loggedInUser:", err);
      }
    }
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:3000/dashboard/chl_hud_datacollection");
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // NEW: Safe timestamp parser for both old and new formats
  const parseTimestamp = (timestamp) => {
    if (!timestamp || typeof timestamp !== "string") return null;

    const str = timestamp.trim();

    // Case 1: ISO format → "2025-01-12 06:21:21"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
      const date = new Date(str.replace(" ", "T")); // Convert to ISO
      return isNaN(date.getTime()) ? null : date;
    }

    // Case 2: Old format → "12/01/2025, 06:21:21 pm"
    const parts = str.split(/[\s,]+/);
    if (parts.length >= 2) {
      const [datePart, timePart, ampm] = parts;
      const match = datePart.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const [, day, month, year] = match;
        const [hours, minutes, seconds] = timePart.split(":").map(Number);
        let h = hours || 0;
        if (ampm && ampm.toLowerCase() === "pm" && h < 12) h += 12;
        if (ampm && ampm.toLowerCase() === "am" && h === 12) h = 0;
        const date = new Date(year, month - 1, day, h, minutes || 0, seconds || 0);
        return isNaN(date.getTime()) ? null : date;
      }
    }

    return null;
  };

  // Safe date filter
  const isDateInRange = (timestamp) => {
    const date = parseTimestamp(timestamp);
    if (!date) return true; // Include if timestamp is invalid (or change to `false`)

    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      if (date < from) return false;
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (date > to) return false;
    }
    return true;
  };

  // Color logic
  const getColorBySampling = (value, sampling) => {
    const val = parseFloat(value) || 0;
    const sp = (sampling || "").toUpperCase();

    if (sp === "TAIL" || sp === "MID") {
      if (val === 0) return "red";
      if (val < 0.2) return "orange";
      return "green";
    }
    if (sp === "OHT" || sp === "GLR" || sp === "SUMP") {
      if (val === 0) return "red";
      if (val < 1) return "orange";
      return "green";
    }
    return "inherit";
  };

  // Filter data
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Block filter (based on logged-in user)
      if (userBlockId && row.block_id !== userBlockId) return false;

      // Date filter
      if (!isDateInRange(row.timestamp)) return false;

      // PPM value for status
      const rawValue = parseFloat(row.ppm || row.actualPPM || 0);
      const value = rawValue > 0 && rawValue < 0.1 ? 0 : Math.round(rawValue * 10) / 10;
      const color = getColorBySampling(value, row.samplingPoint);

      if (ppmStatus === "adequate" && color !== "green") return false;
      if (ppmStatus === "inadequate" && color !== "orange") return false;
      if (ppmStatus === "nil" && color !== "red") return false;

      return true;
    });
  }, [rows, userBlockId, fromDate, toDate, ppmStatus]);

  // Count stats
  const counts = useMemo(() => {
    let adequate = 0, inadequate = 0, nil = 0;
    filteredRows.forEach((row) => {
      const raw = parseFloat(row.ppm || row.actualPPM || 0);
      const val = raw > 0 && raw < 0.1 ? 0 : Math.round(raw * 10) / 10;
      const color = getColorBySampling(val, row.samplingPoint);
      if (color === "green") adequate++;
      else if (color === "orange") inadequate++;
      else if (color === "red") nil++;
    });
    return { adequate, inadequate, nil, total: adequate + inadequate + nil };
  }, [filteredRows]);

  const chartData = [
    { name: "Adequate", value: counts.adequate, color: "#4caf50" },
    { name: "Inadequate", value: counts.inadequate, color: "#ff9800" },
    { name: "Nil", value: counts.nil, color: "#f44336" },
  ];

  const handleDownloadExcel = () => {
    if (!filteredRows.length) return;

    const exportData = filteredRows.map(row => ({
      Username: row.username,
      "HUD Name": row.hud_name,
      "Block Name": row.block_name,
      Address: row.address,
      "Observed PPM": row.actualPPM,
      "AI PPM": row.ppm,
      "Sampling Point": row.samplingPoint,
      Timestamp: row.timestamp,
      Status: getColorBySampling(parseFloat(row.ppm || row.actualPPM || 0), row.samplingPoint) === "green" ? "Adequate" :
        getColorBySampling(parseFloat(row.ppm || row.actualPPM || 0), row.samplingPoint) === "orange" ? "Inadequate" : "Nil"
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chlorine Data");
    XLSX.writeFile(wb, `Chlorine_Block_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Box p={2} sx={{ paddingTop: 12, paddingLeft: 10 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, color: "#1a3e72" }}>
        Chlorination Monitoring - Block Level
      </Typography>

      <Box display="flex" gap={2} mb={3} alignItems="center" flexWrap="wrap">
        <TextField
          type="date"
          label="From Date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <TextField
          type="date"
          label="To Date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>PPM Status</InputLabel>
          <Select value={ppmStatus} label="PPM Status" onChange={(e) => setPpmStatus(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="adequate">Adequate</MenuItem>
            <MenuItem value="inadequate">Inadequate</MenuItem>
            <MenuItem value="nil">Nil</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="contained"
          color="success"
          startIcon={<Download />}
          onClick={handleDownloadExcel}
          disabled={!filteredRows.length}
        >
          Download Excel
        </Button>
      </Box>

      <Paper sx={{ p: 3, borderRadius: 2, mb: 4, background: "#f8fafc" }}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={5}>
            <CircularProgress />
          </Box>
        ) : counts.total === 0 ? (
          <Typography textAlign="center" color="text.secondary" p={5}>
            No data found for the selected filters.
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 10, bottom: 40 }}
              barCategoryGap="10%"          // ← Classic tight spacing
            >
              <CartesianGrid strokeDasharray="4 4" stroke="#e0e0e0" />
              <XAxis
                dataKey="name"
                tick={{ fontWeight: 600, fontSize: 14 }}
                tickMargin={10}
              />
              <YAxis
                tick={{ fontWeight: 600, fontSize: 14 }}
                domain={[0, 'dataMax + 5']}
              />
              <ReTooltip
                contentStyle={{ borderRadius: 8, fontSize: 14 }}
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />

              {/* ← THIS IS THE CLASSIC LOOK YOU WANT */}
              <Bar
                dataKey="value"
                barSize={56}                 // ← Classic thick bar (50+)
                radius={[10, 10, 0, 0]}      // ← Slightly more rounded top
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Paper>

      {/* Summary Cards */}
      <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={3}>
        {[
          { label: "Adequate", value: counts.adequate, color: "#4caf50" },
          { label: "Inadequate", value: counts.inadequate, color: "#ff9800" },
          { label: "Nil", value: counts.nil, color: "#f44336" },
          { label: "Total Samples", value: counts.total, color: "#1976d2" },
        ].map((item) => {
          const percentage = item.label !== "Total Samples"
            ? Math.round((item.value / (counts.total || 1)) * 100)
            : 100;

          return (
            <Paper key={item.label} sx={{ p: 3, textAlign: "center", position: "relative", overflow: "hidden", borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {item.label}
              </Typography>
              <Typography variant="h4" fontWeight={700} color={item.color}>
                {item.value}
              </Typography>
              {item.label !== "Total Samples" && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "100%",
                    height: 8,
                    background: `linear-gradient(to right, ${item.color} ${percentage}%, transparent ${percentage}%)`,
                  }}
                />
              )}
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}