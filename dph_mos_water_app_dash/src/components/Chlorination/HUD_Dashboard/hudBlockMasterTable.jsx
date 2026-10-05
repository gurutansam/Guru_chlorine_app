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
import DashboardLayout from "./DashboardLayout";

export default function BlockMasterTable() {
  const [blocks, setBlocks] = useState([]);
  const [huds, setHuds] = useState([]);
  const [open, setOpen] = useState(false);
  const [blockName, setBlockName] = useState("");
  const [selectedHud, setSelectedHud] = useState("");
  const [loggedInHudId, setLoggedInHudId] = useState("");
  const [editingBlock, setEditingBlock] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (user?.hud_id) setLoggedInHudId(user.hud_id);
  }, []);

  useEffect(() => {
    if (loggedInHudId) {
      fetchBlocks();
      fetchHuds();
    }
  }, [loggedInHudId]);

  const fetchBlocks = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/hud-blocks");
      const data = await res.json();
      setBlocks(data.filter((b) => b.hud_id === loggedInHudId));
    } catch (err) {
      console.error("Failed to fetch blocks:", err);
    }
  };

  const fetchHuds = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/hud");
      const data = await res.json();
      setHuds(data);
    } catch (err) {
      console.error("Failed to fetch HUDs:", err);
    }
  };

  const handleAddOrUpdate = async () => {
    if (!blockName.trim() || !selectedHud) return;
    const hud = huds.find((h) => h.hud_id === selectedHud);
    if (!hud) return;

    try {
      const url = editingBlock
        ? `http://localhost:3000/dashboard/hud-blocks/${editingBlock}`
        : "http://localhost:3000/dashboard/hud-blocks";
      const method = editingBlock ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_name: blockName.trim(),
          hud_id: hud.hud_id,
          hud_name: hud.hud_name,
        }),
      });

      if (!res.ok) throw new Error("Failed to save block");
      fetchBlocks();
      setBlockName("");
      setSelectedHud("");
      setEditingBlock(null);
      setOpen(false);
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleEdit = (block) => {
    setBlockName(block.block_name);
    setSelectedHud(block.hud_id);
    setEditingBlock(block.block_id);
    setOpen(true);
  };

  const handleDelete = async (block_id) => {
    if (!window.confirm("Are you sure you want to delete this block?")) return;
    try {
      const res = await fetch(`http://localhost:3000/dashboard/hud-blocks/${block_id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete block");
      fetchBlocks();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, paddingTop: 20, paddingLeft: 10 }}>
        <Typography variant="h5" mb={2}>HUD-Block Master Table</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>Add Block</Button>

        <Table sx={{ mt: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell><strong>Block ID</strong></TableCell>
              <TableCell><strong>Block Name</strong></TableCell>
              <TableCell><strong>HUD ID</strong></TableCell>
              <TableCell><strong>HUD Name</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {blocks.map((block) => (
              <TableRow key={block.block_id}>
                <TableCell>{block.block_id}</TableCell>
                <TableCell>{block.block_name}</TableCell>
                <TableCell>{block.hud_id}</TableCell>
                <TableCell>{block.hud_name}</TableCell>
                <TableCell>
                  <IconButton
                    color="primary"
                    onClick={() => handleEdit(block)}
                    title="Edit"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => handleDelete(block.block_id)}
                    title="Delete"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>{editingBlock ? "Edit Block" : "Add New Block"}</DialogTitle>
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
              <MenuItem value="" disabled>Select HUD</MenuItem>
              {huds
                .filter((h) => h.hud_id === loggedInHudId)
                .map((hud) => (
                  <MenuItem key={hud.hud_id} value={hud.hud_id}>
                    {hud.hud_name} ({hud.hud_id})
                  </MenuItem>
                ))}
            </Select>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setOpen(false);
              setEditingBlock(null);
              setBlockName("");
              setSelectedHud("");
            }}>Cancel</Button>
            <Button variant="contained" onClick={handleAddOrUpdate}>
              {editingBlock ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
