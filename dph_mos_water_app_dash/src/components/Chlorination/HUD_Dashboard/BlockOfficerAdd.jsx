import React, { useEffect, useState, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "./DashboardLayout";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

// Put your API base here (single place to change)
const API_BASE = "http://localhost:3000/dashboard";
// const API_BASE = "http://localhost:3000/dashboard";

const initialForm = {
  user_id: "",
  username: "",
  email: "",
  phone_number: "",
  password: "",
  hud_id: "",
  hud_name: "",
  block_id: "",
  block_name: "",
  module: "chlorination",
  role: "block_user",
  // designation: "",   
  status: "Active",
};


export default function ChlHudBlockUserTable() {
  const [users, setUsers] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [hudId, setHudId] = useState("");
  const [hudName, setHudName] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // keep abort controllers refs so cleanup can cancel
  const fetchControllers = useRef([]);

  useEffect(() => {
    // only clear queued toasts once on mount
    toast.clearWaitingQueue();
    fetchUserHud();
    return () => {
      // abort any outstanding fetches on unmount
      fetchControllers.current.forEach((c) => c.abort());
      fetchControllers.current = [];
    };
  }, []);

  useEffect(() => {
    if (hudId) {
      fetchBlocks();
      fetchUsers();
      // ensure form has hud values when hudId becomes known
      setForm((f) => ({ ...f, hud_id: hudId, hud_name: hudName }));
    }

  }, [hudId]);

  // Add this useEffect to monitor users and blocks state changes
  useEffect(() => {
    console.log('Users state changed:', users);
  }, [users]);

  useEffect(() => {
    console.log('Blocks state changed:', blocks);
  }, [blocks]);

  useEffect(() => {
    console.log('HUD ID/Name changed:', { hudId, hudName });
  }, [hudId, hudName]);

  /* -------------------------
     Helper: safeJson
     Tries to parse JSON, but returns null on empty content (204 or no body).
     ------------------------- */
  const safeJson = async (res) => {
    const contentType = res.headers.get("content-type");
    if (!contentType) return null;
    if (contentType.includes("application/json")) {
      return await res.json();
    }
    // non-json body (maybe text or empty)
    try {
      const text = await res.text();
      return text ? { message: text } : null;
    } catch {
      return null;
    }
  };

  /* -------------------------
     Fetch HUD user (who is logged in) - sets hudId/hudName
     ------------------------- */
  async function fetchUserHud() {
    const loggedInUsername = localStorage.getItem("loggedInUsername");
    console.log('Logged in username:', loggedInUsername); // Check if username exists

    if (!loggedInUsername) return;

    const controller = new AbortController();
    fetchControllers.current.push(controller);

    try {
      console.log('Fetching HUD users from:', `${API_BASE}/hud-master-users`);
      const res = await fetch(`${API_BASE}/hud-master-users`, { signal: controller.signal });

      console.log('HUD users response status:', res.status);

      if (!res.ok) {
        console.error("Failed to fetch HUD users", res.status);
        return;
      }

      const list = await res.json();
      console.log('All HUD users:', list);

      const user = list.find((u) => u.username === loggedInUsername);
      console.log('Found current user:', user);

      if (user) {
        setHudId(user.hud_id);
        setHudName(user.hud_name);
        setForm((f) => ({ ...f, hud_id: user.hud_id, hud_name: user.hud_name }));
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error fetching HUD user:", err);
      }
    }
  }

  /* -------------------------
     Fetch Blocks for HUD
     ------------------------- */
  async function fetchBlocks() {
    setLoadingBlocks(true);
    const controller = new AbortController();
    fetchControllers.current.push(controller);

    try {
      console.log('Fetching blocks from:', `${API_BASE}/hud-blocks`);
      const res = await fetch(`${API_BASE}/hud-blocks`, { signal: controller.signal });

      console.log('Blocks response status:', res.status);

      if (!res.ok) {
        console.error("Failed to fetch blocks:", res.status);
        toast.error("Failed to load blocks");
        setBlocks([]);
        return;
      }

      const data = await res.json();
      console.log('Raw blocks data:', data);

      const filtered = data.filter((b) => b.hud_id === hudId);
      console.log('Filtered blocks:', filtered);

      setBlocks(filtered);
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error fetching blocks:", err);
        toast.error("Network error while loading blocks");
      }
    } finally {
      setLoadingBlocks(false);
    }
  }

  /* -------------------------
     Fetch Users for HUD
     ------------------------- */
  async function fetchUsers() {
    setLoadingUsers(true);
    const controller = new AbortController();
    fetchControllers.current.push(controller);

    try {
      console.log('Fetching users from:', `${API_BASE}/block-users`); // Log the URL being called
      const res = await fetch(`${API_BASE}/block-users`, { signal: controller.signal });

      console.log('Response status:', res.status); // Log the response status

      if (!res.ok) {
        console.error("Failed to fetch block users:", res.status);
        toast.error("Failed to load users");
        setUsers([]);
        return;
      }
      const data = await res.json();
      console.log('Raw API response data:', data); // Log raw data

      const filtered = data.filter((u) => u.hud_id === hudId);
      console.log('Filtered users:', filtered); // Log filtered data

      setUsers(filtered);
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error fetching block users:", err);
        toast.error("Network error while loading users");
      }
    } finally {
      setLoadingUsers(false);
    }
  }

  /* -------------------------
     Input handling + validation (trim inputs)
     ------------------------- */
  const handleChange = (e) => {
    const { name } = e.target;
    let value = e.target.value;

    // keep phone as digits only (optional)
    if (name === "phone_number") {
      value = value.replace(/\D/g, "");
    }

    // trim live for some fields
    const trimmed = ["username", "email"].includes(name) ? value.trimStart() : value;

    let updatedForm = { ...form, [name]: trimmed };

    if (name === "block_id") {
      const selectedBlock = blocks.find((b) => b.block_id === value);
      updatedForm.block_name = selectedBlock ? selectedBlock.block_name : "";
    }

    // Basic validations
    const newErrors = { ...errors };
    if (name === "phone_number") {
      if (trimmed && trimmed.length !== 10) {
        newErrors.phone_number = "Phone number must be exactly 10 digits";
      } else {
        newErrors.phone_number = "";
      }
    } else if (name === "email") {
      if (trimmed && !/\S+@\S+\.\S+/.test(trimmed)) {
        newErrors.email = "Invalid email format";
      } else {
        newErrors.email = "";
      }
    } else {
      // clear field-specific error on change
      newErrors[name] = "";
    }

    setErrors(newErrors);
    setForm(updatedForm);
  };

  /* -------------------------
     Submit (POST or PUT)
     - when editing: PUT to /block-users/:id
     - when creating: POST to /block-users
     - do not send empty password when editing
     ------------------------- */
  const handleSubmit = async () => {
    // client-side required validation
    const required = ["username", "email", "phone_number", "block_id"];
    for (const r of required) {
      if (!form[r] || (typeof form[r] === "string" && form[r].trim() === "")) {
        toast.error("Please fill all required fields");
        return;
      }
    }
    if (errors.email || errors.phone_number) {
      toast.error("Please fix validation errors");
      return;
    }

    setSubmitting(true);
    const controller = new AbortController();
    fetchControllers.current.push(controller);

    const isEdit = Boolean(editingUser);
    const url = isEdit ? `${API_BASE}/block-users/${editingUser.user_id}` : `${API_BASE}/block-users`;
    const method = isEdit ? "PUT" : "POST";

    // Prepare payload. If editing and password is empty -> remove password field
    const payload = { ...form };
    // ensure trimmed values
    payload.username = (payload.username || "").trim();
    payload.email = (payload.email || "").trim();
    payload.phone_number = (payload.phone_number || "").trim();

    if (isEdit && (!payload.password || payload.password.trim() === "")) {
      delete payload.password;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await safeJson(res); // maybe contains message
        toast.success(isEdit ? "User updated successfully" : "User added successfully");
        await fetchUsers();
        handleClose();
      } else {
        const parsed = await safeJson(res);
        console.error(`Error saving user (${method} ${url}):`, parsed || { status: res.status });
        toast.error((parsed && parsed.message) || `Failed to save user (${res.status})`);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Network error while saving user:", err);
        toast.error("Network error while saving user");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------
     Edit handler: open dialog and populate form
     ------------------------- */
  const handleEdit = (user) => {
    setEditingUser(user);
    // copy user into form but ensure password is blank for security
    setForm({ ...initialForm, ...user, password: "" });
    setOpen(true);
  };

  /* -------------------------
     Delete handler
     ------------------------- */
  const handleDelete = async (user_id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    const controller = new AbortController();
    fetchControllers.current.push(controller);

    try {
      const res = await fetch(`${API_BASE}/block-users/${user_id}`, {
        method: "DELETE",
        signal: controller.signal,
      });
      if (res.ok) {
        toast.success("User deleted");
        await fetchUsers();
      } else {
        const parsed = await safeJson(res);
        console.error("Failed to delete user:", parsed || res.status);
        toast.error((parsed && parsed.message) || "Failed to delete user");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error deleting user:", err);
        toast.error("Network error while deleting user");
      }
    }
  };

  /* -------------------------
     Close dialog & reset
     ------------------------- */
  const handleClose = () => {
    setForm({ ...initialForm, hud_id: hudId, hud_name: hudName });
    setEditingUser(null);
    setOpen(false);
    setErrors({});
    setShowPassword(false);
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setForm({ ...initialForm, hud_id: hudId, hud_name: hudName });
    setErrors({});
    setOpen(true);
  };

  const togglePasswordVisibility = () => {
    setShowPassword((s) => !s);
  };

  const columns = [
    { field: "username", headerName: "Username", width: 180 },
    { field: "email", headerName: "Email", width: 220 },
    { field: "phone_number", headerName: "Phone", width: 150 },
    { field: "hud_name", headerName: "HUD", width: 150 },
    { field: "block_name", headerName: "Block", width: 180 },
    //  { field: "designation", headerName: "Designation", width: 200 },
    {
      field: "actions",
      headerName: "Actions",
      width: 160,
      sortable: false,
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
            {hudName ? `${hudName.toUpperCase()} – BLOCK USERS` : "BLOCK USERS"}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
            Add Block User
          </Button>
        </Box>

        <DataGrid
          rows={users}
          columns={columns}
          getRowId={(row) => row.user_id}
          autoHeight
          pageSize={5}
          rowsPerPageOptions={[5, 10]}
          loading={loadingUsers}
        />

        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
          <DialogTitle>{editingUser ? "Edit Block User" : "Add Block User"}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Username"
              name="username"
              value={form.username}
              onChange={handleChange}
              margin="dense"
              required
            />
            <TextField
              fullWidth
              label="Email"
              name="email"
              value={form.email}
              onChange={handleChange}
              margin="dense"
              required
              error={!!errors.email}
              helperText={errors.email}
            />
            <TextField
              fullWidth
              label="Phone Number"
              name="phone_number"
              value={form.phone_number}
              onChange={handleChange}
              margin="dense"
              required
              error={!!errors.phone_number}
              helperText={errors.phone_number}
              inputProps={{ maxLength: 10 }}
            />
            {/* <TextField
              select
              fullWidth
              label="Designation"
              name="designation"
              value={form.designation}
              onChange={handleChange}
              margin="dense"
              required
            >
              <MenuItem value="BMO">BMO</MenuItem>
              <MenuItem value="BHS">BHS</MenuItem>
              <MenuItem value="MO">MO</MenuItem>
              <MenuItem value="HI">HI</MenuItem>
              <MenuItem value="MTM HI">MTM HI</MenuItem>
            </TextField> */}

            <TextField
              fullWidth
              label={editingUser ? "Password (leave blank to keep)" : "Password"}
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              margin="dense"
              required={!editingUser}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={togglePasswordVisibility} edge="end" size="large">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              select
              fullWidth
              label="Block"
              name="block_id"
              value={form.block_id}
              onChange={handleChange}
              margin="dense"
              required
              disabled={loadingBlocks}
            >
              {blocks.map((block) => (
                <MenuItem key={block.block_id} value={block.block_id}>
                  {block.block_name} ({block.block_id})
                </MenuItem>
              ))}
            </TextField>

            {/* hud_id and hud_name are hidden but stored in form */}
            <input type="hidden" name="hud_id" value={form.hud_id} />
            <input type="hidden" name="hud_name" value={form.hud_name} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (editingUser ? "Updating..." : "Adding...") : editingUser ? "Update" : "Add"}
            </Button>
            <ToastContainer position="top-right" autoClose={13000} hideProgressBar />
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
