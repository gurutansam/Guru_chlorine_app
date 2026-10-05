import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Button,
  Select,
  MenuItem,
  TextField,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import DashboardLayout from "./DashboardLayout";

const VillageHamlet = () => {
  const [plans, setPlans] = useState([]);
  const [villageData, setVillageData] = useState([]);
  const [months] = useState([
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ]);
  const [activeMonthIndex, setActiveMonthIndex] = useState(new Date().getMonth());
  const activeMonth = months[activeMonthIndex];
  const [showDialog, setShowDialog] = useState(false);

  const [newEntry, setNewEntry] = useState({
    district: "Sample District",
    hud: "",
    hud_name: "",
    block: "",
    block_name: "",
    village: "",
    village_name: "",
    samples: "",
    date: "",
  });

  useEffect(() => {
    fetch("http://localhost:3000/dashboard/village")
      .then((res) => res.json())
      .then(setVillageData)
      .catch((err) => console.error("Error fetching villages:", err));

    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/village-water-plan");
      const data = await res.json();
      setPlans(data);
    } catch (err) {
      console.error("Error fetching plans:", err);
    }
  };

  const uniqueHUDs = [
    ...new Map(
      villageData.map((v) => [v.hud_id, { id: v.hud_id, name: v.hud_name }])
    ).values(),
  ];
  const uniqueBlocks = [
    ...new Map(
      villageData
        .filter((v) => v.hud_id === newEntry.hud)
        .map((v) => [v.block_id, { id: v.block_id, name: v.block_name }])
    ).values(),
  ];
  const uniqueVillages = [
    ...new Map(
      villageData
        .filter((v) => v.hud_id === newEntry.hud && v.block_id === newEntry.block)
        .map((v) => [v.village_id, { id: v.village_id, name: v.village_name }])
    ).values(),
  ];

  const handleInputChange = (field, value) => {
    let updated = { ...newEntry };

    if (field === "hud") {
      const selected = uniqueHUDs.find((h) => h.id === value);
      updated = {
        ...updated,
        hud: value,
        hud_name: selected?.name || "",
        block: "",
        block_name: "",
        village: "",
        village_name: "",
      };
    } else if (field === "block") {
      const selected = uniqueBlocks.find((b) => b.id === value);
      updated = {
        ...updated,
        block: value,
        block_name: selected?.name || "",
        village: "",
        village_name: "",
      };
    } else if (field === "village") {
      const selected = uniqueVillages.find((v) => v.id === value);
      updated = {
        ...updated,
        village: value,
        village_name: selected?.name || "",
      };
    } else {
      updated[field] = value;
    }

    setNewEntry(updated);
  };

  const handleAddEntry = async () => {
    try {
      const payload = {
        ...newEntry,
        hud_id: newEntry.hud,
        block_id: newEntry.block,
        village_id: newEntry.village,
        month: activeMonth,
      };

      const res = await fetch("http://localhost:3000/dashboard/village-water-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      await fetchPlans();
      setNewEntry({
        hud: "",
        hud_name: "",
        block: "",
        block_name: "",
        village: "",
        village_name: "",
        samples: "",
        date: "",
      });
      setShowDialog(false);
    } catch (err) {
      alert("Error adding entry: " + err.message);
    }
  };

  const handleNext = () => {
    if (activeMonthIndex < months.length - 1)
      setActiveMonthIndex((prev) => prev + 1);
  };

  const handlePrevious = () => {
    if (activeMonthIndex > 0)
      setActiveMonthIndex((prev) => prev - 1);
  };

  const filteredPlans = plans.filter((p) => p.month === activeMonth);
  const totalSamples = filteredPlans.reduce((sum, p) => sum + (p.samples || 0), 0);

  return (
    <DashboardLayout>
      <Box p={2} pt={20} pl={10}>
        <Typography variant="h6" fontWeight="bold" align="center" gutterBottom>
          Sample District – Water Sample Collection Plan
        </Typography>

        <Box mb={2}>
          <Button variant="contained" onClick={() => setShowDialog(true)}>
            + Add Entry
          </Button>
        </Box>

        {/* Dialog Form */}
        <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Add Water Sampling Entry</DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <FormControl fullWidth size="small">
                <InputLabel>HUD</InputLabel>
                <Select
                  value={newEntry.hud}
                  label="HUD"
                  onChange={(e) => handleInputChange("hud", e.target.value)}
                >
                  {uniqueHUDs.map((hud) => (
                    <MenuItem key={hud.id} value={hud.id}>
                      {hud.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" disabled={!newEntry.hud}>
                <InputLabel>Block</InputLabel>
                <Select
                  value={newEntry.block}
                  label="Block"
                  onChange={(e) => handleInputChange("block", e.target.value)}
                >
                  {uniqueBlocks.map((block) => (
                    <MenuItem key={block.id} value={block.id}>
                      {block.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" disabled={!newEntry.block}>
                <InputLabel>Village</InputLabel>
                <Select
                  value={newEntry.village}
                  label="Village"
                  onChange={(e) => handleInputChange("village", e.target.value)}
                >
                  {uniqueVillages.map((village) => (
                    <MenuItem key={village.id} value={village.id}>
                      {village.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                size="small"
                label="Samples"
                type="number"
                value={newEntry.samples}
                onChange={(e) => handleInputChange("samples", e.target.value)}
              />

              <TextField
                fullWidth
                size="small"
                label="Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={newEntry.date}
                onChange={(e) => handleInputChange("date", e.target.value)}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDialog(false)} color="secondary">
              Cancel
            </Button>
            <Button onClick={handleAddEntry} variant="contained" color="primary">
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Table */}
        <TableContainer component={Paper}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell>HUD</TableCell>
                <TableCell>Block</TableCell>
                <TableCell>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Button size="small" onClick={handlePrevious} disabled={activeMonthIndex === 0}>
                      ←
                    </Button>
                    <Typography variant="subtitle1" fontWeight="bold" textTransform="capitalize">
                      {activeMonth}
                    </Typography>
                    <Button size="small" onClick={handleNext} disabled={activeMonthIndex === months.length - 1}>
                      →
                    </Button>
                  </Box>
                </TableCell>
                <TableCell>Samples</TableCell>
                <TableCell>Village</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPlans.map((plan, index) => (
                <TableRow key={plan.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{plan.hud_name}</TableCell>
                  <TableCell>{plan.block_name}</TableCell>
                  <TableCell>{activeMonth}</TableCell>
                  <TableCell>{plan.samples}</TableCell>
                  <TableCell>{plan.village_name}</TableCell>
                  <TableCell>{plan.date}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={5} align="right" sx={{ fontWeight: "bold" }}>
                  Total Samples
                </TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>{totalSamples}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </DashboardLayout>
  );
};

export default VillageHamlet;
