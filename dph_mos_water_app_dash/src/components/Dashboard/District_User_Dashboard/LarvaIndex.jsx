import React, { useEffect, useState } from "react";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Pagination,
  CircularProgress,
  TextField,
  Button,
  Stack,
  MenuItem,
  Box,
} from "@mui/material";
import { startOfWeek, endOfWeek, format, parseISO } from "date-fns";
import * as XLSX from "xlsx";
import DashboardLayout from "./DashboardLayout";

/* ---------- HOUSE INDEX COLOR ---------- */
const getHouseIndexColor = (value) => {
  const v = Number(value);
  if (v < 5) return "#2e7d32";
  if (v <= 10) return "#f9a825";
  if (v <= 15) return "#ef6c00";
  return "#d32f2f";
};

/* ---------- TOTALS ---------- */
const computeTotals = (data) => {
  const totalHouses = data.reduce((s, d) => s + d.houses_inspected, 0);
  const totalPositiveHouses = data.reduce((s, d) => s + d.positive_houses, 0);
  const totalContainers = data.reduce((s, d) => s + d.containers_examined, 0);
  const totalPositiveContainers = data.reduce(
    (s, d) => s + d.positive_containers,
    0
  );

  return {
    houses_inspected: totalHouses,
    positive_houses: totalPositiveHouses,
    house_index: totalHouses
      ? ((totalPositiveHouses / totalHouses) * 100).toFixed(2)
      : 0,
    containers_examined: totalContainers,
    positive_containers: totalPositiveContainers,
    container_index: totalContainers
      ? ((totalPositiveContainers / totalContainers) * 100).toFixed(2)
      : 0,
    treated_sources: data.reduce((s, d) => s + d.treated_sources, 0),
    destroyed_sources: data.reduce((s, d) => s + d.destroyed_sources, 0),
    total_actioned_sources: data.reduce(
      (s, d) => s + d.total_actioned_sources,
      0
    ),
  };
};

