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

const formatDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export default function HudHiTable() {
  const todayStr = formatDate(new Date());

  /* ================= STATE ================= */
  const [hudSummary, setHudSummary] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [modalTitle, setModalTitle] = useState("");
  const [modalType, setModalType] = useState("active");

  const [dateFilter, setDateFilter] = useState({
    from: todayStr,
    to: todayStr,
  });

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [modalPage, setModalPage] = useState(0);
  const [modalRowsPerPage, setModalRowsPerPage] = useState(5);

  /* ================= LOGGED IN USER ================= */
  const getHudId = () => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    return user?.hud_id;
  };

  /* ================= HUD SUMMARY ================= */
  const fetchHudSummary = async () => {
    const hud_id = getHudId();
    if (!hud_id) return;

    const url = new URL(
      "http://localhost:3000/dashboard/hi-filtered-data"
    );

    url.searchParams.append("hud_id", hud_id);
    url.searchParams.append("from_date", dateFilter.from);
    url.searchParams.append("to_date", dateFilter.to);

    const res = await fetch(url, { credentials: "include" });
    const json = await res.json();
    setHudSummary(json.data || []);
    setPage(0);
  };

  useEffect(() => {
    fetchHudSummary();
  }, [dateFilter]); // 🔥 aligned

  /* ================= MODAL ================= */
  const fetchModalData = async (type) => {
    const hud_id = getHudId();
    if (!hud_id) return;

    const url = new URL(
      `http://localhost:3000/dashboard/hi-${type}-filtered-details`
    );

    url.searchParams.append("hud_id", hud_id);
    url.searchParams.append("from_date", dateFilter.from);
    url.searchParams.append("to_date", dateFilter.to);

    const res = await fetch(url, { credentials: "include" });
    const json = await res.json();
    setModalData(json.data || []);
    setModalPage(0);
  };

  const handleOpenModal = (type) => {
    setModalType(type.toLowerCase());
    setModalTitle(`${type} HIs`);
    setModalOpen(true);
    fetchModalData(type.toLowerCase());
  };

  const applyDateFilter = () => {
    fetchHudSummary();
    if (modalOpen) fetchModalData(modalType);
  };

  /* ================= EXCEL ================= */
  const downloadModalExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("HI Details");

    ws.columns = [
      { header: "Username", key: "username", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone_number", width: 15 },
      { header: "Block", key: "block_name", width: 20 },
      { header: "HUD", key: "hud_name", width: 20 },
    ];

    modalData.forEach((r) => ws.addRow(r));

    const buf = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buf]),
      `hi_${modalType}_${dateFilter.from}_to_${dateFilter.to}.xlsx`
    );
  };

  /* ================= UI ================= */
  return (
    <Box p={3} pl={10}>
      <Box mb={3}>
        <Typography variant="h5" fontWeight="bold">
          HUD HI Summary
        </Typography>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: "block" }}
        >
          Today's Active & Inactive Health Inspectors based on sample collection
        </Typography>
      </Box>



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
                <TableRow key={`${hud.hud_id}-${idx}`}>
                  <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                  <TableCell>{hud.hud_name}</TableCell>
                  <TableCell>{hud.total_hi}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => handleOpenModal("Active")}
                    >
                      {hud.active_hi}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="contained"
                      color="error"
                      onClick={() => handleOpenModal("Inactive")}
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
                    <TableRow key={`${hi.user_id}-${idx}`}>
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
