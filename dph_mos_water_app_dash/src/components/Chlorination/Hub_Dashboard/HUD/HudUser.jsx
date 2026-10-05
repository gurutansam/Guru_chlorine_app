import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  InputAdornment,
  FormControl,
  InputLabel,
  OutlinedInput,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "../DashboardLayout";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { Visibility, VisibilityOff } from "@mui/icons-material";

const initialForm = {
  user_id: "",
  username: "",
  password: "",
  email: "",
  phone_number: "",
  hud_id: "",
  hud_name: "",
  role: "DHO",
  module: "chlorination",
  status: "Active",
};

export default function HudUserTable() {
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [huds, setHuds] = useState([]);
  const [hubId, setHubId] = useState("");
  const [hubName, setHubName] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchUserHub();
  }, []);

  useEffect(() => {
    if (hubId) {
      (async () => {
        await fetchHUDs();
        await fetchUsers();
      })();
    }
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

  const fetchHUDs = async () => {
    const res = await fetch("http://localhost:3000/dashboard/hud");
    const data = await res.json();
    const filtered = data.filter((h) => h.hub_id === hubId);
    return filtered;
  };

  useEffect(() => {
    if (hubId) {
      (async () => {
        const huds = await fetchHUDs();
        setHuds(huds);
        await fetchUsers(huds);
      })();
    }
  }, [hubId]);

  const fetchUsers = async (filteredHuds = huds) => {
    const res = await fetch("http://localhost:3000/dashboard/hud-master-users");
    const data = await res.json();
    const hudIdsForHub = filteredHuds.map(h => h.hud_id);
    const filtered = data.filter((u) => hudIdsForHub.includes(u.hud_id));
    setUsers(filtered);
    setAllUsers(data);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...form, [name]: value };

    if (name === "hud_id") {
      const selectedHUD = huds.find((h) => h.hud_id === value);
      if (selectedHUD) {
        updatedForm.hud_name = selectedHUD.hud_name;
        updatedForm.user_id = generateUserId(selectedHUD.hud_id, allUsers);
      }
    }

    if (name === "phone_number" && value.length !== 10) {
      setErrors({ ...errors, phone_number: "Phone number must be 10 digits" });
    } else if (name === "email" && !/\S+@\S+\.\S+/.test(value)) {
      setErrors({ ...errors, email: "Invalid email format" });
    } else if (name === "password" && value.length < 4) {
      setErrors({ ...errors, password: "Password must be at least 4 characters" });
    } else {
      setErrors({ ...errors, [name]: "" });
    }

    setForm(updatedForm);
  };

  const generateUserId = (hudId, userList) => {
    const count = userList.filter((u) => u.hud_id === hudId).length + 1;
    return `${hudId}USR${String(count).padStart(3, "0")}`;
  };

  const handleSubmit = async () => {
    const url = editingUser
      ? `http://localhost:3000/dashboard/update-hud-master-user/${editingUser.user_id}`
      : "http://localhost:3000/dashboard/add-hud-master-user";

    const method = editingUser ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      await fetchUsers();
      handleClose();
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setForm(user);
    setOpen(true);
  };

  const handleDelete = async (user_id) => {
    const confirmed = window.confirm("Are you sure to delete this user?");
    if (!confirmed) return;

    await fetch(`http://localhost:3000/dashboard/delete-hud-master-user/${user_id}`, {
      method: "DELETE",
    });

    await fetchUsers();
  };

  const handleClose = () => {
    setForm(initialForm);
    setEditingUser(null);
    setOpen(false);
    setErrors({});
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const columns = [
    { field: "username", headerName: "Username", width: 250 },
    { field: "email", headerName: "Email", width: 200 },
    { field: "phone_number", headerName: "Phone", width: 200 },
    { field: "hud_name", headerName: "HUD", width: 200 },
    { field: "status", headerName: "Status", width: 140 },
    {
      field: "actions",
      headerName: "Actions",
      width: 180,
      renderCell: (params) => (
        <>
          <Tooltip title="Edit">
            <IconButton onClick={() => handleEdit(params.row)} color="primary">
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton onClick={() => handleDelete(params.row.user_id)} color="error">
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <Box p={2} paddingTop={25} paddingLeft={10}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {hubName ? `${hubName.toUpperCase()} – HUD USERS` : "HUD USERS"}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
          >
            Add HUD User
          </Button>
        </Box>

        <DataGrid
          rows={users}
          columns={columns}
          getRowId={(row) => row.user_id}
          autoHeight
        />

        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>{editingUser ? "Edit HUD User" : "Add HUD User"}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Username"
              name="username"
              value={form.username}
              onChange={handleChange}
              margin="dense"
            />

            <FormControl fullWidth margin="dense" variant="outlined">
              <InputLabel htmlFor="password">Password</InputLabel>
              <OutlinedInput
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                error={!!errors.password}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      onClick={togglePasswordVisibility}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                }
                label="Password"
              />
            </FormControl>

            <TextField
              fullWidth
              label="Email"
              name="email"
              value={form.email}
              onChange={handleChange}
              error={!!errors.email}
              helperText={errors.email}
              margin="dense"
            />
            <TextField
              fullWidth
              label="Phone Number"
              name="phone_number"
              value={form.phone_number}
              onChange={handleChange}
              error={!!errors.phone_number}
              helperText={errors.phone_number}
              margin="dense"
            />

            <TextField
              select
              fullWidth
              label="HUD"
              name="hud_id"
              value={form.hud_id}
              onChange={handleChange}
              margin="dense"
            >
              {huds.map((hud) => (
                <MenuItem key={hud.hud_id} value={hud.hud_id}>
                  {hud.hud_name} ({hud.hud_id})
                </MenuItem>
              ))}
            </TextField>
          </DialogContent>

          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained">
              {editingUser ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
