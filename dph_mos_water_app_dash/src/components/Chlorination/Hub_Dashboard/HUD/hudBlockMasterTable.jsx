import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DashboardLayout from "../DashboardLayout";

export default function HudBlockMasterTable() {
  const [blocks, setBlocks] = useState([]);
  const [allHuds, setAllHuds] = useState([]);
  const [filteredHuds, setFilteredHuds] = useState([]);
  const [open, setOpen] = useState(false);
  const [blockName, setBlockName] = useState("");
  const [selectedHud, setSelectedHud] = useState("");
  const [hubId, setHubId] = useState("");

  // States for edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editBlockId, setEditBlockId] = useState(null);
  const [editBlockName, setEditBlockName] = useState("");
  const [editSelectedHud, setEditSelectedHud] = useState("");

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
        if (!loggedInUser?.hub_id) {
          alert("Logged in user missing hub_id");
          return;
        }

        const userHubId = loggedInUser.hub_id;
        setHubId(userHubId);

        const hudRes = await fetch("http://localhost:3000/dashboard/hud");
        const hudData = await hudRes.json();
        setAllHuds(hudData);

        const filtered = hudData.filter((h) => h.hub_id === userHubId);
        setFilteredHuds(filtered);

        const blockRes = await fetch("http://localhost:3000/dashboard/hud-blocks");
        const blockData = await blockRes.json();

        const filteredBlocks = blockData.filter((b) => {
          const hud = hudData.find((h) => h.hud_id === b.hud_id);
          return hud?.hub_id === userHubId;
        });

        setBlocks(filteredBlocks);
      } catch (err) {
        console.error("Init error:", err);
      }
    };

    fetchInitialData();
  }, []);

  // Add new block
  const handleAdd = async () => {
    if (!blockName.trim() || !selectedHud) return;

    const hud = allHuds.find((h) => h.hud_id === selectedHud);
    if (!hud) return;

    try {
      const res = await fetch("http://localhost:3000/dashboard/hud-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_name: blockName.trim(),
          hud_id: hud.hud_id,
          hud_name: hud.hud_name,
        }),
      });

      if (!res.ok) throw new Error("Failed to add block");
      setBlockName("");
      setSelectedHud("");
      setOpen(false);
      window.location.reload();
    } catch (err) {
      alert("Error adding block: " + err.message);
    }
  };

  // Delete block
  const handleDelete = async (block_id) => {
    if (!window.confirm("Are you sure you want to delete this block?")) return;

    try {
      const res = await fetch(`http://localhost:3000/dashboard/hud-blocks/${block_id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete failed");
      window.location.reload();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  // Open edit dialog with block data
  const handleEditClick = (block) => {
    setEditBlockId(block.block_id);
    setEditBlockName(block.block_name);
    setEditSelectedHud(block.hud_id);
    setEditOpen(true);
  };

  // Save edited block
  const handleEditSave = async () => {
    if (!editBlockName.trim() || !editSelectedHud) return;

    try {
      const hud = allHuds.find((h) => h.hud_id === editSelectedHud);
      if (!hud) return;

      const res = await fetch(`http://localhost:3000/dashboard/hud-blocks/${editBlockId}`, {
        method: "PUT", // or PATCH if your backend uses PATCH
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_name: editBlockName.trim(),
          hud_id: hud.hud_id,
          hud_name: hud.hud_name,
        }),
      });

      if (!res.ok) throw new Error("Failed to update block");

      setEditOpen(false);
      setEditBlockId(null);
      setEditBlockName("");
      setEditSelectedHud("");
      window.location.reload();
    } catch (err) {
      alert("Error updating block: " + err.message);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, paddingTop: 20, paddingLeft: 10 }}>
        <Typography variant="h5" mb={2}>
          HUD-Block Master Table
        </Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Add Block
        </Button>

        <Table sx={{ mt: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>Block Name</strong>
              </TableCell>
              <TableCell>
                <strong>HUD Name</strong>
              </TableCell>
              <TableCell align="center">
                <strong>Edit</strong>
              </TableCell>
              <TableCell align="center">
                <strong>Delete</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {blocks.map((block) => (
              <TableRow key={block.block_id}>
                <TableCell>{block.block_name}</TableCell>
                <TableCell>{block.hud_name}</TableCell>
                <TableCell align="center">
                  <IconButton sx={{ color: "blue" }} onClick={() => handleEditClick(block)}>
                    <EditIcon />
                  </IconButton>
                </TableCell>
                <TableCell align="center">
                  <IconButton sx={{ color: "red" }} onClick={() => handleDelete(block.block_id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Add Block Dialog */}
        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>Add New Block</DialogTitle>
          <DialogContent>
            <TextField
              label="Block Name"
              fullWidth
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              margin="dense"
              autoFocus
            />
            <Select
              fullWidth
              value={selectedHud}
              onChange={(e) => setSelectedHud(e.target.value)}
              displayEmpty
              sx={{ mt: 2 }}
            >
              <MenuItem value="" disabled>
                Select HUD
              </MenuItem>
              {filteredHuds.map((hud) => (
                <MenuItem key={hud.hud_id} value={hud.hud_id}>
                  {hud.hud_name} ({hud.hud_id})
                </MenuItem>
              ))}
            </Select>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAdd}>
              Add
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Block Dialog */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
          <DialogTitle>Edit Block</DialogTitle>
          <DialogContent>
            <TextField
              label="Block Name"
              fullWidth
              value={editBlockName}
              onChange={(e) => setEditBlockName(e.target.value)}
              margin="dense"
              autoFocus
            />
            <Select
              fullWidth
              value={editSelectedHud}
              onChange={(e) => setEditSelectedHud(e.target.value)}
              displayEmpty
              sx={{ mt: 2 }}
            >
              <MenuItem value="" disabled>
                Select HUD
              </MenuItem>
              {filteredHuds.map((hud) => (
                <MenuItem key={hud.hud_id} value={hud.hud_id}>
                  {hud.hud_name} ({hud.hud_id})
                </MenuItem>
              ))}
            </Select>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleEditSave}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
