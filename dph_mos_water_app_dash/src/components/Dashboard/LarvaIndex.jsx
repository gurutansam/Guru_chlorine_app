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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Button,
  TextField,
} from "@mui/material";
import {
  parseISO,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  format,
} from "date-fns";
import * as XLSX from "xlsx";
import DashboardLayout from "./DashboardLayout";

/* ---------------- HOUSE INDEX COLOR ---------------- */
const getHouseIndexColor = (value) => {
  const v = Number(value);
  if (v < 5) return "#2e7d32";
  if (v <= 10) return "#f9a825";
  if (v <= 15) return "#ef6c00";
  return "#d32f2f";
};

/* ---------------- TOTALS FUNCTION (UNCHANGED) ---------------- */
function computeTotals(data) {
  const totalHouses = data.reduce((s, d) => s + d.houses_inspected, 0);
  const totalPositiveHouses = data.reduce((s, d) => s + d.positive_houses, 0);
  const totalContainers = data.reduce((s, d) => s + d.containers_examined, 0);
  const totalPositiveContainers = data.reduce(
    (s, d) => s + d.positive_containers,
    0
  );

  return {
    date: "TOTAL",
    hud_name: "-",
    block_name: "-",
    phc_name: "-",
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
}

export default function LarvaIndex() {
  const [dailyData, setDailyData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [weekRange, setWeekRange] = useState({ start: null, end: null });

  const [hudList, setHudList] = useState([]);
  const [blockList, setBlockList] = useState([]);

  const [dailyHud, setDailyHud] = useState("");
  const [dailyBlock, setDailyBlock] = useState("");
  const [weeklyHud, setWeeklyHud] = useState("");
  const [weeklyBlock, setWeeklyBlock] = useState("");

  const [dailyFrom, setDailyFrom] = useState("");
  const [dailyTo, setDailyTo] = useState("");
  const [weeklyFrom, setWeeklyFrom] = useState("");
  const [weeklyTo, setWeeklyTo] = useState("");

  const [dailyPage, setDailyPage] = useState(1);
  const [weeklyPage, setWeeklyPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    fetch("http://localhost:3000/dashboard/hud")
      .then(res => res.json())
      .then(d => setHudList(d.data || d));

    fetch("http://localhost:3000/dashboard/hud-blocks")
      .then(res => res.json())
      .then(d => setBlockList(d.data || d));
  }, []);

  useEffect(() => {
    fetch("http://localhost:3000/dashboard/date-wise-index")
      .then(res => res.json())
      .then(res => {
        setDailyData(res.data || []);
        calculateWeekly(res.data || []);
      });
  }, []);

  const calculateWeekly = (data) => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    setWeekRange({ start, end });

    const map = {};
    data.forEach(d => {
      const date = parseISO(d.date);
      if (!isWithinInterval(date, { start, end })) return;

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
      Object.values(map).map(d => ({
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
  };

  const filterByDate = (data, from, to) =>
    data.filter(d => {
      const date = parseISO(d.date);
      if (from && date < parseISO(from)) return false;
      if (to && date > parseISO(to)) return false;
      return true;
    });

  const downloadXLSX = (data, name) => {
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet([...data, computeTotals(data)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, name);
  };

  return (
    <DashboardLayout>
      <Grid container spacing={2} sx={{ mt: 12, ml: 8, p: 2 }}>
        {/* DAILY */}
        <Grid item xs={12}>
          <ReportFilters
            hudList={hudList}
            blockList={blockList}
            hud={dailyHud}
            block={dailyBlock}
            setHud={setDailyHud}
            setBlock={setDailyBlock}
            from={dailyFrom}
            to={dailyTo}
            setFrom={setDailyFrom}
            setTo={setDailyTo}
            onDownload={() =>
              downloadXLSX(
                filterByDate(
                  dailyData.filter(d =>
                    (!dailyHud || d.hud_name === dailyHud) &&
                    (!dailyBlock || d.block_name === dailyBlock)
                  ),
                  dailyFrom,
                  dailyTo
                ),
                "daily_larva_report.xlsx"
              )
            }
          />
          <ReportTable
            title="Daily Larva Report"
            data={filterByDate(
              dailyData.filter(d =>
                (!dailyHud || d.hud_name === dailyHud) &&
                (!dailyBlock || d.block_name === dailyBlock)
              ),
              dailyFrom,
              dailyTo
            )}
            page={dailyPage}
            setPage={setDailyPage}
            rowsPerPage={rowsPerPage}
          />
        </Grid>

        {/* WEEKLY */}
        <Grid item xs={12}>
          <ReportFilters
            hudList={hudList}
            blockList={blockList}
            hud={weeklyHud}
            block={weeklyBlock}
            setHud={setWeeklyHud}
            setBlock={setWeeklyBlock}
            from={weeklyFrom}
            to={weeklyTo}
            setFrom={setWeeklyFrom}
            setTo={setWeeklyTo}
            onDownload={() =>
              downloadXLSX(
                filterByDate(
                  weeklyData.filter(d =>
                    (!weeklyHud || d.hud_name === weeklyHud) &&
                    (!weeklyBlock || d.block_name === weeklyBlock)
                  ),
                  weeklyFrom,
                  weeklyTo
                ),
                "weekly_larva_report.xlsx"
              )
            }
          />
          <ReportTable
            title={`Weekly Larva Report (${format(
              weekRange.start,
              "dd/MM/yyyy"
            )} - ${format(weekRange.end, "dd/MM/yyyy")})`}
            data={filterByDate(
              weeklyData.filter(d =>
                (!weeklyHud || d.hud_name === weeklyHud) &&
                (!weeklyBlock || d.block_name === weeklyBlock)
              ),
              weeklyFrom,
              weeklyTo
            )}
            page={weeklyPage}
            setPage={setWeeklyPage}
            rowsPerPage={rowsPerPage}
          />
        </Grid>
      </Grid>
    </DashboardLayout>
  );
}

/* ---------------- FILTER BAR ---------------- */
function ReportFilters({
  hudList,
  blockList,
  hud,
  block,
  setHud,
  setBlock,
  from,
  to,
  setFrom,
  setTo,
  onDownload,
}) {
  const blocks = hud ? blockList.filter(b => b.hud_name === hud) : blockList;

  return (
    <Grid container spacing={2} alignItems="center" mb={1}>
      <Grid item md={3} sx={{ minWidth: 200 }}>
        <SelectBox label="Select HUD" value={hud} list={hudList} onChange={setHud} />
      </Grid>
      <Grid item md={3} sx={{ minWidth: 200 }}>
        <SelectBox label="Select Block" value={block} list={blocks} onChange={setBlock} />
      </Grid>
      <Grid item md={2} />
      <Grid item md={2}>
        <DateBox label="From Date" value={from} onChange={setFrom} />
      </Grid>
      <Grid item md={2}>
        <DateBox label="To Date" value={to} onChange={setTo} />
      </Grid>
      <Grid item md={2}>
        <Button fullWidth variant="contained" sx={{ height: 56 }} onClick={onDownload}>
          Download Excel
        </Button>
      </Grid>
    </Grid>
  );
}

/* ---------------- HELPERS ---------------- */
const SelectBox = ({ label, value, list, onChange }) => (
  <FormControl fullWidth>
    <InputLabel>{label}</InputLabel>
    <Select value={value} onChange={e => onChange(e.target.value)}>
      <MenuItem value="">All</MenuItem>
      {list.map(i => (
        <MenuItem key={i.hud_id || i.block_id} value={i.hud_name || i.block_name}>
          {i.hud_name || i.block_name}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
);

const DateBox = ({ label, value, onChange }) => (
  <TextField
    fullWidth
    type="date"
    label={label}
    value={value}
    InputLabelProps={{ shrink: true }}
    onChange={e => onChange(e.target.value)}
  />
);

/* ---------------- TABLE ---------------- */
function ReportTable({ title, data, page, setPage, rowsPerPage }) {
  const totals = data.length ? computeTotals(data) : null;
  const start = (page - 1) * rowsPerPage;
  const rows = data.slice(start, start + rowsPerPage);
  const totalPages = Math.ceil(data.length / rowsPerPage);

  const headers = [
    { k: "date", l: "Date" },
    { k: "hud", l: "HUD" },
    { k: "block", l: "Block" },
    { k: "phc", l: "PHC" },
    { k: "houses", l: "No.of Houses checked" },
    { k: "ph", l: "Positive Houses" },
    { k: "hi", l: "House Index%" },
    { k: "containers", l: "No.of Containers Checked" },
    { k: "pc", l: "Positive Containers" },
    { k: "ci", l: "Container Index %" },
    { k: "t", l: "No.of Sources Treated" },
    { k: "d", l: "No.of Sources Destroyed" },
    { k: "tot", l: "Total" },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6">{title}</Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {headers.map(h => (
                  <TableCell key={h.k}>{h.l}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((d, i) => (
                <TableRow key={i}>
                  <TableCell>{d.date}</TableCell>
                  <TableCell>{d.hud_name}</TableCell>
                  <TableCell>{d.block_name}</TableCell>
                  <TableCell>{d.phc_name}</TableCell>
                  <TableCell>{d.houses_inspected}</TableCell>
                  <TableCell>{d.positive_houses}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: getHouseIndexColor(d.house_index) }}>
                    {d.house_index}
                  </TableCell>
                  <TableCell>{d.containers_examined}</TableCell>
                  <TableCell>{d.positive_containers}</TableCell>
                  <TableCell>{d.container_index}</TableCell>
                  <TableCell>{d.treated_sources}</TableCell>
                  <TableCell>{d.destroyed_sources}</TableCell>
                  <TableCell>{d.total_actioned_sources}</TableCell>
                </TableRow>
              ))}
              {totals && (
                <TableRow sx={{ fontWeight: "bold" }}>
                  <TableCell>{totals.date}</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>{totals.houses_inspected}</TableCell>
                  <TableCell>{totals.positive_houses}</TableCell>
                  <TableCell sx={{ color: getHouseIndexColor(totals.house_index) }}>
                    {totals.house_index}
                  </TableCell>
                  <TableCell>{totals.containers_examined}</TableCell>
                  <TableCell>{totals.positive_containers}</TableCell>
                  <TableCell>{totals.container_index}</TableCell>
                  <TableCell>{totals.treated_sources}</TableCell>
                  <TableCell>{totals.destroyed_sources}</TableCell>
                  <TableCell>{totals.total_actioned_sources}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Pagination
          sx={{ mt: 1 }}
          count={totalPages}
          page={page}
          onChange={(e, v) => setPage(v)}
        />
      </CardContent>
    </Card>
  );
}
