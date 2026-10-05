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
  TablePagination,
} from "@mui/material";
import { saveAs } from "file-saver";
import CloseIcon from "@mui/icons-material/Close";
import ExcelJS from "exceljs";

/* ================= DATE PARSER ================= */
const parseDate = (timestamp) => {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return isNaN(d) ? "" : d.toISOString().split("T")[0];
};

export default function HudHiTable() {
  const [hiMaster, setHiMaster] = useState([]);
  const [hiMonitoring, setHiMonitoring] = useState([]);
  const [hudSummary, setHudSummary] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [modalTitle, setModalTitle] = useState("");
  const [currentModalOriginalData, setCurrentModalOriginalData] = useState([]);

  const today = parseDate(new Date().toISOString());

  /* 🔹 MODAL DATE FILTER */
  const [dateFilter, setDateFilter] = useState({ from: today, to: today });

  /* 🔹 SUMMARY DATE RANGE */
  const [summaryRange, setSummaryRange] = useState({ from: today, to: today });

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [modalPage, setModalPage] = useState(0);
  const [modalRowsPerPage, setModalRowsPerPage] = useState(10);

  /* ================= FETCH ================= */
  useEffect(() => {
    fetch("http://localhost:3000/dashboard/village-user")
      .then((r) => r.json())
      .then(setHiMaster);

    fetch("http://localhost:3000/dashboard/hi-monitoring")
      .then((r) => r.json())
      .then(setHiMonitoring);
  }, []);

  /* ================= HUD SUMMARY ================= */
  useEffect(() => {
    if (!hiMaster.length || !hiMonitoring.length) return;

    const summary = {};

    hiMaster.forEach((hi) => {
      if (!summary[hi.hud_id]) {
        summary[hi.hud_id] = {
          hudName: hi.hud_name,
          totalHI: 0,
          activeHI: 0,
          inactiveHI: 0,
          hiList: [],
          activeList: new Set(),
        };
      }
      summary[hi.hud_id].totalHI++;
      summary[hi.hud_id].hiList.push(hi);
    });

    const hiMap = {};
    hiMaster.forEach((hi) => {
      hiMap[hi.user_id?.trim()] = hi;
    });

    hiMonitoring.forEach((rec) => {
      const d = parseDate(rec.timestamp);
      if (d < summaryRange.from || d > summaryRange.to) return;

      const hi = hiMap[rec.user_id?.trim()];
      if (!hi) return;

      summary[hi.hud_id]?.activeList.add(hi.user_id);
    });

    Object.values(summary).forEach((hud) => {
      hud.activeHI = hud.activeList.size;
      hud.inactiveHI = hud.totalHI - hud.activeHI;
    });

    setHudSummary(Object.values(summary));
    setPage(0);
  }, [hiMaster, hiMonitoring, summaryRange]);

  /* ================= MODAL OPEN (FIXED) ================= */
  const handleOpenModal = (hud, type) => {
    const activeIds = Array.from(hud.activeList);

    const list =
      type === "Active"
        ? hud.hiList.filter((hi) => activeIds.includes(hi.user_id))
        : hud.hiList.filter((hi) => !activeIds.includes(hi.user_id));

    setModalTitle(`${type} HIs - ${hud.hudName}`);
    setCurrentModalOriginalData(list);

    // ✅ CRITICAL FIX: reset modalData immediately
    setModalData(list);

    setModalOpen(true);
    setModalPage(0);
  };

  /* ================= MODAL DATE FILTER ================= */
  useEffect(() => {
    if (!currentModalOriginalData.length) return;

    const filtered = currentModalOriginalData.filter((hi) => {
      const dates = hiMonitoring
        .filter((r) => r.user_id?.trim() === hi.user_id?.trim())
        .map((r) => parseDate(r.timestamp));

      if (modalTitle.includes("Active")) {
        return dates.some(
          (d) => d >= dateFilter.from && d <= dateFilter.to
        );
      }

      if (modalTitle.includes("Inactive")) {
        return !dates.some(
          (d) => d >= dateFilter.from && d <= dateFilter.to
        );
      }

      return true;
    });

    setModalData(filtered);
  }, [dateFilter, currentModalOriginalData, hiMonitoring, modalTitle]);

  /* ================= MODAL EXCEL ================= */
  const handleModalExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("HI Details");

    ws.columns = [
      { header: "Username", key: "username", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone_number", width: 15 },
      { header: "HUD", key: "hud_name", width: 20 },
      { header: "Block", key: "block_name", width: 20 },
    ];

    modalData.forEach((r) => ws.addRow(r));
    ws.addRow({});
    ws.addRow({ username: "Total Count", email: modalData.length });
    ws.lastRow.font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `${modalTitle}_${today}.xlsx`);
  };

  /* ================= HUD SUMMARY EXCEL ================= */
  const handleHudSummaryExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("HUD HI Summary");

    ws.columns = [
      { header: "From Date", key: "from", width: 15 },
      { header: "To Date", key: "to", width: 15 },
      { header: "HUD Name", key: "hudName", width: 25 },
      { header: "Total HI", key: "totalHI", width: 15 },
      { header: "Active HI", key: "activeHI", width: 15 },
      { header: "Inactive HI", key: "inactiveHI", width: 18 },
    ];

    hudSummary.forEach((h) =>
      ws.addRow({
        from: summaryRange.from,
        to: summaryRange.to,
        hudName: h.hudName,
        totalHI: h.totalHI,
        activeHI: h.activeHI,
        inactiveHI: h.inactiveHI,
      })
    );

    ws.addRow({});
    ws.addRow({
      hudName: "TOTAL",
      totalHI: hudSummary.reduce((s, h) => s + h.totalHI, 0),
      activeHI: hudSummary.reduce((s, h) => s + h.activeHI, 0),
      inactiveHI: hudSummary.reduce((s, h) => s + h.inactiveHI, 0),
    });

    ws.lastRow.font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buf]),
      `HUD_HI_Summary_${summaryRange.from}_to_${summaryRange.to}.xlsx`
    );
  };

  /* ================= UI ================= */
  return (
    <Box p={3} pl={10}>
      <Typography variant="h5" mb={2} fontWeight="bold">
        HUD HI Summary
      </Typography>

      {/* SUMMARY DATE RANGE + DOWNLOAD */}
      <Stack direction="row" spacing={2} mb={2}>
        <TextField
          type="date"
          label="From"
          value={summaryRange.from}
          onChange={(e) =>
            setSummaryRange({ ...summaryRange, from: e.target.value })
          }
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <TextField
          type="date"
          label="To"
          value={summaryRange.to}
          onChange={(e) =>
            setSummaryRange({ ...summaryRange, to: e.target.value })
          }
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <Button variant="contained" onClick={handleHudSummaryExcel}>
          Download Excel
        </Button>
      </Stack>

      {/* MAIN TABLE */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><b>S.No</b></TableCell>
              <TableCell><b>HUD</b></TableCell>
              <TableCell><b>Total</b></TableCell>
              <TableCell><b>Active</b></TableCell>
              <TableCell><b>Inactive</b></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {hudSummary
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((h, i) => (
                <TableRow key={h.hudName}>
                  <TableCell>{page * rowsPerPage + i + 1}</TableCell>
                  <TableCell>{h.hudName}</TableCell>
                  <TableCell>{h.totalHI}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => handleOpenModal(h, "Active")}
                    >
                      {h.activeHI}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="contained"
                      color="error"
                      onClick={() => handleOpenModal(h, "Inactive")}
                    >
                      {h.inactiveHI}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        <TablePagination
          component="div"
          count={hudSummary.length}
          page={page}
          onPageChange={(e, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(+e.target.value);
            setPage(0);
          }}
        />
      </TableContainer>

      {/* MODAL (UNCHANGED UI) */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80%",
            bgcolor: "#fff",
            p: 4,
            borderRadius: 2,
            maxHeight: "80vh",
            overflow: "auto",
          }}
        >
          <IconButton
            onClick={() => setModalOpen(false)}
            sx={{ position: "absolute", top: 8, right: 8 }}
          >
            <CloseIcon />
          </IconButton>

          <Typography variant="h6" mb={2}>
            {modalTitle}
          </Typography>

          <Stack direction="row" spacing={2} mb={2}>
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
            <Button onClick={handleModalExcel}>Download Excel</Button>
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><b>S.No</b></TableCell>
                <TableCell><b>Username</b></TableCell>
                <TableCell><b>Email</b></TableCell>
                <TableCell><b>Phone</b></TableCell>
                <TableCell><b>Block</b></TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {modalData
                .slice(
                  modalPage * modalRowsPerPage,
                  modalPage * modalRowsPerPage + modalRowsPerPage
                )
                .map((hi, i) => (
                  <TableRow key={hi.user_id}>
                    <TableCell>{modalPage * modalRowsPerPage + i + 1}</TableCell>
                    <TableCell>{hi.username}</TableCell>
                    <TableCell>{hi.email}</TableCell>
                    <TableCell>{hi.phone_number}</TableCell>
                    <TableCell>{hi.block_name}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={modalData.length}
            page={modalPage}
            onPageChange={(e, p) => setModalPage(p)}
            rowsPerPage={modalRowsPerPage}
            onRowsPerPageChange={(e) => {
              setModalRowsPerPage(+e.target.value);
              setModalPage(0);
            }}
          />
        </Box>
      </Modal>
    </Box>
  );
}
