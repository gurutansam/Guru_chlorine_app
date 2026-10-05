import React, { useEffect, useState } from "react";
import {
  Box,
  IconButton,
  Typography,
  Dialog,
  DialogContent,
  DialogTitle,
  Select,
  MenuItem,
  FormControl,
  Button
} from "@mui/material";
import DashboardLayout from "./DashboardLayout";
import { DataGrid } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export default function ChlorinationStateData() {
  const [rows, setRows] = useState([]);
  const [hubFilter, setHubFilter] = useState("");
  const [openMap, setOpenMap] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: 0, lng: 0 });
  const [openImg, setOpenImg] = useState(false);
  const [imgSrcs, setImgSrcs] = useState([]);
  const [imgIndex, setImgIndex] = useState(0);
  const [ppmFilter, setPpmFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/chl_datacollection");
        const result = await res.json();

        if (Array.isArray(result)) {
          const formatted = result.map((item, index) => ({
            id: index + 1,
            ...item,
            hub_name: item.hub_name && item.hub_name.trim() !== ""
              ? item.hub_name
              : "Not Provided",
          }));
          setRows(formatted);
        } else {
          console.error("Invalid data format:", result);
        }
      } catch (err) {
        console.error("Failed to fetch chlorination data:", err);
      }
    };

    fetchData();
  }, []);

  // ✅ Safe date parser for dd/mm/yyyy, hh:mm:ss am/pm
  const parseDate = (timestamp) => {
    if (!timestamp) return new Date("");
    const [datePart, timePart] = timestamp.split(", ");
    if (!datePart || !timePart) return new Date(timestamp); // fallback

    const [day, month, year] = datePart.split("/").map(Number);
    return new Date(`${year}-${month}-${day} ${timePart}`);
  };

  const hubs = [
    ...new Set(
      rows.map((r) =>
        r.hub_name && r.hub_name.trim() !== ""
          ? r.hub_name
          : "Not Provided"
      )
    ),
  ];

  const filteredRows = rows.filter((row) => {
    const rowHub =
      row.hub_name && row.hub_name.trim() !== ""
        ? row.hub_name
        : "Not Provided";

    const matchesHub = !hubFilter || rowHub === hubFilter;

    const ppmValue = parseFloat(row.ppm?.toString().replace(/[^0-9.]/g, ""));
    const sampling = (row.samplingPoint || "").toUpperCase();

    let ppmStatus = "";
    if (ppmValue === 0) {
      ppmStatus = "Nil";
    } else if (
      (sampling === "OHT" && ppmValue >= 1) ||
      ((sampling === "TAIL" || sampling === "MID") && ppmValue >= 0.2)
    ) {
      ppmStatus = "Adequate";
    } else {
      ppmStatus = "Inadequate";
    }
    const matchesPPM = !ppmFilter || ppmStatus === ppmFilter;

    // ✅ Use custom date parser
    const recordDate = parseDate(row.timestamp);
    const matchesFromDate = !fromDate || recordDate >= new Date(fromDate);

    let matchesToDate = true;
    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      matchesToDate = recordDate <= endOfDay;
    }

    return matchesHub && matchesPPM && matchesFromDate && matchesToDate;
  });

  const getColorBySampling = (value, sampling) => {
    if (isNaN(value)) return "transparent";
    if (sampling === "TAIL" || sampling === "MID") {
      if (value === 0) return "red";
      if (value < 0.2) return "orange";
      return "green";
    } else if (sampling === "OHT" || sampling === "GLR" || sampling === "SUMP") {
      if (value === 0) return "red";
      if (value < 1) return "orange";
      return "green";
    }
    return "inherit";
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Chlorination Data");

    worksheet.columns = [
      { header: "S.No", key: "id", width: 10 },
      { header: "Username", key: "username", width: 20 },
      { header: "RWAL Name", key: "hub_name", width: 25 },
      { header: "Observed PPM by the user", key: "actualPPM", width: 20 },
      { header: "Sampling Point", key: "samplingPoint", width: 20 },
      { header: "Measured PPM by the AI", key: "ppm", width: 20 }, // moved after Sampling Point
      { header: "Date", key: "timestamp", width: 25 },
      { header: "Latitude", key: "latitude", width: 15 },
      { header: "Longitude", key: "longitude", width: 15 },
      { header: "Address", key: "address", width: 40 },
    ];

    filteredRows.forEach((row, index) => {
      const rawActualStr = String(row.actualPPM || "");
      const actualSymbolMatch = rawActualStr.match(/[><]/);
      const actualSymbol = actualSymbolMatch ? actualSymbolMatch[0] : "";
      const actualPPMValue = parseFloat(rawActualStr.replace(/[^0-9.]/g, ""));
      const actualPPMDisplay = actualSymbol && !isNaN(actualPPMValue) ? `${actualSymbol}${actualPPMValue}` : (!isNaN(actualPPMValue) ? actualPPMValue : rawActualStr);

      const rawPpmStr = String(row.ppm || "");
      const ppmSymbolMatch = rawPpmStr.match(/[><]/);
      const ppmSymbol = ppmSymbolMatch ? ppmSymbolMatch[0] : "";
      const rawPpmNum = parseFloat(rawPpmStr.replace(/[^0-9.]/g, ""));
      let measuredPPMValue = NaN;
      let measuredPPMDisplay = rawPpmStr;

      if (!isNaN(rawPpmNum)) {
        measuredPPMValue = rawPpmNum > 0 && rawPpmNum < 0.1 ? 0 : Math.round(rawPpmNum * 10) / 10;
        measuredPPMDisplay = ppmSymbol ? `${ppmSymbol}${measuredPPMValue}` : measuredPPMValue;
      }

      const sampling = (row.samplingPoint || "").toUpperCase();

      // Map colors to ARGB hex
      const getArgb = (value, sampling) => {
        const status = getColorBySampling(value, sampling); // green, orange, red
        if (status === "green") return "FF28A745";
        if (status === "orange") return "FFFFA500";
        if (status === "red") return "FFFF0000";
        return "FFFFFFFF"; // default white
      };

      const excelRow = worksheet.addRow({
        id: index + 1,
        username: row.username,
        hub_name: row.hub_name,
        actualPPM: actualPPMDisplay,
        samplingPoint: row.samplingPoint,
        ppm: measuredPPMDisplay, // moved here
        timestamp: row.timestamp,
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address,
      });

      // Apply colors
      excelRow.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: getArgb(actualPPMValue, sampling) } };
      excelRow.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: getArgb(measuredPPMValue, sampling) } };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    // Add date to filename
    const today = new Date();
    const fileDate = `${String(today.getDate()).padStart(2, "0")}_${String(today.getMonth() + 1).padStart(2, "0")}_${today.getFullYear()}`;
    saveAs(blob, `chlorination_data-${fileDate}.xlsx`);
  };


  const columns = [
    { field: "id", headerName: "S.No", width: 80 },
    { field: "username", headerName: "Username", width: 140 },
    {
      field: "hub_name",
      headerName: "RWAL Name",
      width: 140,
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 600 }}>
          {params.value || " "}
        </Typography>
      ),
    },
    {
      field: "actualPPM",
      headerName: "Observed PPM by the user",
      width: 150,
      renderCell: (params) => {
        const rawActualStr = String(params.row.actualPPM || "");
        const actualSymbolMatch = rawActualStr.match(/[><]/);
        const actualSymbol = actualSymbolMatch ? actualSymbolMatch[0] : "";
        const numericActual = parseFloat(rawActualStr.replace(/[^0-9.]/g, ""));
        const actualDisplay = actualSymbol && !isNaN(numericActual) ? `${actualSymbol}${numericActual}` : (!isNaN(numericActual) ? numericActual : rawActualStr);

        const sampling = (params.row.samplingPoint || "").toUpperCase();
        const color = getColorBySampling(numericActual, sampling);
        const textColor = color === "transparent" ? "black" : "white";
        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <Typography
              sx={{
                backgroundColor: color,
                color: textColor,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontWeight: 600,
                fontFamily: "Nunito, sans-serif",
              }}
            >
              {actualDisplay}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "ppm",
      headerName: "Measured PPm by the AI",
      width: 200,
      renderCell: (params) => {
        const rawPpmStr = String(params.row.ppm || "");
        const ppmSymbolMatch = rawPpmStr.match(/[><]/);
        const ppmSymbol = ppmSymbolMatch ? ppmSymbolMatch[0] : "";
        const numericRawPpm = parseFloat(rawPpmStr.replace(/[^0-9.]/g, ""));

        let numericPpm = NaN;
        let ppmDisplay = rawPpmStr;

        if (!isNaN(numericRawPpm)) {
          numericPpm = numericRawPpm > 0 && numericRawPpm < 0.1 ? 0 : Math.round(numericRawPpm * 10) / 10;
          ppmDisplay = ppmSymbol ? `${ppmSymbol}${numericPpm}` : numericPpm;
        }

        const sampling = (params.row.samplingPoint || "").toUpperCase();
        const color = isNaN(numericPpm) ? "transparent" : getColorBySampling(numericPpm, sampling);
        const textColor = color === "transparent" ? "black" : "white";
        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <Typography
              sx={{
                backgroundColor: color,
                color: textColor,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontWeight: 600,
                fontFamily: "Nunito, sans-serif",
              }}
            >
              {ppmDisplay}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "samplingPoint",
      headerName: "Sampling Point",
      width: 180,
      renderCell: (params) => {
        const value = (params.row.samplingPoint || "").toUpperCase();
        let displayValue = value;
        if (value === "OHT") displayValue = "Over head Tank";
        else if (value === "GLR") displayValue = "Ground Level Reservoir";
        else if (value === "SUMP") displayValue = "SUMP";
        else if (value === "TAIL") displayValue = "Tailend";
        else if (value === "MID") displayValue = "Midpoint";
        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <Typography sx={{ fontWeight: 600 }}>{displayValue}</Typography>
          </Box>
        );
      },
    },
    { field: "timestamp", headerName: "Date", width: 250 },
    { field: "latitude", headerName: "Latitude", width: 150 },
    { field: "longitude", headerName: "Longitude", width: 150 },
    {
      field: "address",
      headerName: "Address",
      width: 450,
      renderCell: (params) => {
        const address = params.row.address || "N/A";
        return (
          <Box
            sx={{
              backgroundColor: address === "N/A" ? "#fdd" : "#e6f7ff",
              borderRadius: 1.5,
              px: 1,
              py: 0.5,
              fontSize: "0.8rem",
              color: address === "N/A" ? "#a00" : "#005580",
              fontWeight: 500,
              whiteSpace: "normal",
              wordBreak: "break-word",
              fontFamily: "Nunito, sans-serif",
            }}
          >
            {address}
          </Box>
        );
      },
    },
    {
      field: "map",
      headerName: "Map",
      width: 100,
      renderCell: (params) => {
        const lat = params.row.latitude;
        const lng = params.row.longitude;
        const valid = lat != null && lng != null;
        return valid ? (
          <IconButton
            onClick={() => {
              setMapCoords({ lat, lng });
              setOpenMap(true);
            }}
          >
            <VisibilityIcon />
          </IconButton>
        ) : (
          <Typography variant="body2" color="text.secondary">
            N/A
          </Typography>
        );
      },
    },
    {
      field: "images",
      headerName: "Image",
      width: 100,
      renderCell: (params) => {
        const imagePath = params.row.image_path;
        if (!imagePath || !imagePath.includes("chlorine_image_")) {
          return <Typography variant="body2" color="text.secondary">N/A</Typography>;
        }
        const imageUrl = `http://localhost:3000/${imagePath}`;
        return (
          <IconButton
            onClick={() => {
              setImgSrcs([imageUrl]);
              setImgIndex(0);
              setOpenImg(true);
            }}
          >
            <VisibilityIcon />
          </IconButton>
        );
      },
    },
  ];

  return (
    <DashboardLayout>
      <Box p={2} sx={{ paddingTop: 20, paddingLeft: 10 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>
          DATA SET COLLECTION
        </Typography>

        {/* Filter */}
        <Box display="flex" gap={2} alignItems="center" mb={2}>
          <FormControl sx={{ minWidth: 200 }} size="small">
            <Select
              displayEmpty
              value={hubFilter}
              onChange={(e) => setHubFilter(e.target.value)}
              sx={{ fontFamily: "Nunito, sans-serif" }}
            >
              <MenuItem value="">All RWAL</MenuItem>
              {hubs.map((hub, index) => (
                <MenuItem key={index} value={hub}>
                  {hub}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 200 }} size="small">
            <Select
              displayEmpty
              value={ppmFilter}
              onChange={(e) => setPpmFilter(e.target.value)}
              sx={{ fontFamily: "Nunito, sans-serif" }}
            >
              <MenuItem value="">All PPM Status</MenuItem>
              <MenuItem value="Adequate">Adequate</MenuItem>
              <MenuItem value="Inadequate">Inadequate</MenuItem>
              <MenuItem value="Nil">Nil</MenuItem>
            </Select>
          </FormControl>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              fontFamily: "Nunito, sans-serif",
              fontSize: "0.9rem",
              padding: "6px 10px",
              borderRadius: 4,
              border: "1px solid #ccc",
            }}
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              fontFamily: "Nunito, sans-serif",
              fontSize: "0.9rem",
              padding: "6px 10px",
              borderRadius: 4,
              border: "1px solid #ccc",
            }}
          />

          <Button
            onClick={exportToExcel}
            variant="contained"
            color="success"
            sx={{ fontWeight: 600, fontFamily: "Nunito, sans-serif" }}
          >
            Download Excel
          </Button>
        </Box>

        {/* Data Grid */}
        <Box style={{ height: "auto", minHeight: 600, width: "100%" }}>
          <DataGrid
            rows={filteredRows}
            columns={columns}
            pageSize={20}
            rowsPerPageOptions={[20]}
            sx={{
              fontFamily: "Nunito, sans-serif",
              border: "2px solid #2A2F5B",
              borderRadius: 2,
              boxShadow: 2,
              "& .MuiDataGrid-columnHeaders": {
                color: "black",
                fontWeight: 900,
                fontSize: "1.1rem",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                borderBottom: "3px solid black",
                background: "transparent",
              },
              "& .MuiDataGrid-cell": {
                borderBottom: "1px solid #ddd",
                fontSize: "0.95rem",
              },
              "& .MuiDataGrid-row:hover": {
                backgroundColor: "#f0f4ff",
              },
              "& .MuiDataGrid-footerContainer": {
                backgroundColor: "#f9f9f9",
              },
            }}
          />
        </Box>

        {/* Map Dialog */}
        <Dialog open={openMap} onClose={() => setOpenMap(false)} maxWidth="md">
          <DialogTitle sx={{ fontFamily: "Nunito, sans-serif" }}>
            Location Map
            <IconButton
              aria-label="close"
              onClick={() => setOpenMap(false)}
              sx={{ position: "absolute", right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <iframe
              title="Map"
              width="100%"
              height="400"
              frameBorder="0"
              style={{ border: 0 }}
              src={`https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&z=15&output=embed`}
              allowFullScreen
            ></iframe>
          </DialogContent>
        </Dialog>

        {/* Image Viewer Dialog */}
        <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: "Nunito, sans-serif" }}>
            Image Viewer
            <IconButton
              aria-label="close"
              onClick={() => setOpenImg(false)}
              sx={{ position: "absolute", right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 2, backgroundColor: "#f5f5f5" }}>
            {imgSrcs.length > 0 ? (
              <Box sx={{ backgroundColor: "#fff", borderRadius: 2, boxShadow: 2 }}>
                <Box
                  sx={{
                    width: "100%",
                    height: "45vh",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#000",
                  }}
                >
                  <img
                    src={imgSrcs[imgIndex]}
                    alt={`img-${imgIndex}`}
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                </Box>
              </Box>
            ) : (
              <Typography sx={{ fontFamily: "Nunito, sans-serif" }}>No Image Available</Typography>
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
