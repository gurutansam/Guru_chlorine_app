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
  Button,
  TextField,
} from "@mui/material";
import DashboardLayout from "./DashboardLayout";
import { DataGrid } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { CircularProgress } from "@mui/material";
import { apiFetch } from "../../../utils/api.js";

export default function ChlHudStateData() {
  const [rows, setRows] = useState([]);
  const [hudList, setHudList] = useState([]);
  const [blockList, setBlockList] = useState([]);
  const [selectedHud, setSelectedHud] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [refreshKey, setRefreshKey] = useState(0);

  const [hasNewData, setHasNewData] = useState(false);

  const [lastLatestId, setLastLatestId] = useState(null);

  const [openMap, setOpenMap] = useState(false);
  const [mapCoords, setMapCoords] = useState({ lat: 0, lng: 0 });
  const [openImg, setOpenImg] = useState(false);
  const [imgSrcs, setImgSrcs] = useState([]);
  const [imgIndex, setImgIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [rowCount, setRowCount] = useState(0);
  const [infoMessage, setInfoMessage] = useState("");


  // Fetch HUDs, Blocks, and Chlorine data
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);

        const today = new Date().toISOString().split("T")[0];

        const [hudRes, blockRes] = await Promise.all([
          apiFetch("/dashboard/hud"),
          apiFetch("/dashboard/hud-blocks"),
        ]);

        const [hudData, blockData] = await Promise.all([
          hudRes.json(),
          blockRes.json(),
        ]);

        setHudList(hudData);
        setBlockList(blockData);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [page, pageSize]);

  useEffect(() => {
    const fetchFiltered = async () => {
      try {
        setLoading(true);

        let url = `/dashboard/chl_hud_datacollection_paginated?page=${page + 1}&limit=${pageSize}`;

        // 🔥 DATE HANDLING + MESSAGE LOGIC
        if (fromDate && toDate) {
          url += `&fromDate=${fromDate}&toDate=${toDate}`;
          setInfoMessage(""); // ✅ clear message
        }
        else if (fromDate && !toDate) {
          url += `&fromDate=${fromDate}&toDate=${fromDate}`;
          setInfoMessage("Showing selected date. You can also choose a To Date for a range.");
        }
        else if (!fromDate && toDate) {
          url += `&fromDate=${toDate}&toDate=${toDate}`;
          setInfoMessage("Showing selected date. You can also choose a From Date.");
        }
        else {
          // ✅ DEFAULT → TODAY
          const today = new Date().toISOString().split("T")[0];
          url += `&fromDate=${today}&toDate=${today}`;
          setInfoMessage("Showing today's records. Select From and To date to view previous data.");
        }

        if (selectedHud) {
          url += `&hud_id=${selectedHud}`;
        }
        // 🔹 block filter
        if (selectedBlock) {
          url += `&block_id=${selectedBlock}`;
        }

        const res = await apiFetch(url);
        const result = await res.json();


        const data = result.data || [];

        setRows(data.map((item, index) => ({
          id: item.id,
          ...item
        })));

        setRowCount(result.total || 0);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchFiltered();
  }, [fromDate, toDate, selectedBlock, selectedHud, page, pageSize, refreshKey]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const today = new Date().toISOString().split("T")[0];

        let url = `/dashboard/chl_hud_datacollection_paginated?page=1&limit=1&fromDate=${today}&toDate=${today}`;

        if (selectedHud) {
          url += `&hud_id=${selectedHud}`;
        }
        if (selectedBlock) {
          url += `&block_id=${selectedBlock}`;
        }

        const res = await apiFetch(url);
        const result = await res.json();

        const latestRow = result.data?.[0];
        if (!latestRow) return;

        const latestId = latestRow.id;

        // ✅ FIRST LOAD
        if (lastLatestId === null) {
          setLastLatestId(latestId);
          return;
        }

        // ✅ DETECT NEW DATA
        if (latestId !== lastLatestId) {
          setHasNewData(true);
          setLastLatestId(latestId);
        }

      } catch (err) {
        console.error(err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedHud, selectedBlock, lastLatestId]);


  useEffect(() => {
    setLastLatestId(null);
  }, [fromDate, toDate, selectedHud, selectedBlock]);

  // const filteredRows = rows.filter((row) => {
  //   if (selectedHud) {
  //     const hudBlocks = blockList
  //       .filter((b) => b.hud_id === selectedHud)
  //       .map((b) => b.block_id);

  //     if (!hudBlocks.includes(row.block_id)) return false;
  //   }

  //   if (selectedBlock && row.block_id !== selectedBlock) return false;

  //   return true;
  // });
  // Dependent block dropdown based on selected HUD
  const filteredBlocks = selectedHud
    ? blockList.filter((b) => b.hud_id === selectedHud)
    : blockList;
  const getColorBySampling = (value, sampling) => {
    if (sampling === "TAIL" || sampling === "MID") {
      if (value === 0) return "red";
      if (value < 0.2) return "orange";
      return "green";
    } else if (sampling === "OHT" || sampling === "GLR" || sampling === "SUMP") { // <-- add GLR here
      if (value === 0) return "red";
      if (value < 1) return "orange";
      return "green";
    }
    return "inherit";
  };

  const EXCEL_COLOR_MAP = {
    Adequate: "FF43A047",
    Inadequate: "FFFB8C00",
    Nil: "FFE53935",
  };

  const classifyPpm = (ppm, sampling) => {
    const ppmStr = String(ppm || "");
    const symbolMatch = ppmStr.match(/[><]/);
    const symbol = symbolMatch ? symbolMatch[0] : "";
    const raw = parseFloat(ppmStr.replace(/[^0-9.]/g, ""));
    if (isNaN(raw)) return { ppm: 0, status: "Nil" };
    const norm = raw > 0 && raw < 0.1 ? 0 : Math.round(raw * 10) / 10;
    const finalPpm = symbol ? `${symbol}${norm}` : norm;
    const s = (sampling || "").toUpperCase();

    if (["TAIL", "MID"].includes(s)) {
      if (norm === 0) return { ppm: 0, status: "Nil" };
      if (norm < 0.2) return { ppm: finalPpm, status: "Inadequate" };
      return { ppm: finalPpm, status: "Adequate" };
    } else if (["OHT", "GLR", "SUMP"].includes(s)) {
      if (norm === 0) return { ppm: 0, status: "Nil" };
      if (norm < 1) return { ppm: finalPpm, status: "Inadequate" };
      return { ppm: finalPpm, status: "Adequate" };
    }

    return { ppm: finalPpm, status: "Nil" };
  };

  const handleDownloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Chlorine Data");

    worksheet.columns = [
      { header: "S.No", key: "id", width: 10 },
      { header: "Username", key: "username", width: 20 },
      { header: "HUD Name", key: "hud_name", width: 20 },
      { header: "Block Name", key: "block_name", width: 20 },
      { header: "Observed PPM", key: "actualPPM", width: 20 },
      { header: "Sampling Point", key: "samplingPoint", width: 20 },
      { header: "Measured PPM", key: "ppm", width: 15 },
      { header: "Address", key: "address", width: 30 },
      { header: "Timestamp", key: "timestamp", width: 25 },
    ];

    try {
      let url = `http://localhost:3000/dashboard/chl_hud_datacollection_paginated?limit=100000`;

      if (fromDate && toDate) {
        url += `&fromDate=${fromDate}&toDate=${toDate}`;
      }

      if (selectedHud) {
        url += `&hud_id=${selectedHud}`;
      }

      if (selectedBlock) {
        url += `&block_id=${selectedBlock}`;
      }

      const res = await fetch(url);
      const result = await res.json();

      const fullData = result.data || [];

      fullData.forEach((row, index) => {
        worksheet.addRow({
          id: index + 1,
          username: row.username,
          hud_name: row.hud_name,
          block_name: row.block_name,
          actualPPM: row.actualPPM,
          samplingPoint: row.samplingPoint,
          ppm: row.ppm,
          address: row.address,
          timestamp: row.timestamp
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, "hud_data.xlsx");

    } catch (err) {
      console.error(err);
    }
  };
  ;



  const columns = [
    { field: "id", headerName: "S.No", width: 80 },
    { field: "username", headerName: "Username", width: 140 },
    { field: "hud_name", headerName: "HUD Name", width: 240 },
    { field: "block_name", headerName: "Block Name", width: 240 },
    { field: "address", headerName: "Address", width: 380 },
    {
      field: "actualPPM",
      headerName: "Observed PPM by the user",
      width: 150,
      renderCell: (params) => {
        const actualStr = String(params.row.actualPPM || "");
        const actualSymbolMatch = actualStr.match(/[><]/);
        const actualSymbol = actualSymbolMatch ? actualSymbolMatch[0] : "";
        const actualNum = parseFloat(actualStr.replace(/[^0-9.]/g, ""));
        const displayActual = actualSymbol && !isNaN(actualNum) ? `${actualSymbol}${actualNum}` : (!isNaN(actualNum) ? actualNum : actualStr);

        const sampling = (params.row.samplingPoint || "").toUpperCase();
        const color = getColorBySampling(actualNum, sampling);
        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <Typography sx={{ backgroundColor: color, color: "white", px: 1, py: 0.5, borderRadius: 1, fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>
              {displayActual}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "ppm",
      headerName: "Measured PPm by the AI",
      width: 170,
      renderCell: (params) => {
        const rawPpmStr = String(params.row.ppm || "");
        const ppmSymbolMatch = rawPpmStr.match(/[><]/);
        const ppmSymbol = ppmSymbolMatch ? ppmSymbolMatch[0] : "";
        const rawPpmNum = parseFloat(rawPpmStr.replace(/[^0-9.]/g, ""));

        let ppmNum = NaN;
        let displayPpm = rawPpmStr;

        if (!isNaN(rawPpmNum)) {
          ppmNum = rawPpmNum > 0 && rawPpmNum < 0.1 ? 0 : Math.round(rawPpmNum * 10) / 10;
          displayPpm = ppmSymbol ? `${ppmSymbol}${ppmNum}` : ppmNum;
        }

        const sampling = (params.row.samplingPoint || "").toUpperCase();
        const color = getColorBySampling(ppmNum, sampling);
        return (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
            <Typography sx={{ backgroundColor: color, color: "white", px: 1, py: 0.5, borderRadius: 1, fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>
              {displayPpm}
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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
            }}
          >
            <Typography sx={{ fontWeight: 600 }}>
              {displayValue}
            </Typography>
          </Box>
        );
      },
    },
    { field: "timestamp", headerName: "Date", width: 200 },
    { field: "latitude", headerName: "Latitude", width: 120 },
    { field: "longitude", headerName: "Longitude", width: 150 },
    {
      field: "map",
      headerName: "Map",
      width: 100,
      renderCell: (params) => {
        const lat = params.row.latitude;
        const lng = params.row.longitude;
        return lat != null && lng != null ? (
          <IconButton onClick={() => { setMapCoords({ lat, lng }); setOpenMap(true); }}>
            <VisibilityIcon />
          </IconButton>
        ) : (
          <Typography variant="body2" color="text.secondary">N/A</Typography>
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
        const imageUrl = `http://localhost:3000${imagePath}`;
        return (
          <IconButton onClick={() => { setImgSrcs([imageUrl]); setImgIndex(0); setOpenImg(true); }}>
            <VisibilityIcon />
          </IconButton>
        );
      },
    },
  ];
  if (loading) {
    return (
      <DashboardLayout>
        <Box
          sx={{
            height: "80vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <CircularProgress size={60} />
          <Typography sx={{ fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
            Loading Chlorine Data, please wait...
          </Typography>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>

      <Box >
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>DATA SET</Typography>

        {/* Filters + Download */}
        <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
          <FormControl sx={{ minWidth: 200 }} size="small">
            <Select
              displayEmpty
              value={selectedHud}
              onChange={(e) => { setSelectedHud(e.target.value); setSelectedBlock(""); }}
              sx={{ fontFamily: "Nunito, sans-serif" }}
            >
              <MenuItem value="">All HUD</MenuItem>
              {hudList.map((hud) => (<MenuItem key={hud.hud_id} value={hud.hud_id}>{hud.hud_name}</MenuItem>))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 200 }} size="small">
            <Select
              displayEmpty
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
              sx={{ fontFamily: "Nunito, sans-serif" }}
            >
              <MenuItem value="">All Blocks</MenuItem>
              {filteredBlocks.map((block) => (
                <MenuItem key={block.block_id} value={block.block_id}>{block.block_name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="From Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            sx={{ minWidth: 140 }}
          />
          <TextField
            label="To Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            sx={{ minWidth: 140 }}
          />

          <Button
            onClick={handleDownloadExcel}
            variant="contained"
            color="success"
            startIcon={<DownloadForOfflineIcon />}
            sx={{ fontFamily: "Nunito, sans-serif", textTransform: "none" }}
          >
            Download as Excel
          </Button>
        </Box>

        <Box style={{ height: "auto", minHeight: 600, width: "100%" }}>


          {/* Existing message */}
          {infoMessage && (
            <Typography
              sx={{
                mb: 2,
                color: "orange",
                fontWeight: 600,
                fontFamily: "Nunito, sans-serif"
              }}
            >
              {infoMessage}
            </Typography>
          )}

          {/* 🔥 ADD HERE */}
          {hasNewData && (
            <Box sx={{ mb: 2 }}>
              <Typography
                sx={{
                  color: "green",
                  fontWeight: 600,
                  fontFamily: "Nunito, sans-serif"
                }}
              >
                New data available
              </Typography>
              <Button
                size="small"
                variant="contained"
                sx={{ mt: 1, textTransform: "none" }}
                onClick={() => {
                  setPage(0); // GO TO FIRST PAGE
                  setRefreshKey(prev => prev + 1);
                  setHasNewData(false);
                }}
              >
                Refresh
              </Button>
            </Box>
          )}
          <DataGrid
            rows={rows}
            columns={columns}
            pagination
            paginationMode="server"
            rowCount={rowCount}
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            // loading={loading} 
            pageSizeOptions={[20, 50, 100]}
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
                background: "transparent"
              },
              "& .MuiDataGrid-cell": {
                borderBottom: "1px solid #ddd",
                fontSize: "0.95rem"
              },
              "& .MuiDataGrid-row:hover": {
                backgroundColor: "#f0f4ff"
              },
              "& .MuiDataGrid-footerContainer": {
                backgroundColor: "#f9f9f9"
              }
            }}
          />
        </Box>

        {/* Map Dialog */}
        <Dialog open={openMap} onClose={() => setOpenMap(false)} maxWidth="md">
          <DialogTitle sx={{ fontFamily: "Nunito, sans-serif" }}>
            Location Map
            <IconButton aria-label="close" onClick={() => setOpenMap(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
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
            />
          </DialogContent>
        </Dialog>

        {/* Image Dialog */}
        <Dialog open={openImg} onClose={() => setOpenImg(false)} maxWidth="md">
          <DialogTitle sx={{ fontFamily: "Nunito, sans-serif" }}>
            Image Viewer
            <IconButton aria-label="close" onClick={() => setOpenImg(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ display: "flex", justifyContent: "center" }}>
            <img src={imgSrcs[imgIndex]} alt="Chlorine Sample" style={{ maxHeight: 500, maxWidth: "100%", borderRadius: 4 }} />
          </DialogContent>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
