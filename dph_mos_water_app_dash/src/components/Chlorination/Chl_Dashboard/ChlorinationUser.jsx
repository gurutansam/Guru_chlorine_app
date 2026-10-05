import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Box, Typography, Button, Stack, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions, FormControl,
  InputLabel, Select, MenuItem, IconButton, InputAdornment,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

const ChlUserStats = () => {
  const [users, setUsers] = useState([]);
  const [hubsData, setHubsData] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [editableFields, setEditableFields] = useState({ email: false, password: false, phone_number: false });
  const [form, setForm] = useState({
    user_id: "",
    username: "",
    password: "",
    email: "",
    hub_id: "",
    phone_number: "",
    address: "",
    status: "Active",
    role: "hub_officer",
    module: "chlorination",
  });
  const [editUser, setEditUser] = useState(null);

  const hubMap = {
    hub001: "REG001",
    hub002: "REG002",
    hub003: "REG003",
    hub004: "REG004",
  };

  const getDisplayUserId = (userId) => {
    const matchedHub = Object.keys(hubMap).find((hub) => userId.startsWith(hub));
    if (!matchedHub) return userId;
    return userId.replace(matchedHub, hubMap[matchedHub]);
  };

  useEffect(() => {
    fetchUsers();
    fetchHubs();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/chl-hubusers");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      toast.error("Failed to fetch users");
    }
  };

  const fetchHubs = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/hubs-districts");
      const data = await res.json();
      setHubsData(data);
    } catch (err) {
      toast.error("Failed to fetch hubs");
    }
  };

  const validatePassword = (value) =>
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+[\]{};':"\\|,.<>/?]).{8,}$/.test(value);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "hub_id") {
      const userCount = users.filter((u) => u.hub_id === value).length + 1;
      const newUserId = `${value}USR${String(userCount).padStart(3, "0")}`;
      setForm((prev) => ({ ...prev, hub_id: value, user_id: newUserId }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));

    if (name === "password") {
      setPasswordError(
        validatePassword(value)
          ? ""
          : "Password must be 8+ chars, 1 uppercase, 1 number, 1 special char"
      );
    }
  };

  const handleSubmit = async () => {
    if (!validatePassword(form.password)) {
      setPasswordError("Password must be 8+ chars, 1 uppercase, 1 number, 1 special char");
      toast.error("Invalid password format");
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/dashboard/chl-hubusers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      toast.success("User added successfully");
      await fetchUsers();
      setForm({
        user_id: "",
        username: "",
        password: "",
        email: "",
        hub_id: "",
        phone_number: "",
        address: "",
        status: "Active",
        role: "hub_officer",
        module: "chlorination",
      });
      setPasswordError("");
      setOpen(false);
    } catch (err) {
      toast.error("Error submitting user data");
    }
  };

  const handleEditClick = (user) => {
    setEditUser(user);
    setEditableFields({ email: false, password: false, phone_number: false });
    setEditOpen(true);
    setShowPassword(false);
    setPasswordError("");
  };

  const toggleEditable = (field) => {
    setEditableFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditUser((prev) => ({ ...prev, [name]: value }));
    if (name === "password") {
      setPasswordError(
        validatePassword(value)
          ? ""
          : "Password must be 8+ chars, 1 uppercase, 1 number, 1 special char"
      );
    }
  };

  const handleEditSubmit = async () => {
    if (!validatePassword(editUser.password)) {
      setPasswordError("Password must be 8+ chars, 1 uppercase, 1 number, 1 special char");
      toast.error("Invalid password format");
      return;
    }
    try {
      const response = await fetch(`http://localhost:3000/dashboard/chl-hubusers/${editUser.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editUser.email,
          password: editUser.password,
          phone_number: editUser.phone_number,
        }),
      });

      if (!response.ok) throw new Error("Failed to update user");

      toast.success("User updated successfully");
      setEditOpen(false);
      setEditUser(null);
      setPasswordError("");
      await fetchUsers();
    } catch (err) {
      toast.error("Error updating user");
    }
  };

  const handleDelete = async (user_id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        const res = await fetch(`http://localhost:3000/dashboard/chl-hubusers/${user_id}`, {
          method: "DELETE",
        });

        if (!res.ok) throw new Error("Failed to delete user");

        toast.success("User deleted successfully");
        await fetchUsers();
      } catch (err) {
        toast.error("Error deleting user");
      }
    }
  };

  const columns = React.useMemo(() => [
    {
      field: "username",
      headerName: "Username",
      width: 160,
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 600, color: "#0f172a", fontSize: "0.88rem" }}>
          {params.row.username}
        </Typography>
      ),
    },
    { field: "email", headerName: "Email", width: 220 },
    { field: "hub_name", headerName: "RWAL Laboratory", width: 240 },
    { field: "phone_number", headerName: "Phone Number", width: 150 },
    { field: "address", headerName: "Address", width: 220 },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      renderCell: (params) => {
        const isActive = String(params.row.status).toLowerCase() === "active";
        return (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              px: 1.5,
              py: 0.5,
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: 700,
              backgroundColor: isActive ? "#dcfce7" : "#fee2e2",
              color: isActive ? "#15803d" : "#b91c1c",
              border: isActive ? "1px solid #bbf7d0" : "1px solid #fecaca",
            }}
          >
            {params.row.status || "Active"}
          </Box>
        );
      },
    },
    {
      field: "edit",
      headerName: "Edit",
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <IconButton
          onClick={() => handleEditClick(params.row)}
          sx={{
            color: "#64748b",
            "&:hover": {
              color: "#3b82f6",
              backgroundColor: "#eff6ff",
            },
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      ),
    },
    {
      field: "delete",
      headerName: "Delete",
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <IconButton
          onClick={() => handleDelete(params.row.user_id)}
          sx={{
            color: "#64748b",
            "&:hover": {
              color: "#ef4444",
              backgroundColor: "#fef2f2",
            },
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      ),
    },
  ], [users]);

  return (
    <DashboardLayout>
      <ToastContainer position="top-right" autoClose={3000} />

      <Box
        sx={{
          p: 3,
          mx: 2,
          mt: 2,
          mb: 4,
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
        }}
      >
        {/* Header Action Row */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
            pb: 2,
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
              State Users Directory
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5 }}>
              Create, update, and manage RWAL regional user accounts.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
            sx={{
              background: "linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)",
              color: "#fff",
              borderRadius: "10px",
              fontWeight: 600,
              textTransform: "none",
              px: 3,
              py: 1.1,
              boxShadow: "0 4px 12px rgba(27, 67, 50, 0.2)",
              "&:hover": {
                background: "linear-gradient(135deg, #143225 0%, #1B4332 100%)",
                boxShadow: "0 6px 18px rgba(27, 67, 50, 0.35)",
              },
            }}
          >
            Add User
          </Button>
        </Box>

        {/* Data Table */}
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <DataGrid
            rows={users}
            columns={columns}
            getRowId={(row) => row.user_id}
            pageSize={5}
            rowsPerPageOptions={[5, 10, 20]}
            autoHeight
            rowHeight={60}
            sx={{
              border: "none",
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#f8fafc !important",
                color: "#475569",
                fontWeight: 700,
                fontSize: "0.85rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderBottom: "1px solid #e2e8f0",
              },
              "& .MuiDataGrid-row": {
                borderBottom: "1px solid #f1f5f9",
                "&:hover": {
                  backgroundColor: "#f8fafc",
                },
              },
              "& .MuiDataGrid-cell": {
                color: "#334155",
                fontSize: "0.88rem",
                display: "flex",
                alignItems: "center",
              },
              "& .MuiDataGrid-footerContainer": {
                borderTop: "1px solid #e2e8f0",
              },
            }}
          />
        </Box>

        {/* Add User Dialog */}
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          fullWidth
          maxWidth="sm"
          PaperProps={{ sx: { borderRadius: "16px", p: 1 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, pb: 1, color: "#0f172a" }}>
            Add RWAL User
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} mt={1}>
              <FormControl fullWidth size="medium">
                <InputLabel id="hub-label">Regional Water Analysis Laboratory</InputLabel>
                <Select
                  labelId="hub-label"
                  name="hub_id"
                  value={form.hub_id}
                  onChange={handleChange}
                  label="Regional Water Analysis Laboratory"
                  sx={{ borderRadius: "10px" }}
                >
                  <MenuItem value="">
                    <em>Select Laboratory</em>
                  </MenuItem>
                  {hubsData.map((hub) => (
                    <MenuItem key={hub.hub_id} value={hub.hub_id}>
                      {hub.hub_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {form.hub_id && (
                <>
                  <TextField
                    label="Username"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    fullWidth
                    InputProps={{ sx: { borderRadius: "10px" } }}
                  />
                  <TextField
                    label="Email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    fullWidth
                    InputProps={{ sx: { borderRadius: "10px" } }}
                  />
                  <TextField
                    label="Password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={handleChange}
                    error={!!passwordError}
                    helperText={passwordError}
                    fullWidth
                    InputProps={{
                      sx: { borderRadius: "10px" },
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword((prev) => !prev)} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="Phone Number"
                    name="phone_number"
                    value={form.phone_number}
                    onChange={handleChange}
                    inputProps={{ maxLength: 10, inputMode: "numeric" }}
                    error={form.phone_number && form.phone_number.length !== 10}
                    helperText={form.phone_number && form.phone_number.length !== 10 ? "Phone number must be 10 digits" : ""}
                    fullWidth
                    InputProps={{ sx: { borderRadius: "10px" } }}
                  />
                  <TextField
                    label="Address"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    fullWidth
                    InputProps={{ sx: { borderRadius: "10px" } }}
                  />
                  <TextField
                    label="Module"
                    name="module"
                    value={form.module}
                    onChange={handleChange}
                    fullWidth
                    InputProps={{ sx: { borderRadius: "10px" } }}
                  />
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setOpen(false)}
              color="inherit"
              variant="text"
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={!form.user_id}
              sx={{
                bgcolor: "#1B4332",
                color: "#fff",
                textTransform: "none",
                fontWeight: 600,
                borderRadius: "8px",
                "&:hover": { bgcolor: "#2D6A4F" },
              }}
            >
              Create Account
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          fullWidth
          maxWidth="sm"
          PaperProps={{ sx: { borderRadius: "16px", p: 1 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, pb: 1, color: "#0f172a" }}>
            Edit Account
          </DialogTitle>
          <DialogContent>
            {editUser && (
              <Stack spacing={2.5} mt={1}>
                <TextField
                  label="Email"
                  name="email"
                  value={editUser.email}
                  onChange={handleEditChange}
                  type="email"
                  fullWidth
                  InputProps={{
                    sx: { borderRadius: "10px" },
                    readOnly: !editableFields.email,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => toggleEditable("email")} edge="end">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={editUser.password}
                  onChange={handleEditChange}
                  error={!!passwordError}
                  helperText={passwordError}
                  fullWidth
                  InputProps={{
                    sx: { borderRadius: "10px" },
                    readOnly: !editableFields.password,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword((prev) => !prev)} edge="end" sx={{ mr: 0.5 }}>
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                        <IconButton onClick={() => toggleEditable("password")} edge="end">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Phone Number"
                  name="phone_number"
                  value={editUser.phone_number}
                  onChange={handleEditChange}
                  inputProps={{ maxLength: 10, inputMode: "numeric" }}
                  error={editUser.phone_number && editUser.phone_number.length !== 10}
                  helperText={editUser.phone_number && editUser.phone_number.length !== 10 ? "Phone number must be 10 digits" : ""}
                  fullWidth
                  InputProps={{
                    sx: { borderRadius: "10px" },
                    readOnly: !editableFields.phone_number,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => toggleEditable("phone_number")} edge="end">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setEditOpen(false)}
              color="inherit"
              variant="text"
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              variant="contained"
              disabled={!editUser}
              sx={{
                bgcolor: "#1B4332",
                color: "#fff",
                textTransform: "none",
                fontWeight: 600,
                borderRadius: "8px",
                "&:hover": { bgcolor: "#2D6A4F" },
              }}
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
};

export default ChlUserStats;
