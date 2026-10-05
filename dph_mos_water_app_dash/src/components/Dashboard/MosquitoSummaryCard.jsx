import React, { useEffect, useState } from "react";
import {
  Card,
  Typography,
  Box,
  CircularProgress,
  Grid,
  Modal,
  Button,
  Paper,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from "@mui/material";

import {
  Today,
  FormatListNumbered,
  CalendarMonth,
  History,
  CheckCircle,
  Cancel,
  Apartment,
  Domain,
  LocalHospital,
  Cottage,
  Close,
  Download,
} from "@mui/icons-material";

import * as XLSX from "xlsx";

// ---------------- Modal Style ---------------- //
const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: { xs: "95%", sm: "90%", md: "80%", lg: "70%" },
  maxWidth: 1200,
  bgcolor: "background.paper",
  borderRadius: 3,
  boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
  p: { xs: 3, sm: 4 },
  maxHeight: "90vh",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

// ------------------------------------------------ //

const MosquitoSummaryCard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [hudList, setHudList] = useState([]);
  const [blockList, setBlockList] = useState([]);
  const [phcList, setPhcList] = useState([]);
  const [villageList, setVillageList] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalType, setModalType] = useState("");

  const [filterHudId, setFilterHudId] = useState("");
  const [filterBlockId, setFilterBlockId] = useState("");

  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Fetch summary + master data
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [sum, hudBlocks, phc, village] = await Promise.all([
          fetch("http://localhost:3000/dashboard/hi-monitoring-summary").then(r => r.json()),
          fetch("http://localhost:3000/dashboard/hud-blocks").then(r => r.json()),
          fetch("http://localhost:3000/dashboard/phc").then(r => r.json()),
          fetch("http://localhost:3000/dashboard/village").then(r => r.json()),
        ]);

        setSummary(sum);
        setBlockList(hudBlocks);
        setPhcList(phc);
        setVillageList(village);

        // Extract unique HUD list
        const hudMap = {};
        hudBlocks.forEach(b => { hudMap[b.hud_id] = b.hud_name; });
        setHudList(Object.entries(hudMap).map(([id, name]) => ({ hud_id: id, hud_name: name })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const openModal = (type, title) => {
    setModalType(type);
    setModalTitle(title);
    setFilterHudId("");
    setFilterBlockId("");
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const getBlocksForHud = () => {
    if (!filterHudId) return blockList;
    return blockList.filter(b => b.hud_id === filterHudId);
  };

  // ---------------------- FILTER LOGIC ---------------------- //
  const getFilteredRows = () => {
    let data = [];

    switch (modalType) {
      case "hud":
        if (!filterHudId) {
          data = hudList.map(h => ({
            "HUD Name": h.hud_name,
            Blocks: blockList.filter(b => b.hud_id === h.hud_id).length,
            PHCs: phcList.filter(p => p.hud_id === h.hud_id).length,
            Villages: villageList.filter(v => v.hud_id === h.hud_id).length,
          }));
        } else {
          const hud = hudList.find(h => h.hud_id === filterHudId);
          if (hud) {
            data = [{
              "HUD Name": hud.hud_name,
              Blocks: blockList.filter(b => b.hud_id === hud.hud_id).length,
              PHCs: phcList.filter(p => p.hud_id === hud.hud_id).length,
              Villages: villageList.filter(v => v.hud_id === hud.hud_id).length,
            }];
          }
        }
        break;

      case "block":
        let blocks = getBlocksForHud();
        if (filterBlockId) blocks = blocks.filter(b => b.block_id === filterBlockId);
        data = blocks.map(b => ({
          "Block Name": b.block_name,
          "HUD": b.hud_name,
          "Villages": villageList.filter(v => v.block_id === b.block_id).length,
        }));
        break;

      case "phc":
        let filteredPhc = phcList;
        if (filterHudId) filteredPhc = filteredPhc.filter(p => p.hud_id === filterHudId);
        if (filterBlockId) filteredPhc = filteredPhc.filter(p => p.block_id === filterBlockId);
        data = filteredPhc.map(p => ({
          "PHC Name": p.phc_name,
          "HUD": p.hud_name,
          "Block": p.block_name,
          "Villages": villageList.filter(v => v.phc_id === p.phc_id).length,
        }));
        break;

      case "hsc":
        let filteredVillages = villageList;
        if (filterHudId) filteredVillages = filteredVillages.filter(v => v.hud_id === filterHudId);
        if (filterBlockId) filteredVillages = filteredVillages.filter(v => v.block_id === filterBlockId);
        data = filteredVillages.map(v => ({
          "Village / HSC": v.village_name,
          "Block": v.block_name,
          "HUD": v.hud_name,
        }));
        break;

      // ---------------- NEW MODALS ---------------- //
      case "active_hud":
        data = summary?.active_huds?.map(h => ({ "HUD Name": h })) || [];
        break;

      case "inactive_hud":
        data = summary?.inactive_huds?.map(h => ({ "HUD Name": h })) || [];
        break;

      case "active_phc":
        data = summary?.active_phcs?.map(p => ({ "PHC Name": p })) || [];
        break;

      case "inactive_phc":
        data = summary?.inactive_phcs?.map(p => ({ "PHC Name": p })) || [];
        break;

      case "active":
      case "inactive":
        const targetBlocks = modalType === "active" ? summary?.active_blocks : summary?.inactive_blocks;
        let resultBlocks = blockList.filter(b => targetBlocks?.includes(b.block_name));
        if (filterHudId) resultBlocks = resultBlocks.filter(b => b.hud_id === filterHudId);
        data = resultBlocks.map(b => ({
          "HUD": b.hud_name,
          "Block Name": b.block_name,
        }));
        break;

      default:
        data = [];
    }
    return data;
  };

  const filteredRows = getFilteredRows();
  const total = filteredRows.length;

  // ---------------- EXPORTS ---------------- //
  const exportCSV = () => {
    if (total === 0) return;
    const headers = Object.keys(filteredRows[0]);
    const csv = [
      headers.join(","),
      ...filteredRows.map(row =>
        headers.map(h => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${modalTitle.replace(/ /g, "_")}_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (total === 0) return;
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${modalTitle.replace(/ /g, "_")}_${today}.xlsx`);
  };

  // Loading screen
  if (loading || !summary) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={70} thickness={6} />
      </Box>
    );
  }

  // ----------------------- CARDS LIST ----------------------- //
  const summaryItems = [
    { title: "Cummulative DBC Monitoring Data", value: summary.totalCount, icon: <FormatListNumbered sx={{ fontSize: 48, color: "#1565c0" }} /> },
    { title: "Today's DBC Monitoring Data", subtitle: today, value: summary.todayCount, icon: <Today sx={{ fontSize: 48, color: "#2e7d32" }} /> },
    { title: "This Month DBC Monitoring Data", value: summary.thisMonthCount, icon: <CalendarMonth sx={{ fontSize: 48, color: "#f57c00" }} /> },
    { title: "Previous Month DBC Monitoring Data", value: summary.previousMonthCount, icon: <History sx={{ fontSize: 48, color: "#7b1fa2" }} /> },

    { title: "Total HUD Count", value: summary.hud_count, icon: <Apartment sx={{ fontSize: 48, color: "#d32f2f" }} />, onClick: () => openModal("hud", "HUD Wise Summary") },
    { title: "Total Block Count", value: summary.block_count, icon: <Domain sx={{ fontSize: 48, color: "#1565c0" }} />, onClick: () => openModal("block", "Block List") },
    { title: "Total PHC Count", value: summary.phc_count, icon: <LocalHospital sx={{ fontSize: 48, color: "#2e7d32" }} />, onClick: () => openModal("phc", "PHC List") },
    { title: "Total HSC Count", value: summary.hsc_count, icon: <Cottage sx={{ fontSize: 48, color: "#f57c00" }} />, onClick: () => openModal("hsc", "Village / HSC List") },

    { title: "Active HUDs", subtitle: today, value: summary.active_hud_count, icon: <Apartment sx={{ fontSize: 48, color: "#2e7d32" }} />, chip: <Chip label="Active" color="success" size="small" />, onClick: () => openModal("active_hud", "Active HUDs") },
    { title: "Inactive HUDs", subtitle: today, value: summary.inactive_hud_count, icon: <Apartment sx={{ fontSize: 48, color: "#d32f2f" }} />, chip: <Chip label="Inactive" color="error" size="small" />, onClick: () => openModal("inactive_hud", "Inactive HUDs") },

    { title: "Active PHCs", subtitle: today, value: summary.active_phc_count, icon: <LocalHospital sx={{ fontSize: 48, color: "#2e7d32" }} />, chip: <Chip label="Active" color="success" size="small" />, onClick: () => openModal("active_phc", "Active PHCs") },
    { title: "Inactive PHCs", subtitle: today, value: summary.inactive_phc_count, icon: <LocalHospital sx={{ fontSize: 48, color: "#d32f2f" }} />, chip: <Chip label="Inactive" color="error" size="small" />, onClick: () => openModal("inactive_phc", "Inactive PHCs") },

    { title: "Active Blocks", subtitle: today, value: (summary.active_blocks || []).length, icon: <CheckCircle sx={{ fontSize: 48, color: "#2e7d32" }} />, chip: <Chip label="Active" color="success" size="small" />, onClick: () => openModal("active", "Active Blocks") },
    { title: "Inactive Blocks", subtitle: today, value: (summary.inactive_blocks || []).length, icon: <Cancel sx={{ fontSize: 48, color: "#d32f2f" }} />, chip: <Chip label="Inactive" color="error" size="small" />, onClick: () => openModal("inactive", "Inactive Blocks") },

  ];

  const showHudFilter = ["hud", "block", "phc", "hsc", "active", "inactive"].includes(modalType);
  const showBlockFilter = ["block", "phc", "hsc"].includes(modalType) && filterHudId;

  return (
    <Box sx={{ mt: 3, px: { xs: 2, md: 3 } }}>

      {/* ---------------------- IMPROVED CARD UI ---------------------- */}
      <Grid
        container
        spacing={3}
        sx={{
          alignItems: "stretch",
          display: "flex",
        }}
      >
        {summaryItems.map((item, i) => (
          <Grid item xs={12} sm={6} md={4} lg={2.4} xl={2} key={i} sx={{ display: "flex" }}>

            <Card
              elevation={4}
              onClick={item.onClick}
              sx={{
                flex: 1,
                p: 3,
                borderRadius: 4,
                cursor: item.onClick ? "pointer" : "default",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "all 0.25s ease",
                background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
                border: "1px solid #e5e7eb",
                "&:hover": {
                  transform: item.onClick ? "translateY(-6px)" : "none",
                  boxShadow: item.onClick
                    ? "0 12px 25px rgba(0,0,0,0.12)"
                    : "0 4px 10px rgba(0,0,0,0.06)",
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={2}>

                <Box
                  sx={{
                    p: 1.8,
                    borderRadius: 3,
                    background: "#eef2ff",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minWidth: 65,
                    minHeight: 65,
                  }}
                >
                  {item.icon}
                </Box>

                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    {item.title}

                    {item.subtitle && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{ ml: 1, color: "#6b7280" }}
                      >
                        ({item.subtitle})
                      </Typography>
                    )}
                  </Typography>

                  <Box display="flex" alignItems="center" mt={1} gap={1}>
                    <Typography
                      variant="h4"
                      fontWeight="bold"
                      sx={{ color: "#111827" }}
                    >
                      {item.value}
                    </Typography>
                    {item.chip}
                  </Box>
                </Box>
              </Box>

            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ---------------------- MODAL ---------------------- */}
      <Modal open={modalOpen} onClose={closeModal}>
        <Paper sx={modalStyle}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box>
              <Typography variant="h5" fontWeight="bold">{modalTitle}</Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                Total Records: {total}
              </Typography>
            </Box>
            <IconButton onClick={closeModal}>
              <Close />
            </IconButton>
          </Box>

          {/* Filters */}
          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
            {showHudFilter && (
              <FormControl sx={{ minWidth: 240 }}>
                <InputLabel>HUD</InputLabel>
                <Select
                  value={filterHudId}
                  label="HUD"
                  onChange={(e) => {
                    setFilterHudId(e.target.value);
                    setFilterBlockId("");
                  }}
                >
                  <MenuItem value="">
                    <em>All HUDs</em>
                  </MenuItem>
                  {hudList.map(h => (
                    <MenuItem key={h.hud_id} value={h.hud_id}>
                      {h.hud_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {showBlockFilter && (
              <FormControl sx={{ minWidth: 240 }}>
                <InputLabel>Block</InputLabel>
                <Select value={filterBlockId} label="Block" onChange={(e) => setFilterBlockId(e.target.value)}>
                  <MenuItem value="">
                    <em>All Blocks</em>
                  </MenuItem>
                  {getBlocksForHud().map(b => (
                    <MenuItem key={b.block_id} value={b.block_id}>
                      {b.block_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>

          <TableContainer sx={{ flexGrow: 1 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {filteredRows.length > 0 &&
                    Object.keys(filteredRows[0]).map((header, i) => (
                      <TableCell key={i} sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>
                        {header}
                      </TableCell>
                    ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 6, color: "text.secondary" }}>
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row, i) => (
                    <TableRow key={i} hover>
                      {Object.values(row).map((val, j) => (
                        <TableCell key={j}>{val}</TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box mt={3} display="flex" gap={2} justifyContent="flex-end">
            <Button variant="contained" startIcon={<Download />} onClick={exportCSV}>
              Export CSV
            </Button>
            <Button variant="contained" color="success" startIcon={<Download />} onClick={exportExcel}>
              Export Excel
            </Button>
            <Button variant="outlined" onClick={closeModal}>
              Close
            </Button>
          </Box>
        </Paper>
      </Modal>
    </Box>
  );
};

export default MosquitoSummaryCard;
