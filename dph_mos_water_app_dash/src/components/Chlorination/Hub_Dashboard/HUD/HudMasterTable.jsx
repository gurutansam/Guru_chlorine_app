import React, { useState, useEffect } from 'react';
import DashboardLayout from "../DashboardLayout";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Typography, Table, TableHead, TableRow, TableCell, TableBody, IconButton
} from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

export default function HudMasterTable() {
  const [huds, setHuds] = useState([]);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [hudName, setHudName] = useState("");
  const [selectedHudId, setSelectedHudId] = useState(null);
  const [hubId, setHubId] = useState("");
  const [hubName, setHubName] = useState("");

  useEffect(() => {
    fetchUserHub();
  }, []);

  useEffect(() => {
    if (hubId) fetchHuds();
  }, [hubId]);

  const fetchUserHub = async () => {
    const loggedInUsername = localStorage.getItem("loggedInUsername");
    if (!loggedInUsername) return;

    try {
      const res = await fetch("http://localhost:3000/dashboard/chl-hubusers");
      const users = await res.json();
      const user = users.find((u) => u.username === loggedInUsername);

      if (user) {
        setHubId(user.hub_id);
        setHubName(user.hub_name);
      }
    } catch (err) {
      console.error("Error fetching user hub:", err);
    }
  };

  const fetchHuds = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/hud");
      const allData = await res.json();
      const filtered = allData.filter((hud) => hud.hub_id === hubId);
      setHuds(filtered);
    } catch (err) {
      console.error("Error fetching HUDs:", err);
    }
  };

  const handleAddOrEdit = async () => {
    if (!hudName.trim()) return;

    try {
      const url = editMode
        ? `http://localhost:3000/dashboard/hud/${selectedHudId}`
        : "http://localhost:3000/dashboard/hud";
      const method = editMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hud_name: hudName.trim(),
          hub_id: hubId,
          hub_name: hubName
        }),
      });

      if (!res.ok) throw new Error("Failed to save HUD");

      await fetchHuds();
      setHudName("");
      setEditMode(false);
      setOpen(false);
    } catch (err) {
      alert("Failed: " + err.message);
    }
  };

  const handleEditClick = (hud) => {
    setHudName(hud.hud_name);
    setSelectedHudId(hud.hud_id);
    setEditMode(true);
    setOpen(true);
  };

  const handleDelete = async (hudId) => {
    if (!window.confirm("Are you sure you want to delete this HUD?")) return;

    try {
      const res = await fetch(`http://localhost:3000/dashboard/hud/${hudId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete HUD");

      await fetchHuds();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, paddingTop: 20, paddingLeft: 10 }}>
        <Typography variant="h5" mb={2}>
          {hubName ? `${hubName.toUpperCase()} – HUD MASTER TABLE` : "HUD MASTER TABLE"}
        </Typography>

        <Button variant="contained" onClick={() => {
          setHudName("");
          setEditMode(false);
          setOpen(true);
        }}>
          Add HUD
        </Button>

        <Table sx={{ mt: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell><strong>HUD Name</strong></TableCell>
              <TableCell><strong>Edit</strong></TableCell>
              <TableCell><strong>Delete</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {huds.map((row) => (
              <TableRow key={row.hud_id}>
                <TableCell>{row.hud_name}</TableCell>
                <TableCell>
                  <IconButton color="primary" onClick={() => handleEditClick(row)}>
                    <EditIcon />
                  </IconButton>
                </TableCell>
                <TableCell>
                  <IconButton color="error" onClick={() => handleDelete(row.hud_id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>


        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>{editMode ? "Edit HUD" : "Add New HUD"}</DialogTitle>
          <DialogContent>
            <TextField
              label="HUD Name"
              fullWidth
              value={hudName}
              onChange={(e) => setHudName(e.target.value)}
              margin="dense"
              autoFocus
            />
            {/* <TextField label="Hub ID" value={hubId} fullWidth margin="dense" disabled />
            <TextField label="Hub Name" value={hubName} fullWidth margin="dense" disabled /> */}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAddOrEdit}>
              {editMode ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
