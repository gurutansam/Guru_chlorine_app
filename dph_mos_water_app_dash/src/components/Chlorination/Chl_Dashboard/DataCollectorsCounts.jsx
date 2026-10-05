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
import CloseIcon from "@mui/icons-material/Close";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { apiFetch } from "../../../utils/api.js";

const formatDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export default function HudHiTable() {
  const todayStr = formatDate(new Date());

  const [hudSummary, setHudSummary] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [modalTitle, setModalTitle] = useState("");
  const [selectedHud, setSelectedHud] = useState(null);
  const [modalType, setModalType] = useState("active");

  const [dateFilter, setDateFilter] = useState({
    from: todayStr,
    to: todayStr,
  });

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [modalPage, setModalPage] = useState(0);
  const [modalRowsPerPage, setModalRowsPerPage] = useState(5);

  /* ================= HUD SUMMARY ================= */

  const fetchHudSummary = async () => {
    try {
      const res = await apiFetch("/dashboard/hi-user-data");
      const json = await res.json();
      setHudSummary(json.data || []);
    } catch (error) {
      console.error(error);
      setHudSummary([]);
    }
  };

  useEffect(() => {
    fetchHudSummary();
  }, []);

  /* ================= FETCH MODAL DATA ================= */

  const fetchModalData = async (hud_id, type, filter = null) => {
    try {
      const params = new URLSearchParams();
      params.append("hud_id", hud_id);

      // Apply date filter ONLY when Apply button is clicked
      if (filter) {
        params.append("from_date", filter.from);
        params.append("to_date", filter.to);
      }

      const res = await apiFetch(`/dashboard/hi-${type}-details?${params.toString()}`);
      const json = await res.json();
      setModalData(json.data || []);
    } catch (error) {
      console.error(error);
      setModalData([]);
    }
  };

  /* ================= MODAL OPEN ================= */

  const handleOpenModal = (hud, type) => {
    setSelectedHud(hud);
    setModalType(type.toLowerCase());
    setModalTitle(`${type} HIs - ${hud.hud_name}`);
    setModalOpen(true);
    setModalPage(0);

    // Always load TODAY data on open
    fetchModalData(hud.hud_id, type.toLowerCase(), null);
  };

  /* ================= DATE FILTER APPLY ================= */

  const applyDateFilter = () => {
    if (!selectedHud) return;
    fetchModalData(selectedHud.hud_id, modalType, dateFilter);
  };

  /* ================= MODAL EXCEL ================= */

  const downloadModalExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("HI Details");

    ws.columns = [
      { header: "Username", key: "username", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone_number", width: 15 },
      { header: "Block Name", key: "block_name", width: 20 },
      { header: "HUD Name", key: "hud_name", width: 20 },
    ];

    modalData.forEach((r) => ws.addRow(r));

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `hi_${todayStr}.xlsx`);
  };

  /* ================= OVERALL DOWNLOAD ================= */

  const handleOverallDownload = async () => {
    if (!hudSummary.length) return;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("HUD HI Summary");

    ws.columns = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "HUD Name", key: "hud_name", width: 30 },
      { header: "Total HI", key: "total_hi", width: 15 },
      { header: "Active HI", key: "active_hi", width: 15 },
      { header: "Inactive HI", key: "inactive_hi", width: 18 },
    ];

    /* ===== HEADER STYLE ===== */
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF424242" }, // dark grey
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    /* ===== DATA ROWS ===== */
    hudSummary.forEach((hud, index) => {
      const row = ws.addRow({
        sno: index + 1,
        hud_name: hud.hud_name,
        total_hi: hud.total_hi,
        active_hi: hud.active_hi,
        inactive_hi: hud.inactive_hi,
      });

      row.eachCell((cell, colNumber) => {
        // Borders
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        // Alignment
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 2 ? "left" : "center",
        };

        // Column-based colors
        if (colNumber === 2) {
          // HUD Name - blue
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE3F2FD" },
          };
        }

        if (colNumber === 3) {
          // Total HI - grey
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF5F5F5" },
          };
        }

        if (colNumber === 4) {
          // Active HI - green
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE8F5E9" },
          };
        }

        if (colNumber === 5) {
          // Inactive HI - red
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFDECEA" },
          };
        }
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buf]),
      `hud_hi_summary_${dateFilter.from}_to_${dateFilter.to}.xlsx`
    );
  };


  /* ================= UI ================= */

  return (
    <Box p={2}>
      {/* HEADER + OVERALL DOWNLOAD */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h5" fontWeight="bold">
          HUD HI Summary ({todayStr})
        </Typography>

        <Button variant="contained" onClick={handleOverallDownload}>
          Overall HUD HI Summary
        </Button>

      </Stack>

      {/* HUD TABLE */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>S.No</TableCell>
              <TableCell>HUD Name</TableCell>
              <TableCell>Total HI</TableCell>
              <TableCell>Active HI</TableCell>
              <TableCell>Inactive HI</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {hudSummary
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((hud, idx) => (
                <TableRow key={hud.hud_id}>
                  <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                  <TableCell>{hud.hud_name}</TableCell>
                  <TableCell>{hud.total_hi}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      color="success"
                      variant="contained"
                      onClick={() => handleOpenModal(hud, "Active")}
                    >
                      {hud.active_hi}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      color="error"
                      variant="contained"
                      onClick={() => handleOpenModal(hud, "Inactive")}
                    >
                      {hud.inactive_hi}
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
          }}
        >
          <IconButton
            onClick={() => setModalOpen(false)}
            sx={{ position: "absolute", top: 8, right: 8 }}
          >
            <CloseIcon />
          </IconButton>

          <Typography fontWeight="bold" mb={2}>
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
            <Button variant="outlined" onClick={applyDateFilter}>
              Apply
            </Button>
            <Button variant="outlined" onClick={downloadModalExcel}>
              Download Excel
            </Button>
          </Stack>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>S.No</TableCell>
                  <TableCell>Username</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Block</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modalData
                  .slice(
                    modalPage * modalRowsPerPage,
                    modalPage * modalRowsPerPage + modalRowsPerPage
                  )
                  .map((hi, idx) => (
                    <TableRow key={hi.user_id}>
                      <TableCell>
                        {modalPage * modalRowsPerPage + idx + 1}
                      </TableCell>
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
              rowsPerPageOptions={[5, 10, 25]}
              onRowsPerPageChange={(e) => {
                setModalRowsPerPage(+e.target.value);
                setModalPage(0);
              }}
            />
          </TableContainer>
        </Box>
      </Modal>
    </Box>
  );
}
