import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../utils/api.js";
import {
  Card,
  Typography,
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Divider,
  TextField,
  InputAdornment,
  Skeleton,
  IconButton,
} from "@mui/material";

import CalendarMonthIcon    from "@mui/icons-material/CalendarMonth";
import TodayIcon            from "@mui/icons-material/Today";
import EventRepeatIcon      from "@mui/icons-material/EventRepeat";
import InsightsIcon         from "@mui/icons-material/Insights";
import LocationOnIcon       from "@mui/icons-material/LocationOn";
import BlockIcon            from "@mui/icons-material/Block";
import ApartmentIcon        from "@mui/icons-material/Apartment";
import SearchIcon           from "@mui/icons-material/Search";
import NorthEastIcon        from "@mui/icons-material/NorthEast";
import TrendingUpIcon       from "@mui/icons-material/TrendingUp";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WaterDropIcon        from "@mui/icons-material/WaterDrop";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/* ======================================================
   DATE FORMATTER
====================================================== */
const formatFlexibleDate = (input) => {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

/* ======================================================
   SUMMARY CARD — Donezo style
   - Hero (first) card: dark green bg, white text
   - Others: white bg, dark text
   - Arrow icon top-right in circle border
   - Large bold number, subtitle trend at bottom
====================================================== */
const SummaryCard = ({ card, hero = false }) => {
  const isClickable = !!card.onClick;

  /* colour tokens */
  const heroBg      = "linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)";
  const heroText    = "#ffffff";
  const heroSub     = "rgba(255,255,255,0.7)";
  const heroArrowBg = "rgba(255,255,255,0.18)";
  const heroArrowC  = "#ffffff";

  const cardBg      = card.bg || "#ffffff";
  const cardText    = "#1a1a2e";
  const cardSub     = "#6b7280";
  const arrowBg     = card.arrowBg || "#f3f4f6";
  const arrowColor  = card.arrowColor || "#374151";

  return (
    <Card
      onClick={card.onClick}
      elevation={0}
      sx={{
        height: 155,
        p: "20px 22px 16px",
        borderRadius: "16px",
        position: "relative",
        overflow: "hidden",
        background: hero ? heroBg : cardBg,
        border: hero ? "none" : "1px solid #e5e7eb",
        cursor: isClickable ? "pointer" : "default",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: isClickable || hero ? "translateY(-3px)" : "none",
          boxShadow: isClickable || hero
            ? "0 12px 28px rgba(0,0,0,0.14)"
            : "none",
        },
      }}
    >
      {/* ── Top row: title + arrow button ── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: hero ? heroText : cardText,
              lineHeight: 1.3,
              fontSize: "0.82rem",
              maxWidth: 170,
            }}
          >
            {card.titleTop || card.title}
          </Typography>
          {card.titleBottom && (
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                color: hero ? heroText : cardText,
                lineHeight: 1.3,
                fontSize: "0.82rem",
              }}
            >
              {card.titleBottom}
            </Typography>
          )}
        </Box>

        {/* Arrow icon in circle */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: hero ? heroArrowBg : arrowBg,
            border: hero ? "none" : "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {card.icon
            ? React.cloneElement(card.icon, {
                sx: { fontSize: 16, color: hero ? heroArrowC : arrowColor },
              })
            : <NorthEastIcon sx={{ fontSize: 14, color: hero ? heroArrowC : arrowColor }} />}
        </Box>
      </Box>

      {/* ── Large value ── */}
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: "2.15rem",
          lineHeight: 1,
          mt: 1.2,
          color: hero ? heroText : cardText,
          letterSpacing: "-0.5px",
        }}
      >
        {card.value?.toLocaleString() ?? "—"}
      </Typography>

      {/* ── Subtitle / trend ── */}
      {card.subtitle && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1.1 }}>
          {card.trendIcon && React.cloneElement(card.trendIcon, {
            sx: { fontSize: 14, color: hero ? heroSub : (card.trendColor || "#16a34a") },
          })}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: hero ? heroSub : (card.trendColor || "#16a34a"),
              fontSize: "0.73rem",
            }}
          >
            {card.subtitle}
          </Typography>
        </Box>
      )}
    </Card>
  );
};