/* ---------- STRING SIMILARITY ---------- */
function levenshteinDistance(a = "", b = "") {
  const matrix = Array.from({ length: b.length + 1 }, () =>
    Array(a.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] =
          Math.min(
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

/* ===================== PAGE ===================== */
export default function LarvaIndexPage() {
  const [dailyData, setDailyData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [districtUser, setDistrictUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [dailyPage, setDailyPage] = useState(1);
  const [weeklyPage, setWeeklyPage] = useState(1);
  const rowsPerPage = 10;

  const [weekRange, setWeekRange] = useState({ start: null, end: null });

  const [dailyFrom, setDailyFrom] = useState("");
  const [dailyTo, setDailyTo] = useState("");
  const [weeklyFrom, setWeeklyFrom] = useState("");
  const [weeklyTo, setWeeklyTo] = useState("");

  const [blocks, setBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState("");

  /* ---------- FETCH LOGGED-IN DISTRICT USER ---------- */
  useEffect(() => {
    const fetchDistrictUser = async () => {
      const res = await fetch(
        "http://localhost:3000/dashboard/district-officers"
      );
      const users = await res.json();
      const loggedInUsername = localStorage.getItem("loggedInUsername");

      const matched = users.find(
        (u) =>
          u.username?.toLowerCase() === loggedInUsername?.toLowerCase()
      );

      if (matched) setDistrictUser(matched);
    };
    fetchDistrictUser();
  }, []);

  /* ---------- FETCH BLOCKS ---------- */
  useEffect(() => {
    if (!districtUser) return;

    fetch("http://localhost:3000/dashboard/mosquito-blocks")
      .then((res) => res.json())
      .then((res) => {
        const userBlocks = res.filter(
          (b) => b.district_code === districtUser.district_code
        );
        setBlocks(userBlocks);
        if (userBlocks.length === 1) setSelectedBlock(userBlocks[0].block_name);
      });
  }, [districtUser]);

  /* ---------- FETCH RAW DATA ---------- */
  const [rawData, setRawData] = useState([]);
  useEffect(() => {
    if (!districtUser) return;

    setLoading(true);

    fetch("http://localhost:3000/dashboard/date-wise-index")
      .then((res) => res.json())
      .then((res) => setRawData(res.data || []))
      .finally(() => setLoading(false));
  }, [districtUser]);

  /* ---------- DAILY FILTER EFFECT ---------- */
  useEffect(() => {
    if (!districtUser || !rawData.length) return;

    const userDistrict = districtUser.district_name?.toLowerCase() || "";

    const districtFiltered = rawData.filter((d) => {
      const dataDistrict =
        d.district_name?.toLowerCase() || d.hud_name?.toLowerCase() || "";
      return similarity(userDistrict, dataDistrict) >= 80;
    });

    const dailyFiltered = districtFiltered.filter((d) => {
      if (dailyFrom && d.date < dailyFrom) return false;
      if (dailyTo && d.date > dailyTo) return false;
      if (selectedBlock && d.block_name !== selectedBlock) return false;
      return true;
    });

    setDailyData(dailyFiltered);
    setDailyPage(1);
  }, [rawData, districtUser, dailyFrom, dailyTo, selectedBlock]);

  /* ---------- WEEKLY FILTER EFFECT ---------- */
  useEffect(() => {
    if (!districtUser || !rawData.length) return;

    const userDistrict = districtUser.district_name?.toLowerCase() || "";

    const districtFiltered = rawData.filter((d) => {
      const dataDistrict =
        d.district_name?.toLowerCase() || d.hud_name?.toLowerCase() || "";
      return similarity(userDistrict, dataDistrict) >= 80;
    });

    const start = weeklyFrom
      ? weeklyFrom
      : format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const end = weeklyTo
      ? weeklyTo
      : format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

    setWeekRange({ start: parseISO(start), end: parseISO(end) });

    const map = {};
    districtFiltered.forEach((d) => {
      if (d.date < start || d.date > end) return;
      if (selectedBlock && d.block_name !== selectedBlock) return;

      const key = `${d.hud_name}|${d.block_name}|${d.phc_name}`;
      if (!map[key]) map[key] = { ...d };
      else {
        map[key].houses_inspected += d.houses_inspected;
        map[key].positive_houses += d.positive_houses;
        map[key].containers_examined += d.containers_examined;
        map[key].positive_containers += d.positive_containers;
        map[key].treated_sources += d.treated_sources;
        map[key].destroyed_sources += d.destroyed_sources;
      }
    });

    setWeeklyData(
      Object.values(map).map((d) => ({
        ...d,
        house_index: d.houses_inspected
          ? ((d.positive_houses / d.houses_inspected) * 100).toFixed(2)
          : 0,
        container_index: d.containers_examined
          ? ((d.positive_containers / d.containers_examined) * 100).toFixed(2)
          : 0,
        total_actioned_sources: d.treated_sources + d.destroyed_sources,
      }))
    );
    setWeeklyPage(1);
  }, [rawData, districtUser, weeklyFrom, weeklyTo, selectedBlock]);

  /* ---------- EXCEL DOWNLOAD ---------- */
  const downloadExcel = (data, name) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, name);
    XLSX.writeFile(wb, `${name}.xlsx`);
  };

  if (loading)
    return (
      <Grid container justifyContent="center" alignItems="center" sx={{ minHeight: "70vh" }}>
        <CircularProgress />
      </Grid>
    );

  return (
    <DashboardLayout>
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Grid container spacing={4}>
          {/* Header */}
          <Grid item xs={12}>
            <Typography variant="h6" fontWeight={600}>
              Logged-in District :
              <span style={{ color: "#1976d2", marginLeft: 8 }}>
                {districtUser?.district_name}
              </span>
            </Typography>
          </Grid>

          {/* Daily Section */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  alignItems={{ xs: "flex-start", md: "center" }}
                  justifyContent="space-between"
                  sx={{ mb: 3 }}
                >
                  <Typography variant="h6">Daily Larva Index</Typography>

                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    flexWrap="wrap"
                    gap={2}
                  >
                    <TextField
                      type="date"
                      label="From"
                      InputLabelProps={{ shrink: true }}
                      value={dailyFrom}
                      onChange={(e) => setDailyFrom(e.target.value)}
                      size="small"
                    />
                    <TextField
                      type="date"
                      label="To"
                      InputLabelProps={{ shrink: true }}
                      value={dailyTo}
                      onChange={(e) => setDailyTo(e.target.value)}
                      size="small"
                    />
                    <TextField
                      select
                      label="Block"
                      value={selectedBlock}
                      onChange={(e) => setSelectedBlock(e.target.value)}
                      size="small"
                      sx={{ minWidth: 180 }}
                      SelectProps={{ displayEmpty: true }}
                    >
                      <MenuItem value="">
                        <em>All Blocks</em>
                      </MenuItem>
                      {blocks.map((b) => (
                        <MenuItem key={b.block_id} value={b.block_name}>
                          {b.block_name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="contained"
                      onClick={() => downloadExcel(dailyData, "Daily_Larva_Index")}
                      size="medium"
                    >
                      Download Excel
                    </Button>
                  </Stack>
                </Stack>

                <ReportTable
                  data={dailyData}
                  page={dailyPage}
                  setPage={setDailyPage}
                  rowsPerPage={rowsPerPage}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Weekly Section */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  alignItems={{ xs: "flex-start", md: "center" }}
                  justifyContent="space-between"
                  sx={{ mb: 3 }}
                >
                  <Typography variant="h6">
                    Weekly Larva Index{" "}
                    {weekRange.start &&
                      `(${format(weekRange.start, "dd/MM/yyyy")} - ${format(
                        weekRange.end,
                        "dd/MM/yyyy"
                      )})`}
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    flexWrap="wrap"
                    gap={2}
                  >
                    <TextField
                      type="date"
                      label="From"
                      InputLabelProps={{ shrink: true }}
                      value={weeklyFrom}
                      onChange={(e) => setWeeklyFrom(e.target.value)}
                      size="small"
                    />
                    <TextField
                      type="date"
                      label="To"
                      InputLabelProps={{ shrink: true }}
                      value={weeklyTo}
                      onChange={(e) => setWeeklyTo(e.target.value)}
                      size="small"
                    />
                    <TextField
                      select
                      label="Block"
                      value={selectedBlock}
                      onChange={(e) => setSelectedBlock(e.target.value)}
                      size="small"
                      sx={{ minWidth: 180 }}
                      SelectProps={{ displayEmpty: true }}
                    >
                      <MenuItem value="">
                        <em>All Blocks</em>
                      </MenuItem>
                      {blocks.map((b) => (
                        <MenuItem key={b.block_id} value={b.block_name}>
                          {b.block_name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="contained"
                      onClick={() => downloadExcel(weeklyData, "Weekly_Larva_Index")}
                      size="medium"
                    >
                      Download Excel
                    </Button>
                  </Stack>
                </Stack>

                <ReportTable
                  data={weeklyData}
                  page={weeklyPage}
                  setPage={setWeeklyPage}
                  rowsPerPage={rowsPerPage}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  );
}

/* ---------- TABLE COMPONENT ---------- */
function ReportTable({ data, page, setPage, rowsPerPage }) {
  const totals = data.length ? computeTotals(data) : null;
  const start = (page - 1) * rowsPerPage;
  const rows = data.slice(start, start + rowsPerPage);
  const totalPages = Math.ceil(data.length / rowsPerPage);

  return (
    <>
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {[
                "Date",
                "HUD",
                "Block",
                "PHC",
                "Houses",
                "Positive Houses",
                "HI %",
                "Containers",
                "Positive Containers",
                "CI %",
                "Treated",
                "Destroyed",
                "Total",
              ].map((h) => (
                <TableCell
                  key={h}
                  align={h.includes("%") || h === "Total" ? "center" : "left"}
                >
                  <strong>{h}</strong>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((d, i) => (
              <TableRow key={i} hover>
                <TableCell>{d.date}</TableCell>
                <TableCell>{d.hud_name}</TableCell>
                <TableCell>{d.block_name}</TableCell>
                <TableCell>{d.phc_name || "-"}</TableCell>
                <TableCell align="right">{d.houses_inspected}</TableCell>
                <TableCell align="right">{d.positive_houses}</TableCell>
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 600,
                    color: getHouseIndexColor(d.house_index),
                  }}
                >
                  {d.house_index}
                </TableCell>
                <TableCell align="right">{d.containers_examined}</TableCell>
                <TableCell align="right">{d.positive_containers}</TableCell>
                <TableCell align="center">{d.container_index}</TableCell>
                <TableCell align="right">{d.treated_sources}</TableCell>
                <TableCell align="right">{d.destroyed_sources}</TableCell>
                <TableCell align="right">{d.total_actioned_sources}</TableCell>
              </TableRow>
            ))}

            {totals && (
              <TableRow sx={{ backgroundColor: "#f5f5f5", fontWeight: "bold" }}>
                <TableCell><strong>TOTAL</strong></TableCell>
                <TableCell colSpan={3} />
                <TableCell align="right"><strong>{totals.houses_inspected}</strong></TableCell>
                <TableCell align="right"><strong>{totals.positive_houses}</strong></TableCell>
                <TableCell align="center"><strong>{totals.house_index}</strong></TableCell>
                <TableCell align="right"><strong>{totals.containers_examined}</strong></TableCell>
                <TableCell align="right"><strong>{totals.positive_containers}</strong></TableCell>
                <TableCell align="center"><strong>{totals.container_index}</strong></TableCell>
                <TableCell align="right"><strong>{totals.treated_sources}</strong></TableCell>
                <TableCell align="right"><strong>{totals.destroyed_sources}</strong></TableCell>
                <TableCell align="right"><strong>{totals.total_actioned_sources}</strong></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Pagination
        count={totalPages}
        page={page}
        onChange={(e, v) => setPage(v)}
        color="primary"
        sx={{ display: "flex", justifyContent: "center" }}
      />
    </>
  );
}