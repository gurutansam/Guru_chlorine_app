import React, { useEffect, useState } from "react";
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
  Card,
  CardContent,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { ToastContainer, toast } from "react-toastify";
import { Edit, Delete, Visibility, VisibilityOff } from "@mui/icons-material";
import "react-toastify/dist/ReactToastify.css";

export default function VillageOfficerAdd() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [officers, setOfficers] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [villages, setVillages] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    phone_number: "",
    password: "",
    block_id: "",
    user_id: "",
    hud_id: "",
    hud_name: "",
  });

  // Fetch logged-in user's HUD info
  useEffect(() => {
    const fetchLoggedInUser = async () => {
      const username = localStorage.getItem("loggedInUsername");
      if (!username) return;
      try {
        const res = await fetch("http://localhost:3000/dashboard/hud-master-users");
        const data = await res.json();
        const matched = data.find((u) => u.username === username);
        setUser(matched || null);
      } catch (err) {
        console.error("Error fetching HUD master users:", err);
      }
    };
    fetchLoggedInUser();
  }, []);

  // Fetch blocks filtered by HUD
  useEffect(() => {
    if (user?.hud_id) {
      fetchBlocks();
    }
  }, [user]);

  // Fetch villages and officers after blocks are loaded
  useEffect(() => {
    if (blocks.length > 0) {
      fetchVillages();
      fetchOfficers();
    }
  }, [blocks]);

  // Fetch blocks filtered by HUD ID
  const fetchBlocks = async () => {
    try {
      const res = await fetch(`http://localhost:3000/dashboard/hud-blocks`);
      if (!res.ok) throw new Error("Failed to fetch blocks");
      const data = await res.json();
      const filteredBlocks = data.filter((b) => b.hud_id === user.hud_id);
      setBlocks(filteredBlocks);
    } catch (err) {
      console.error(err);
      setBlocks([]);
    }
  };

  // Fetch villages filtered by block IDs
  const fetchVillages = async () => {
    try {
      const res = await fetch(`http://localhost:3000/dashboard/village`);
      if (!res.ok) throw new Error("Failed to fetch villages");
      const data = await res.json();
      const blockIds = blocks.map((b) => b.block_id);
      const filteredVillages = data.filter((v) => blockIds.includes(v.block_id));
      setVillages(filteredVillages);
    } catch (err) {
      console.error(err);
      setVillages([]);
    }
  };

  // Fetch officers filtered by HUD ID
  const fetchOfficers = async () => {
    try {
      const blocksRes = await fetch("http://localhost:3000/dashboard/hud-blocks");
      if (!blocksRes.ok) throw new Error("Failed to fetch blocks");
      const blocksData = await blocksRes.json();

      const blockToHudMap = {};
      blocksData.forEach((block) => {
        blockToHudMap[block.block_id] = {
          hud_id: block.hud_id,
          hud_name: block.hud_name || "",
        };
      });

      const res = await fetch("http://localhost:3000/dashboard/village-user");
      if (!res.ok) throw new Error("Failed to fetch officers");
      const data = await res.json();

      const officersWithHud = data.map((officer) => ({
        ...officer,
        hud_id: blockToHudMap[officer.block_id]?.hud_id || "",
        hud_name: blockToHudMap[officer.block_id]?.hud_name || "",
      }));

      const filteredOfficers = officersWithHud.filter(
        (o) => o.hud_id === user.hud_id
      );

      setOfficers(filteredOfficers);
    } catch (err) {
      console.error(err);
      setOfficers([]);
    }
  };

  // Open Add dialog
  const handleOpenAdd = () => {
    if (!user) {
      toast.error("HUD info not loaded yet");
      return;
    }
    setNewUser({
      username: "",
      email: "",
      phone_number: "",
      password: "",
      block_id: "",
      user_id: "",
      hud_id: user.hud_id,
      hud_name: user.hud_name,
    });
    setEditMode(false);
    setOpen(true);
  };

  // Add or update officer
  const handleAdd = async () => {
    const block = blocks.find((b) => b.block_id === newUser.block_id);
    if (!block) {
      toast.error("Please select valid block");
      return;
    }

    const payload = {
      username: newUser.username,
      email: newUser.email,
      phone_number: newUser.phone_number,
      password: newUser.password,
      block_id: newUser.block_id,
      hud_id: newUser.hud_id,
      hud_name: newUser.hud_name,
    };

    try {
      const url = editMode
        ? `http://localhost:3000/dashboard/village-users/${newUser.user_id}`
        : "http://localhost:3000/dashboard/village-user";
      const method = editMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to submit");
      toast.success(`Health Inspector ${editMode ? "updated" : "added"}`);
      await fetchOfficers();
      handleClose();
    } catch (err) {
      toast.error("Error submitting user");
    }
  };

  // Edit officer
  const handleEdit = (officer) => {
    setEditMode(true);
    setNewUser({
      user_id: officer.user_id,
      username: officer.username,
      email: officer.email,
      phone_number: officer.phone_number,
      password: "",
      block_id: officer.block_id,
      hud_id: officer.hud_id,
      hud_name: officer.hud_name,
    });
    setOpen(true);
  };

  // Delete officer
  const handleDelete = async (user_id) => {
    if (!window.confirm("Are you sure you want to delete this officer?")) return;
    try {
      const res = await fetch(
        `http://localhost:3000/dashboard/village-users/${user_id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Health Inspector deleted");
      await fetchOfficers();
    } catch (err) {
      toast.error("Error deleting user");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEditMode(false);
    setShowPassword(false);
    setNewUser({
      username: "",
      email: "",
      phone_number: "",
      password: "",
      block_id: "",
      user_id: "",
      hud_id: "",
      hud_name: "",
    });
  };

  return (
    <DashboardLayout>
      <Box sx={{ paddingLeft: "67px", paddingTop: "150px" }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
          {user?.hud_name?.toUpperCase() || "HUD"} - Health Inspector
        </Typography>

        <Card>
          <CardContent>
            <Button variant="contained" sx={{ mt: 2 }} onClick={handleOpenAdd}>
              Add Health Inspector
            </Button>
          </CardContent>
        </Card>

        <Box sx={{ mt: 4, height: 400 }}>
          <DataGrid
            rows={officers.map((o, i) => ({ id: i + 1, ...o }))}
            columns={[
              { field: "username", headerName: "Username", flex: 1 },
              { field: "email", headerName: "Email", flex: 1 },
              { field: "phone_number", headerName: "Phone", flex: 1 },
              { field: "block_name", headerName: "Block", flex: 1 },
              { field: "hud_name", headerName: "HUD", flex: 1 },
              {
                field: "actions",
                headerName: "Actions",
                flex: 1,
                renderCell: (params) => (
                  <>
                    <IconButton onClick={() => handleEdit(params.row)}>
                      <Edit />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(params.row.user_id)}>
                      <Delete />
                    </IconButton>
                  </>
                ),
              },
            ]}
            pageSize={5}
            rowsPerPageOptions={[5]}
          />
        </Box>

        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
          <DialogTitle>{editMode ? "Edit" : "Add"} Health Inspector</DialogTitle>
          <DialogContent dividers>
            <FormControl fullWidth margin="dense">
              <InputLabel>Select Block</InputLabel>
              <Select
                name="block_id"
                value={newUser.block_id}
                onChange={(e) =>
                  setNewUser({ ...newUser, block_id: e.target.value })
                }
              >
                {blocks.map((b) => (
                  <MenuItem key={b.block_id} value={b.block_id}>
                    {b.block_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              margin="dense"
              label="Username"
              value={newUser.username}
              onChange={(e) =>
                setNewUser({ ...newUser, username: e.target.value })
              }
            />
            <TextField
              fullWidth
              margin="dense"
              label="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <TextField
              fullWidth
              margin="dense"
              label="Phone"
              value={newUser.phone_number}
              onChange={(e) =>
                setNewUser({ ...newUser, phone_number: e.target.value })
              }
            />

            <TextField
              fullWidth
              margin="dense"
              label="Password"
              type={showPassword ? "text" : "password"}
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleAdd}>
              {editMode ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </Dialog>

        <ToastContainer position="top-right" autoClose={3000} />
      </Box>
    </DashboardLayout>
  );
}
