import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Typography,
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Tooltip,
  Skeleton,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  TextField,
} from "@mui/material";
import TodayIcon from "@mui/icons-material/Today";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import InsightsIcon from "@mui/icons-material/Insights";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import BlockIcon from "@mui/icons-material/Block";
import ApartmentIcon from "@mui/icons-material/Apartment";

const ChlorineSummaryCard = () => {
  const theme = useTheme();

  // State
  const [chlData, setChlData] = useState([]);
  const [hudBlocks, setHudBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalBlocks, setModalBlocks] = useState([]);
  const [modalHudFilter, setModalHudFilter] = useState("");
  const [modalSearch, setModalSearch] = useState("");

  // Today's date
  const today = new Date();
  const formattedToday = today.toLocaleDateString("en-GB"); // dd/mm/yyyy

  // Normalize string
  const normalize = (str) => (str || "").trim().toLowerCase();

  // Open modal
  const openModal = (title, blocks, date = "") => {
    setModalTitle(date ? `${title} (${date})` : title);
    setModalBlocks(blocks);
    setModalHudFilter("");
    setModalSearch("");
    setModalOpen(true);
  };

  // Fetch data
  const fetchData = async () => {
    try {
      const userStr = localStorage.getItem("loggedInUser");
      const userObj = userStr ? JSON.parse(userStr) : null;
      if (!userObj?.username) return;

      const [userRes, blockRes, hudRes, chlRes] = await Promise.all([
        fetch("http://localhost:3000/dashboard/chl-hubusers"),
        fetch("http://localhost:3000/dashboard/hud-blocks"),
        fetch("http://localhost:3000/dashboard/hud"),
        fetch("http://localhost:3000/dashboard/chl_hud_datacollection")
      ]);

      const userData = await userRes.json();
      const blocks = await blockRes.json();
      const huds = await hudRes.json();
      const chlJson = await chlRes.json();

      const loggedUser = userData.find(u => u.username === userObj.username);
      if (!loggedUser) return;

      // Map block_id -> hud & hub
      const blockToHud = {};
      const blockToHub = {};
      blocks.forEach(block => {
        const hud = huds.find(h => h.hud_id === block.hud_id);
        if (hud) {
          blockToHud[block.block_id] = hud.hud_name;
          blockToHub[block.block_id] = hud.hub_id;
        }
      });

      // Filter chlorination data by logged-in user's hub
      const filteredChlData = (chlJson || []).filter(
        item => blockToHub[item.block_id] === loggedUser.hub_id
      );

      // HUD blocks for this hub
      const hubBlocks = blocks
        .filter(b => blockToHub[b.block_id] === loggedUser.hub_id)
        .map(b => ({ ...b, hud_name: blockToHud[b.block_id] }));

      setChlData(filteredChlData);
      setHudBlocks(hubBlocks);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Parse date
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    let d = null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, dPart] = s.substring(0, 10).split("-").map(Number);
      d = new Date(y, m - 1, dPart);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
      const [day, month, year] = s.split(/[\/, ]+/).map(Number);
      d = new Date(year, month - 1, day);
    }
    return d && !isNaN(d.getTime()) ? d : null;
  };

  // Filtered chlorination data
  const filteredChlData = useMemo(
    () => selectedBlock ? chlData.filter(row => row.block_name === selectedBlock) : chlData,
    [chlData, selectedBlock]
  );

  // Count by date
  const getCountByDate = (rows, period = "current") => {
    const now = new Date();
    let start, end;
    if (period === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === "current") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }
    return rows.filter(row => {
      const d = parseDate(row.timestamp || row.date);
      return d && d >= start && d <= end;
    });
  };

  // Active / inactive blocks
  const allChlBlocks = useMemo(
    () => Array.from(new Set(chlData.map(c => normalize(c.block_name)).filter(Boolean))),
    [chlData]
  );
  // All HUD blocks normalized
  const allHudBlocks = useMemo(
    () => Array.from(new Set(hudBlocks.map(b => normalize(b.block_name)).filter(Boolean))),
    [hudBlocks]
  );

  // Map normalized block_name -> actual block_name
  const hudBlockMap = useMemo(() => {
    const map = {};
    hudBlocks.forEach(b => {
      map[normalize(b.block_name)] = b.block_name;
    });
    return map;
  }, [hudBlocks]);

  // Active / inactive blocks for today only
  const todayChlBlocks = useMemo(
    () => Array.from(new Set(getCountByDate(chlData, "today").map(c => normalize(c.block_name)).filter(Boolean))),
    [chlData]
  );

  const activeBlocks = useMemo(
    () => todayChlBlocks.filter(b => allHudBlocks.includes(b)).map(b => hudBlockMap[b]),
    [todayChlBlocks, allHudBlocks, hudBlockMap]
  );

  const inactiveBlocks = useMemo(
    () => allHudBlocks.filter(b => !todayChlBlocks.includes(b)).map(b => hudBlockMap[b]),
    [todayChlBlocks, allHudBlocks, hudBlockMap]
  );

  const formatNumber = (n) => new Intl.NumberFormat().format(n ?? 0);

  const SummaryCard = ({ title, value, icon, tooltip, type, onClick }) => {
    const bgColor = type === "active" ? "#E8F5E9" : type === "inactive" ? "#FFEBEE" : "#F5F5F5";
    const iconBg = type === "active" ? "#66BB6A" : type === "inactive" ? "#EF5350" : "#455A64";

    const content = (
      <Card
        onClick={onClick}
        sx={{
          minHeight: 160,
          borderRadius: 2.5,
          p: 2,
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: bgColor,
          cursor: onClick ? "pointer" : "default"
        }}
      >
        <Avatar variant="rounded" sx={{ width: 44, height: 44, bgcolor: iconBg, color: "#fff" }}>
          {icon}
        </Avatar>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {formatNumber(value)}
          </Typography>
        </Box>
      </Card>
    );

    return tooltip ? <Tooltip title={tooltip}>{content}</Tooltip> : content;
  };

  // HUD names
  const hudNames = useMemo(
    () => Array.from(new Set(hudBlocks.map((h) => h.hud_name).filter(Boolean))),
    [hudBlocks]
  );

  // Modal filtered blocks
  const filteredModalBlocks = useMemo(() => {
    let list = modalBlocks;
    if (modalHudFilter) {
      list = list.filter((block) => {
        const hudOfBlock = hudBlocks.find((h) => normalize(h.block_name) === normalize(block));
        return hudOfBlock?.hud_name === modalHudFilter;
      });
    }
    if (modalSearch.trim()) {
      const q = modalSearch.trim().toLowerCase();
      list = list.filter((b) => b.toLowerCase().includes(q));
    }
    return list;
  }, [modalBlocks, modalHudFilter, modalSearch, hudBlocks]);

  // Excel download
  const handleDownload = async () => {
    const workbook = new window.ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Blocks");
    worksheet.addRow(["Block Name", "HUD Name"]);
    worksheet.getRow(1).font = { bold: true };

    filteredModalBlocks.forEach((block) => {
      const hud = hudBlocks.find((h) => normalize(h.block_name) === normalize(block))?.hud_name;
      worksheet.addRow([block, hud || ""]);
    });

    worksheet.addRow([]);
    worksheet.addRow(["Total Blocks", filteredModalBlocks.length]);
    worksheet.columns.forEach((col) => (col.width = 30));

    const buffer = await workbook.xlsx.writeBuffer();
    window.saveAs(new Blob([buffer]), `${modalTitle.replace(/\s/g, "_")}.xlsx`);
  };

  const summaryItems = [
    { title: "Cumulative Chlorination Data", value: filteredChlData.length, icon: <InsightsIcon />, tooltip: "Total data points collected", type: "neutral" },
    { title: "Last Month Chlorination Tested", value: getCountByDate(filteredChlData, "previous").length, icon: <EventRepeatIcon />, tooltip: "Previous month data", type: "neutral" },
    { title: "Current Month Chlorination Tested", value: getCountByDate(filteredChlData, "current").length, icon: <CalendarMonthIcon />, tooltip: "Current month data", type: "neutral" },
    { title: "Chlorination Tested Today", value: getCountByDate(filteredChlData, "today").length, icon: <TodayIcon />, tooltip: "Today's data", type: "neutral" },
    {
      title: `Active Blocks (${formattedToday})`, // <-- show current date
      value: activeBlocks.length,
      icon: <LocationOnIcon />,
      tooltip: `Active blocks as of ${formattedToday}`,
      type: "active",
      onClick: () => openModal("Active Blocks", activeBlocks, formattedToday)
    },
    {
      title: `Inactive Blocks (${formattedToday})`,
      value: inactiveBlocks.length,
      icon: <BlockIcon />,
      tooltip: "Inactive blocks as of " + formattedToday,
      type: "inactive",
      onClick: () => openModal("Inactive Blocks", inactiveBlocks, formattedToday)
    },
    { title: "Total HUD Blocks", value: allHudBlocks.length, icon: <ApartmentIcon />, tooltip: "All HUD blocks", type: "neutral" },
  ];

  return (
    <Box sx={{ mt: 2, px: 2 }}>
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Block Name</InputLabel>
        <Select value={selectedBlock} label="Block Name" onChange={e => setSelectedBlock(e.target.value)}>
          <MenuItem value=""><em>All Blocks</em></MenuItem>
          {hudBlocks.map(b => (
            <MenuItem key={b.block_name} value={b.block_name}>
              {b.block_name} {b.hud_name ? `- ${b.hud_name}` : ""}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {loading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rounded" height={140} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <>
          <Grid container spacing={2}>
            {summaryItems.map((item, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <SummaryCard {...item} />
              </Grid>
            ))}
          </Grid>

          {/* Modal */}
          <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2.5 } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>{modalTitle}</DialogTitle>
            <Divider />
            <DialogContent dividers sx={{ pt: 2 }}>
              {modalBlocks.length > 0 && (
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  {/* HUD Filter */}
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl size="small" fullWidth sx={{ maxWidth: 280 }}>
                      <InputLabel>Filter by HUD</InputLabel>
                      <Select
                        value={modalHudFilter}
                        label="Filter by HUD"
                        onChange={(e) => setModalHudFilter(e.target.value)}
                        displayEmpty
                      >
                        <MenuItem value="">
                          <em>All HUDs</em>
                        </MenuItem>
                        {hudNames.map((hud) => (
                          <MenuItem key={hud} value={hud}>
                            {hud}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  {/* Search */}
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Search blocks..."
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                    />
                  </Grid>
                </Grid>
              )}

              {filteredModalBlocks.length > 0 ? (
                <Grid container spacing={1.5}>
                  {filteredModalBlocks.map((b, i) => (
                    <Grid item xs={12} sm={6} md={4} key={`${b}-${i}`}>
                      <Card
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          transition: "transform 140ms ease, box-shadow 140ms ease",
                          "&:hover": { transform: "translateY(-2px)", boxShadow: "0 10px 24px rgba(0,0,0,0.08)" },
                        }}
                      >
                        <Avatar
                          sx={{ width: 30, height: 30, bgcolor: theme.palette.primary.light, color: theme.palette.primary.contrastText }}
                        >
                          <LocationOnIcon fontSize="small" />
                        </Avatar>
                        <Typography sx={{ fontWeight: 600 }}>{b}</Typography>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
                  <Typography>No blocks available</Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={handleDownload} variant="contained" color="success">
                Download Excel
              </Button>
              <Button onClick={() => setModalOpen(false)} color="error">
                Close
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Box>
  );
};

export default ChlorineSummaryCard;
