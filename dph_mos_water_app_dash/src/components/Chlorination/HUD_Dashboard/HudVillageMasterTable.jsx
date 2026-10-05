import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

export default function HudVillageMasterTable() {
  const [villages, setVillages] = useState([]);
  const [open, setOpen] = useState(false);
  const [villageName, setVillageName] = useState("");
  const [editingVillageId, setEditingVillageId] = useState(null);

  const [hudBlocks, setHudBlocks] = useState([]);
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [selectedBlockName, setSelectedBlockName] = useState("");

  const [currentHudId, setCurrentHudId] = useState(null);
  const [currentHudName, setCurrentHudName] = useState(null);

  const [phcList, setPhcList] = useState([]);
  const [selectedPhcId, setSelectedPhcId] = useState("");
  const [selectedPhcName, setSelectedPhcName] = useState("");


  useEffect(() => {
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setCurrentHudId(parsedUser.hud_id);
      setCurrentHudName(parsedUser.hud_name);
    }
  }, []);

  useEffect(() => {
    fetchVillages();
    fetchHudBlocks();
  }, [currentHudId]);

  useEffect(() => {
    if (!selectedBlockId) return;

    const fetchPhc = async () => {
      const res = await fetch("http://localhost:3000/dashboard/phc");
      const data = await res.json();
      const filtered = data.filter(p => p.block_id === selectedBlockId);
      setPhcList(filtered);
    };

    fetchPhc();
  }, [selectedBlockId]);


  const fetchVillages = async () => {
    try {
      if (!currentHudId) return;
      const res = await fetch(`http://localhost:3000/dashboard/village`);
      if (!res.ok) throw new Error("Failed to fetch villages");
      const data = await res.json();
      const filtered = data.filter((v) => v.hud_id === currentHudId);
      setVillages(filtered);
    } catch (err) {
      console.error("Error fetching villages:", err);
      setVillages([]);
    }
  };

  const fetchHudBlocks = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/hud-blocks");
      if (!res.ok) throw new Error("Failed to fetch HUD blocks");
      const data = await res.json();
      const filtered = data.filter((b) => b.hud_id === currentHudId);
      setHudBlocks(filtered);
    } catch (err) {
      console.error("Error fetching HUD blocks:", err);
      setHudBlocks([]);
    }
  };

  const handleBlockChange = (e) => {
    const blockId = e.target.value;
    setSelectedBlockId(blockId);
    const block = hudBlocks.find((b) => b.block_id === blockId);
    setSelectedBlockName(block?.block_name || "");
  };

  const handleCloseDialog = () => {
    setVillageName("");
    setSelectedBlockId("");
    setSelectedBlockName("");
    setEditingVillageId(null);
    setOpen(false);
  };

  const handleAddOrUpdate = async () => {
    if (!villageName.trim() || !selectedBlockId || !selectedBlockName) return;

    try {
      const method = editingVillageId ? "PUT" : "POST";
      const url = editingVillageId
        ? `http://localhost:3000/dashboard/village/${editingVillageId}`
        : "http://localhost:3000/dashboard/village";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          village_name: villageName.trim(),
          hud_id: currentHudId,
          hud_name: currentHudName,
          block_id: selectedBlockId,
          block_name: selectedBlockName,
          phc_id: selectedPhcId,
          phc_name: selectedPhcName,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to ${editingVillageId ? "update" : "add"} village: ${res.status} - ${errorText}`);
      }

      await fetchVillages();
      handleCloseDialog();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleEdit = (village) => {
    setEditingVillageId(village.village_id);
    setVillageName(village.village_name);
    setSelectedBlockId(village.block_id);
    setSelectedBlockName(village.block_name);
    setOpen(true);
  };

  const handleDelete = async (villageId) => {
    if (!window.confirm("Are you sure you want to delete this village?")) return;
    try {
      const res = await fetch(`http://localhost:3000/dashboard/village/${villageId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete village");
      await fetchVillages();
    } catch (err) {
      alert("Error deleting village: " + err.message);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, pt: 20, pl: 10 }}>
        <Typography variant="h5" mb={2}>Village Master Table</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>Add Village</Button>

        <Table sx={{ mt: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell><strong>HUD Name</strong></TableCell>
              <TableCell><strong>Block Name</strong></TableCell>
              <TableCell><strong>PHC Name</strong></TableCell>
              <TableCell><strong>HSC (Village Name)</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {villages.map((row) => (
              <TableRow key={row.village_id}>
                {/* HUD NAME */}
                <TableCell>{row.hud_name}</TableCell>

                {/* BLOCK NAME */}
                <TableCell>{row.block_name}</TableCell>

                {/* PHC NAME — must be returned in API */}
                <TableCell>{row.phc_name}</TableCell>

                {/* VILLAGE/HSC NAME */}
                <TableCell>{row.village_name}</TableCell>

                {/* ACTION BUTTONS */}
                <TableCell>
                  <IconButton color="primary" onClick={() => handleEdit(row)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton color="error" onClick={() => handleDelete(row.village_id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>


        <Dialog open={open} onClose={handleCloseDialog}>
          <DialogTitle>{editingVillageId ? "Edit Village" : "Add New Village"}</DialogTitle>
          <DialogContent>
            <TextField
              label="Village Name"
              fullWidth
              value={villageName}
              onChange={(e) => setVillageName(e.target.value)}
              margin="dense"
              autoFocus
            />
            <TextField
              label="HUD"
              fullWidth
              value={currentHudName || ""}
              margin="dense"
              InputProps={{ readOnly: true }}
            />
            <FormControl fullWidth margin="dense">
              <InputLabel>Select Block</InputLabel>
              <Select
                value={selectedBlockId}
                onChange={handleBlockChange}
                label="Select Block"
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {hudBlocks.map((block) => (
                  <MenuItem key={block.block_id} value={block.block_id}>
                    {block.block_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense">
              <InputLabel>Select PHC</InputLabel>
              <Select
                value={selectedPhcId}
                onChange={(e) => {
                  const phc = phcList.find(p => p.phc_id === e.target.value);
                  setSelectedPhcId(e.target.value);
                  setSelectedPhcName(phc?.phc_name || "");
                }}
                label="Select PHC"
                disabled={!selectedBlockId}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>

                {phcList.map((phc) => (
                  <MenuItem key={phc.phc_id} value={phc.phc_id}>
                    {phc.phc_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button variant="contained" onClick={handleAddOrUpdate}>
              {editingVillageId ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