/* ======================================================
   MAIN COMPONENT
====================================================== */
const ChlorineSummaryCard = () => {
  const [summary, setSummary]     = useState(null);
  const [hudBlocks, setHudBlocks] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const [modalOpen, setModalOpen]         = useState(false);
  const [modalTitle, setModalTitle]       = useState("");
  const [modalBlocks, setModalBlocks]     = useState([]);
  const [modalHudFilter, setModalHudFilter] = useState("");
  const [modalSearch, setModalSearch]     = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [s, h] = await Promise.all([
          apiFetch("/dashboard/chl-summary"),
          apiFetch("/dashboard/hud-blocks"),
        ]);
        if (!s.ok || !h.ok) throw new Error();
        setSummary(await s.json());
        setHudBlocks(await h.json());
      } catch {
        setError("Failed to load summary");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const blockToHud = useMemo(() => {
    const map = {};
    hudBlocks.forEach((b) => (map[b.block_name] = b.hud_name));
    return map;
  }, [hudBlocks]);

  const hudNames = useMemo(
    () => [...new Set(hudBlocks.map((h) => h.hud_name))],
    [hudBlocks]
  );

  const openModal = (title, blocks) => {
    setModalTitle(title);
    setModalBlocks(blocks);
    setModalHudFilter("");
    setModalSearch("");
    setModalOpen(true);
  };

  const filteredModalBlocks = useMemo(() => {
    let list = modalBlocks;
    if (modalHudFilter) list = list.filter((b) => blockToHud[b] === modalHudFilter);
    if (modalSearch)    list = list.filter((b) => b.toLowerCase().includes(modalSearch.toLowerCase()));
    return list;
  }, [modalBlocks, modalHudFilter, modalSearch, blockToHud]);

  const handleDownload = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Blocks");
    ws.addRow(["Block Name", "HUD Name"]).font = { bold: true };
    filteredModalBlocks.forEach((b) => ws.addRow([b, blockToHud[b]]));
    ws.addRow([]);
    ws.addRow(["Total Blocks", filteredModalBlocks.length]);
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `${modalTitle}.xlsx`);
  };

  /* ── Loading skeleton ── */
  if (loading)
    return (
      <Grid container columns={10} spacing={2}>
        {[...Array(10)].map((_, i) => (
          <Grid size={{ xs: 10, sm: 5, md: 2 }} key={i}>
            <Skeleton variant="rounded" height={155} sx={{ borderRadius: "16px" }} />
          </Grid>
        ))}
      </Grid>
    );

  if (error) return <Typography color="error">{error}</Typography>;

  const {
    total, today, currentMonth, previousMonth,
    activeBlocks, inactiveBlocks, totalBlocks,
    todayAdequate, todayInadequate, todayNil,
    firstEntryDate,
  } = summary;

  const todayStr = new Date().toLocaleDateString("en-GB");

  /* ── All Cards Data (Dynamic flow, 5 per row) ── */
  const allCards = [
    {
      titleTop: "Cumulative Chlorination",
      titleBottom: "Samples Tested",
      value: total,
      subtitle: `Since ${formatFlexibleDate(firstEntryDate)}`,
      trendIcon: <TrendingUpIcon />,
      icon: <InsightsIcon />,
      isHero: true,
    },
    {
      titleTop: "Last Month",
      titleBottom: "Samples Tested",
      value: previousMonth,
      subtitle: "Previous month total",
      trendIcon: <CheckCircleOutlineIcon />,
      trendColor: "#6b7280",
      icon: <EventRepeatIcon />,
      bg: "#ffffff",
      arrowBg: "#f0fdf4",
      arrowColor: "#16a34a",
    },
    {
      titleTop: "Current Month",
      titleBottom: "Samples Tested",
      value: currentMonth,
      subtitle: "This month so far",
      trendIcon: <TrendingUpIcon />,
      trendColor: "#16a34a",
      icon: <CalendarMonthIcon />,
      bg: "#ffffff",
      arrowBg: "#f0fdf4",
      arrowColor: "#16a34a",
    },
    {
      titleTop: "Today's",
      titleBottom: "Samples Tested",
      value: today,
      subtitle: todayStr,
      trendIcon: <TodayIcon />,
      trendColor: "#2563eb",
      icon: <TodayIcon />,
      bg: "#ffffff",
      arrowBg: "#eff6ff",
      arrowColor: "#2563eb",
    },
    {
      title: "Total Blocks",
      value: totalBlocks,
      subtitle: "All registered blocks",
      trendIcon: <ApartmentIcon />,
      trendColor: "#6b7280",
      icon: <ApartmentIcon />,
      bg: "#ffffff",
      arrowBg: "#f3f4f6",
      arrowColor: "#374151",
    },
    {
      title: `Active Blocks`,
      value: activeBlocks.length,
      subtitle: `Active today (${todayStr})`,
      trendIcon: <TrendingUpIcon />,
      trendColor: "#16a34a",
      icon: <LocationOnIcon />,
      bg: "#f0fdf4",
      arrowBg: "#dcfce7",
      arrowColor: "#16a34a",
      onClick: () => openModal("Active Blocks", activeBlocks),
    },
    {
      title: `Inactive Blocks`,
      value: inactiveBlocks.length,
      subtitle: `Inactive today (${todayStr})`,
      trendIcon: <BlockIcon />,
      trendColor: "#dc2626",
      icon: <BlockIcon />,
      bg: "#fff5f5",
      arrowBg: "#fee2e2",
      arrowColor: "#dc2626",
      onClick: () => openModal("Inactive Blocks", inactiveBlocks),
    },
    {
      title: `Adequate Today`,
      value: todayAdequate,
      subtitle: todayStr,
      trendIcon: <CheckCircleOutlineIcon />,
      trendColor: "#16a34a",
      icon: <WaterDropIcon />,
      bg: "#f0fdf4",
      arrowBg: "#dcfce7",
      arrowColor: "#16a34a",
    },
    {
      title: `Inadequate Today`,
      value: todayInadequate,
      subtitle: todayStr,
      trendIcon: <WaterDropIcon />,
      trendColor: "#d97706",
      icon: <WaterDropIcon />,
      bg: "#fffbeb",
      arrowBg: "#fef3c7",
      arrowColor: "#d97706",
    },
    {
      title: `Nil Today`,
      value: todayNil,
      subtitle: todayStr,
      trendIcon: <BlockIcon />,
      trendColor: "#dc2626",
      icon: <BlockIcon />,
      bg: "#fff5f5",
      arrowBg: "#fee2e2",
      arrowColor: "#dc2626",
    },
  ];

  return (
    <Box sx={{ px: 2, mt: 1 }}>
      <Grid container columns={10} spacing={2} sx={{ mb: 2 }}>
        {allCards.map((card, i) => (
          <Grid size={{ xs: 10, sm: 5, md: 2 }} key={i}>
            <SummaryCard card={card} hero={card.isHero} />
          </Grid>
        ))}
      </Grid>

      {/* ── Modal ── */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 700 }}>{modalTitle}</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack direction="row" spacing={2} mb={2}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>HUD</InputLabel>
              <Select
                value={modalHudFilter}
                onChange={(e) => setModalHudFilter(e.target.value)}
                label="HUD"
              >
                <MenuItem value="">All</MenuItem>
                {hudNames.map((h) => (
                  <MenuItem key={h} value={h}>{h}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              placeholder="Search block"
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
          </Stack>

          <Grid container spacing={2}>
            {filteredModalBlocks.map((b, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <Card
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.1)" },
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{b}</Typography>
                  <Typography variant="caption" sx={{ color: "#6b7280" }}>
                    HUD: {blockToHud[b]}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: "12px 24px" }}>
          <Button
            variant="contained"
            onClick={handleDownload}
            sx={{ bgcolor: "#1B4332", "&:hover": { bgcolor: "#2D6A4F" }, borderRadius: "8px" }}
          >
            Download Excel
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => setModalOpen(false)}
            sx={{ borderRadius: "8px" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChlorineSummaryCard;
