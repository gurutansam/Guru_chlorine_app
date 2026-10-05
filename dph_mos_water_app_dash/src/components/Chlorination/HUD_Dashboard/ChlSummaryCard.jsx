import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Typography,
  Box,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Avatar,
  Divider,
  TextField,
  InputAdornment,
  Skeleton,
} from "@mui/material";

import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import TodayIcon from "@mui/icons-material/Today";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import InsightsIcon from "@mui/icons-material/Insights";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import BlockIcon from "@mui/icons-material/Block";
import ApartmentIcon from "@mui/icons-material/Apartment";
import SearchIcon from "@mui/icons-material/Search";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/* ======================================================
   DATE FORMATTER
====================================================== */
const formatFlexibleDate = (input) => {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/* ======================================================
   SUMMARY CARD
====================================================== */
const SummaryCard = ({ card }) => (
  <Card
    onClick={card.onClick}
    sx={{
      height: 160,
      p: 3,
      borderRadius: 3,
      display: "flex",
      gap: 2,
      alignItems: "center",
      cursor: card.onClick ? "pointer" : "default",
      background: card.bg,
      boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
      transition: "0.25s",
      "&:hover": {
        transform: card.onClick ? "translateY(-4px)" : "none",
        boxShadow: card.onClick
          ? "0 10px 24px rgba(0,0,0,0.22)"
          : "0 6px 16px rgba(0,0,0,0.12)",
      },
    }}
  >
    <Avatar sx={{ bgcolor: card.iconBg, color: "#fff" }}>
      {React.cloneElement(card.icon, { sx: { fontSize: 26 } })}
    </Avatar>

    <Box>
      <Typography sx={{ fontWeight: 800, color: "#212121" }}>
        {card.titleTop}
      </Typography>

      {card.titleBottom && (
        <Typography sx={{ fontWeight: 700, color: "#424242" }}>
          {card.titleBottom}
        </Typography>
      )}

      <Typography variant="h4" sx={{ mt: 0.6, fontWeight: 900 }}>
        {card.value?.toLocaleString()}
      </Typography>

      {card.subtitle && (
        <Typography variant="caption" sx={{ color: "#616161" }}>
          {card.subtitle}
        </Typography>
      )}
    </Box>
  </Card>
);

/* ======================================================
   MAIN COMPONENT
====================================================== */
const ChlSummaryCard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalBlocks, setModalBlocks] = useState([]);
  const [modalSearch, setModalSearch] = useState("");

  /* ================= FETCH SUMMARY ================= */
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));

    if (!user?.hud_id) {
      setError("HUD not mapped to logged in user");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `http://localhost:3000/dashboard/chl-summary/hud?hud_id=${user.hud_id}`
        );
        if (!res.ok) throw new Error();
        setSummary(await res.json());
      } catch {
        setError("Failed to load HUD summary");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openModal = (title, blocks) => {
    setModalTitle(title);
    setModalBlocks(blocks);
    setModalSearch("");
    setModalOpen(true);
  };

  const filteredModalBlocks = useMemo(() => {
    if (!modalSearch) return modalBlocks;
    return modalBlocks.filter((b) =>
      b.toLowerCase().includes(modalSearch.toLowerCase())
    );
  }, [modalBlocks, modalSearch]);

  /* ================= DOWNLOAD ================= */
  const handleDownload = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Blocks");
    ws.addRow(["Block Name"]).font = { bold: true };
    filteredModalBlocks.forEach((b) => ws.addRow([b]));
    ws.addRow([]);
    ws.addRow(["Total Blocks", filteredModalBlocks.length]);
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `${modalTitle}.xlsx`);
  };

  if (loading)
    return (
      <Grid container spacing={2}>
        {[...Array(7)].map((_, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Skeleton height={160} />
          </Grid>
        ))}
      </Grid>
    );

  if (error) return <Typography color="error">{error}</Typography>;

  const {
    total,
    today,
    currentMonth,
    previousMonth,
    activeBlocks,
    inactiveBlocks,
    totalBlocks,
    todayAdequate,
    todayInadequate,
    todayNil,
    firstEntryDate,
  } = summary;

  const todayStr = new Date().toLocaleDateString("en-GB");

  const row1 = [
    {
      titleTop: "Cumulative Chlorination",
      titleBottom: "Samples Tested",
      value: total,
      subtitle: `Since ${formatFlexibleDate(firstEntryDate)}`,
      icon: <InsightsIcon />,
      bg: "#F5F5F5",
      iconBg: "#455A64",
    },
    {
      titleTop: "Last Month",
      titleBottom: "Chlorination Samples Tested",
      value: previousMonth,
      icon: <EventRepeatIcon />,
      bg: "#F5F5F5",
      iconBg: "#455A64",
    },
    {
      titleTop: "Current Month",
      titleBottom: "Chlorination Samples Tested",
      value: currentMonth,
      icon: <CalendarMonthIcon />,
      bg: "#F5F5F5",
      iconBg: "#455A64",
    },
    {
      titleTop: "Chlorination Samples Tested",
      titleBottom: "Tested Today",
      value: today,
      icon: <TodayIcon />,
      bg: "#F5F5F5",
      iconBg: "#455A64",
    },
  ];

  const row2 = [
    {
      titleTop: "Total Blocks",
      value: totalBlocks,
      icon: <ApartmentIcon />,
      bg: "#F5F5F5",
      iconBg: "#455A64",
    },
    {
      titleTop: "Active Blocks",
      titleBottom: todayStr,
      value: activeBlocks.length,
      icon: <LocationOnIcon />,
      bg: "#E8F5E9",
      iconBg: "#66BB6A",
      onClick: () => openModal("Active Blocks", activeBlocks),
    },
    {
      titleTop: "Inactive Blocks",
      titleBottom: todayStr,
      value: inactiveBlocks.length,
      icon: <BlockIcon />,
      bg: "#FFEBEE",
      iconBg: "#EF5350",
      onClick: () => openModal("Inactive Blocks", inactiveBlocks),
    },
  ];

  const row3 = [
    {
      titleTop: "Adequate",
      titleBottom: todayStr,
      value: todayAdequate,
      icon: <InsightsIcon />,
      bg: "#E8F5E9",
      iconBg: "#43A047",
    },
    {
      titleTop: "Inadequate",
      titleBottom: todayStr,
      value: todayInadequate,
      icon: <InsightsIcon />,
      bg: "#FFF3E0",
      iconBg: "#FB8C00",
    },
    {
      titleTop: "Nil",
      titleBottom: todayStr,
      value: todayNil,
      icon: <InsightsIcon />,
      bg: "#FFEBEE",
      iconBg: "#E53935",
    },
  ];

  /* ================= GRID RENDERER ================= */
  const renderRow = (row, key) => {
    const isThree = row.length === 3;

    return (
      <Grid container spacing={3} sx={{ mb: 2 }} justifyContent="flex-start" key={key}>
        {isThree && <Grid item md={1.5} />}

        {row.map((card, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <SummaryCard card={card} />
          </Grid>
        ))}

        {isThree && <Grid item md={1.5} />}
      </Grid>
    );
  };

  return (
    <Box>
      {renderRow(row1, 1)}
      {renderRow(row2, 2)}
      {renderRow(row3, 3)}

      {/* MODAL */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{modalTitle}</DialogTitle>
        <Divider />
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            placeholder="Search block"
            sx={{ mb: 2 }}
            value={modalSearch}
            onChange={(e) => setModalSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Grid container spacing={2}>
            {filteredModalBlocks.map((b, i) => (
              <Grid item xs={12} sm={6} key={i}>
                <Card sx={{ p: 2 }}>
                  <Typography sx={{ fontWeight: 700 }}>{b}</Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button variant="contained" onClick={handleDownload}>
            Download Excel
          </Button>
          <Button color="error" onClick={() => setModalOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChlSummaryCard;
