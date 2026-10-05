import React, { useEffect, useState } from "react";
import {
  Grid,
  Card,
  Typography,
  Box,
  CircularProgress,
  Modal,
  Fade,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";

import BugReportIcon from "@mui/icons-material/BugReport";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import TodayIcon from "@mui/icons-material/Today";
import ListAltIcon from "@mui/icons-material/ListAlt";
import MapIcon from "@mui/icons-material/Map";
import HomeIcon from "@mui/icons-material/Home";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import LocationCityIcon from "@mui/icons-material/LocationCity";

import * as XLSX from "xlsx";

/* ================= CARD CONFIG ================= */
const cardConfig = [
  { key: "total_entries", title: "Total Larvae Positive", color: "#E91E63", icon: <BugReportIcon /> },
  { key: "total_action_taken", title: "Completed Actions", color: "#2196F3", icon: <ListAltIcon /> },
  { key: "pending_actions", title: "Pending Actions", color: "#FF9800", icon: <PendingActionsIcon /> },
];

const extraCards = [
  { key: "workTypeSummary", title: "Work Type Summary", icon: <TodayIcon />, color: "#9C27B0" },
  { key: "blockSummary", title: "Block Summary", icon: <MapIcon />, color: "#3F51B5" },
  { key: "phcSummary", title: "PHC Summary", icon: <LocationCityIcon />, color: "#009688" },
  { key: "villageSummary", title: "Village Summary", icon: <HomeIcon />, color: "#FF5722" },
  { key: "topHi", title: "HI Summary", icon: <AccountTreeIcon />, color: "#673AB7" },
  { key: "sourceBreakdown", title: "Identified Larval Source Entries", icon: <ListAltIcon />, color: "#607D8B" },
];

/* ================= TABLE ================= */
const SimpleTable = ({ columns, rows }) => (
  <Table size="small" stickyHeader>
    <TableHead>
      <TableRow>
        {columns.map((col) => (
          <TableCell
            key={col}
            sx={{
              fontWeight: 800,
              fontSize: 12,
              background: "#F4F2FA",
              textTransform: "uppercase",
            }}
          >
            {col.replace(/_/g, " ")}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>

    <TableBody>
      {rows.map((row, i) => (
        <TableRow
          key={i}
          sx={{
            "&:nth-of-type(odd)": { backgroundColor: "#FAFAFD" },
            "&:hover": { backgroundColor: "#EDE7F6" },
          }}
        >
          {columns.map((col) => (
            <TableCell
              key={col}
              sx={{
                fontWeight: col === "Source" ? 700 : 500,
                color:
                  col === "Pending" && row[col] > 0
                    ? "#D32F2F"
                    : col === "Treated"
                      ? "#2E7D32"
                      : col === "Destroyed"
                        ? "#6A1B9A"
                        : "inherit",
              }}
            >
              {row[col] ?? "-"}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

/* ================= FLATTEN SOURCE ================= */
const flattenSourceBreakdown = (data) => {
  const rows = [];
  Object.entries(data || {}).forEach(([district, d]) => {
    d.BlockPHCDetails.forEach((b) => {
      Object.entries(b.sources || {}).forEach(([source, s]) => {
        rows.push({
          District: district,
          Block: b.block_name,
          PHC: b.phc_name || "Unknown",
          Source: source,
          Total: s.total ?? 0,
          Treated: s.treated ?? 0,
          Destroyed: s.destroyed ?? 0,
          Pending: s.pending ?? 0,
        });
      });
    });
  });
  return rows;
};

/* ================= MAIN ================= */
const LarvaSummaryCards = () => {
  const [cards, setCards] = useState(null);
  const [extra, setExtra] = useState(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ columns: [], rows: [] });
  const [modalTitle, setModalTitle] = useState("");

  useEffect(() => {
    const load = async () => {
      const res = await fetch("http://localhost:3000/dashboard/larva-summary-counts");
      const json = await res.json();
      setCards(json.summary);
      setExtra(json);
      setLoading(false);
    };
    load();
  }, []);

  const openModal = (key) => {
    if (!extra) return;

    let columns = [];
    let rows = [];

    switch (key) {
      case "workTypeSummary":
        columns = ["work_type", "count"];
        rows = extra.workTypeSummary;
        setModalTitle("Work Type Summary");
        break;

      case "blockSummary":
        columns = ["hud_name", "block_name", "count"];
        rows = extra.blockSummary;
        setModalTitle("Block Summary");
        break;

      case "phcSummary":
        columns = ["hud_name", "block_name", "phc_name", "count"];
        rows = extra.phcSummary;
        setModalTitle("PHC Summary");
        break;

      case "villageSummary":
        columns = ["hud_name", "block_name", "phc_name", "hsc_name", "count"];
        rows = extra.villageSummary;
        setModalTitle("Village Summary");
        break;

      case "topHi":
        columns = ["hi_name", "entries"];
        rows = extra.topHi;
        setModalTitle("HI Summary");
        break;

      case "sourceBreakdown":
        columns = ["District", "Block", "PHC", "Source", "Total", "Treated", "Destroyed", "Pending"];
        rows = flattenSourceBreakdown(extra.districtSourceBreakdown);
        setModalTitle("Larval Source Breakdown");
        break;

      default:
        return;
    }

    setModalData({ columns, rows });
    setModalOpen(true);
  };

  const downloadExcel = () => {
    if (!modalData.rows.length) return;
    const ws = XLSX.utils.json_to_sheet(modalData.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, modalTitle);
    XLSX.writeFile(wb, `${modalTitle.replace(/ /g, "_")}.xlsx`);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography fontSize={22} fontWeight={900}>
        Larval Survey Dashboard
      </Typography>
      <Typography fontSize={13} color="text.secondary" mb={3}>
        Real-time surveillance & action monitoring
      </Typography>

      {/* ================= CARDS ================= */}
      <Grid container spacing={3}>
        {[...cardConfig, ...extraCards].map((card) => (
          <Grid item xs={12} sm={6} md={4} key={card.key}>
            <Card
              onClick={() => openModal(card.key)}
              sx={{
                p: 3,
                borderRadius: 5,
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
                background: "linear-gradient(145deg,#ffffff,#F7F5FC)",
                boxShadow: "0 8px 24px rgba(103,58,183,0.12)",
                transition: "all 0.35s ease",
                "&:hover": {
                  transform: "translateY(-8px)",
                  boxShadow: "0 20px 40px rgba(103,58,183,0.25)",
                },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: 6,
                  background: `linear-gradient(180deg, ${card.color}, #00000010)`,
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={1.5}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: "50%",
                    background: `${card.color}22`,
                    color: card.color,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {card.icon}
                </Box>

                <Typography fontWeight={800} fontSize={14} color="text.secondary">
                  {card.title}
                </Typography>
              </Box>

              <Typography
                fontSize={38}
                fontWeight={900}
                mt={2}
                sx={{
                  background: `linear-gradient(135deg, ${card.color}, #512DA8)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {card.key === "sourceBreakdown"
                  ? flattenSourceBreakdown(extra.districtSourceBreakdown).length
                  : cards?.[card.key] ?? extra?.[card.key]?.length ?? 0}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ================= MODAL ================= */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} closeAfterTransition>
        <Fade in={modalOpen}>
          <Box
            sx={{
              width: 920,
              mx: "auto",
              mt: 4,
              borderRadius: 4,
              background: "#fff",
              boxShadow: 24,
            }}
          >
            <Box sx={{ p: 2.5, background: "#673AB7", color: "#fff" }}>
              <Typography fontWeight={900}>{modalTitle}</Typography>
            </Box>

            <Box sx={{ p: 3, maxHeight: 500, overflow: "auto" }}>
              <SimpleTable columns={modalData.columns} rows={modalData.rows} />
            </Box>

            <Box sx={{ p: 2, display: "flex", justifyContent: "space-between" }}>
              <Typography fontSize={13}>Total Records: {modalData.rows.length}</Typography>
              <Box>
                <Button variant="contained" color="success" onClick={downloadExcel}>
                  Export Excel
                </Button>
                <Button sx={{ ml: 1 }} onClick={() => setModalOpen(false)}>
                  Close
                </Button>
              </Box>
            </Box>
          </Box>
        </Fade>
      </Modal>
    </Box>
  );
};

export default LarvaSummaryCards;
