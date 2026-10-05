import React, { useEffect, useState } from "react";
import {
  Box,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Typography,
  Modal,
  Button,
  TextField,
  Stack,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { saveAs } from "file-saver";
import CloseIcon from "@mui/icons-material/Close";
import ExcelJS from "exceljs";

/* -----------------------------------------------------
   ✅ IST-SAFE DATE PARSER (FIX)
----------------------------------------------------- */
const parseDate = (timestamp) => {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
};

/* -----------------------------------------------------
   ✅ Fuzzy string matching (UNCHANGED)
----------------------------------------------------- */
function levenshteinDistance(a = "", b = "") {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
    Array(a.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i - 1] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return ((maxLen - distance) / maxLen) * 100;
}

export default function HudHiTable() {
  const [hiMaster, setHiMaster] = useState([]);
  const [hiMonitoring, setHiMonitoring] = useState([]);
  const [hudSummary, setHudSummary] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [modalTitle, setModalTitle] = useState("");
  const [districtUser, setDistrictUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const today = parseDate(new Date());
  const [dateFilter, setDateFilter] = useState({ from: today, to: today });

  /* -----------------------------------
     ✅ Fetch logged-in district officer
  ----------------------------------- */
  useEffect(() => {
    fetch("http://localhost:3000/dashboard/district-officers")
      .then((res) => res.json())
      .then((users) => {
        const loggedInUsername = localStorage.getItem("loggedInUsername");
        const matched = users.find(
          (u) =>
            u.username?.toLowerCase() === loggedInUsername?.toLowerCase()
        );
        if (!matched) {
          alert("User not authorized");
          return;
        }
        setDistrictUser(matched);
      });
  }, []);

  /* -----------------------------------
     ✅ Fetch HI master & monitoring
  ----------------------------------- */
  useEffect(() => {
    Promise.all([
      fetch("http://localhost:3000/dashboard/village-user").then((r) => r.json()),
      fetch("http://localhost:3000/dashboard/hi-monitoring").then((r) => r.json()),
    ]).then(([hiMasterData, hiMonitoringData]) => {
      setHiMaster(hiMasterData);
      setHiMonitoring(hiMonitoringData);
    });
  }, []);

  /* -----------------------------------
     ✅ HUD SUMMARY (FUZZY LOGIC KEPT)
  ----------------------------------- */
  useEffect(() => {
    if (!districtUser || !hiMaster.length || !hiMonitoring.length) return;

    const districtName = (districtUser.district_name || "").toLowerCase();

    // ❗ FUZZY DISTRICT ↔ HUD MATCH (UNCHANGED)
    const filteredHiMaster = hiMaster.filter((hi) => {
      const hudName = (hi.hud_name || "").toLowerCase();
      return similarity(districtName, hudName) >= 85;
    });

    const summary = {};

    filteredHiMaster.forEach((hi) => {
      if (!summary[hi.hud_id]) {
        summary[hi.hud_id] = {
          hudName: hi.hud_name,
          hiList: [],
          totalHI: 0,
          activeUserIds: new Set(),
          activeHI: 0,
          inactiveHI: 0,
        };
      }
      summary[hi.hud_id].hiList.push(hi);
      summary[hi.hud_id].totalHI++;
    });

    const { from, to } = dateFilter;

    // ✅ FIX: Active = UNIQUE PEOPLE (IST SAFE)
    hiMonitoring.forEach((rec) => {
      const recDate = parseDate(rec.timestamp);
      if (recDate < from || recDate > to) return;

      const hi = filteredHiMaster.find(
        (h) => h.user_id === rec.user_id
      );
      if (hi && summary[hi.hud_id]) {
        summary[hi.hud_id].activeUserIds.add(rec.user_id);
      }
    });

    Object.values(summary).forEach((hud) => {
      hud.activeHI = hud.activeUserIds.size;
      hud.inactiveHI = hud.totalHI - hud.activeHI;
    });

    setHudSummary(Object.values(summary));
    setLoading(false);
  }, [hiMaster, hiMonitoring, dateFilter, districtUser]);

  /* -----------------------------------
     ✅ MODAL (NO DOUBLE FILTERING)
  ----------------------------------- */
  const handleOpenModal = (hud, type) => {
    const activeIds = hud.activeUserIds || new Set();

    const list =
      type === "Active"
        ? hud.hiList.filter((hi) => activeIds.has(hi.user_id))
        : hud.hiList.filter((hi) => !activeIds.has(hi.user_id));

    setModalTitle(`${type} HIs - ${hud.hudName}`);
    setModalData(list);
    setModalOpen(true);
  };

  /* -----------------------------------
     ✅ Excel download
  ----------------------------------- */
  const handleDownloadExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("HI Data");

    ws.columns = [
      { header: "Username", key: "username", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone_number", width: 15 },
      { header: "HUD Name", key: "hud_name", width: 20 },
      { header: "Block Name", key: "block_name", width: 20 },
    ];

    modalData.forEach((hi) => ws.addRow(hi));
    ws.addRow([]);
    ws.addRow({ username: "Total Count", email: modalData.length });
    ws.lastRow.font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `hi_data_${modalTitle}_${today}.xlsx`);
  };

  /* -----------------------------------
     ✅ UI
  ----------------------------------- */
  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box p={3} pl={1} pt={1}>
      <Typography variant="h5" mb={3} fontWeight="bold">
        HUD HI Summary ({today})
      </Typography>

      <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><b>HUD Name</b></TableCell>
              <TableCell><b>Total HI</b></TableCell>
              <TableCell><b>Active HI</b></TableCell>
              <TableCell><b>Inactive HI</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {hudSummary.map((hud) => (
              <TableRow key={hud.hudName}>
                <TableCell>{hud.hudName}</TableCell>
                <TableCell>{hud.totalHI}</TableCell>
                <TableCell>
                  <Button
                    color="success"
                    variant="contained"
                    size="small"
                    onClick={() => handleOpenModal(hud, "Active")}
                  >
                    {hud.activeHI}
                  </Button>
                </TableCell>
                <TableCell>
                  <Button
                    color="error"
                    variant="contained"
                    size="small"
                    onClick={() => handleOpenModal(hud, "Inactive")}
                  >
                    {hud.inactiveHI}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* MODAL */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80%",
            bgcolor: "background.paper",
            p: 4,
            maxHeight: "80vh",
            overflowY: "auto",
            borderRadius: 2,
          }}
        >
          <IconButton
            onClick={() => setModalOpen(false)}
            sx={{ position: "absolute", top: 8, right: 8 }}
          >
            <CloseIcon />
          </IconButton>

          <Typography variant="h6" mb={3} fontWeight="bold">
            {modalTitle}
          </Typography>

          <Stack direction="row" spacing={2} mb={3}>
            <TextField
              type="date"
              label="From"
              value={dateFilter.from}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, from: e.target.value })
              }
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="date"
              label="To"
              value={dateFilter.to}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, to: e.target.value })
              }
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="outlined" onClick={handleDownloadExcel}>
              Download Excel
            </Button>
          </Stack>

          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>S.No</TableCell>
                  <TableCell>Username</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Block Name</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modalData.map((hi, idx) => (
                  <TableRow key={hi.user_id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{hi.username}</TableCell>
                    <TableCell>{hi.email}</TableCell>
                    <TableCell>{hi.phone_number}</TableCell>
                    <TableCell>{hi.block_name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Modal>
    </Box>
  );
}
