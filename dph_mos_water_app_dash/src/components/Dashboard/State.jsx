import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Box, Typography, Button, Stack, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions, FormControl,
  InputLabel, Select, MenuItem, CircularProgress, IconButton
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Search as SearchIcon, Edit as EditIcon, Delete as DeleteIcon } from "@mui/icons-material";
import AddIcon from "@mui/icons-material/Add";

const UserStats = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    username: "",
    password: "",
    district_code: "",
    email: "",
    phone_number: "",
    status: "Active",
  });
  const [editUser, setEditUser] = useState(null);
  const [errors, setErrors] = useState({
    email: "",
    password: "",
    district: "",
    phone_number: ""
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [districtsRes, usersRes] = await Promise.all([
          fetch('http://localhost:3000/dashboard/mos-district'),
          fetch('http://localhost:3000/dashboard/district-officers')
        ]);

        const districtsData = await districtsRes.json();
        const usersData = await usersRes.json();

        setDistricts(districtsData);
        setUsers(usersData);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDistrictChange = async (e) => {
    const district_code = e.target.value;
    if (!district_code) {
      setForm(prev => ({ ...prev, district_code: "", user_id: "" }));
      return;
    }

    try {
      const district = districts.find(d => d.district_code === district_code);
      if (!district) {
        setErrors(prev => ({ ...prev, district: 'Invalid district selected' }));
        return;
      }

      const response = await fetch(`http://localhost:3000/dashboard/officer-count?district=${encodeURIComponent(district_code)}`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch officer count');

      const data = await response.json();
      const count = data.count || 0;
      const districtPrefix = district.district_name.substring(0, 4).toUpperCase();
      const user_id = `HUD${districtPrefix}USR${String(count + 1).padStart(3, '0')}`;

      setForm(prev => ({
        ...prev,
        district_code,
        user_id,
      }));
      setErrors(prev => ({ ...prev, district: "" }));
    } catch (err) {
      console.error('Error generating user ID:', err);
      setErrors(prev => ({
        ...prev,
        district: 'Failed to generate user ID. Please try again.'
      }));
    }
  };

  const validatePassword = (value) => {
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/.test(value)) {
      return 'Password must be 8+ chars with 1 uppercase, 1 number, 1 special char';
    }
    return "";
  };

  // Phone number validation (10 digits, starts with 6-9)
  const validatePhoneNumber = (value) => {
    if (!/^[6-9]\d{9}$/.test(value)) {
      return "Enter a valid 10-digit phone number";
    }
    return "";
  };

  const validateEmail = (value) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(value)) return "Enter a valid email address";
    return "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (name === 'email') {
      setErrors(prev => ({ ...prev, email: validateEmail(value) }));
    }
    if (name === 'password') {
      setErrors(prev => ({ ...prev, password: validatePassword(value) }));
    }
    if (name === 'phone_number') {
      setErrors(prev => ({ ...prev, phone_number: validatePhoneNumber(value) }));
    }
  };

  // For edit dialog
  const handleEditUserChange = (e) => {
    const { name, value } = e.target;
    setEditUser(prev => ({ ...prev, [name]: value }));
    if (name === 'email') {
      setErrors(prev => ({ ...prev, email: validateEmail(value) }));
    }
    if (name === 'phone_number') {
      setErrors(prev => ({ ...prev, phone_number: validatePhoneNumber(value) }));
    }
  };

  const handleSubmit = async () => {
    if (errors.password || !form.district_code || !form.username || !form.password || !form.email) {
      return;
    }


    const { user_id, ...formWithoutUserId } = form;

    const payload = {
      ...formWithoutUserId,
      role: "district_user",
      module: "mosquito",
    };


    try {
      const response = await fetch('http://localhost:3000/dashboard/add-district-officer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add officer');
      }

      const newUser = await response.json();
      setUsers(prev => [...prev, newUser]);
      setOpen(false);
      setForm({
        user_id: "",
        username: "",
        password: "",
        district_code: "",
        email: "",
        phone_number: "",
        status: "Active",
      });
      setErrors({ password: "", district: "", email: "", phone_number: "" });

    } catch (err) {
      console.error("Submission error:", err);
      alert("Error submitting user data");
    }
  };

  // Edit handler
  const handleEdit = (user) => {
    setEditUser({ ...user, password: "" }); // Don't prefill password
    setEditOpen(true);
  };

  // Save edit
  const handleEditSave = async () => {
    try {
      const payload = {
        username: editUser.username,
        phone_number: editUser.phone_number,
        password: editUser.password,
        status: editUser.status,
        email: editUser.email,
      };
      const response = await fetch(`http://localhost:3000/dashboard/update-district-officer/${editUser.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update user");
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === editUser.user_id
            ? { ...u, phone_number: editUser.phone_number, status: editUser.status, email: editUser.email, username: editUser.username }
            : u
        )
      );
      setEditOpen(false);
      setEditUser(null);
    } catch (err) {
      alert("Error updating user");
    }
  };

  // Delete handler
  const handleDelete = async (user) => {
    if (!window.confirm("Are you sure you want to delete this officer?")) return;
    try {
      const response = await fetch(`http://localhost:3000/dashboard/delete-district-officer/${user.user_id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete user");
      setUsers((prev) => prev.filter((u) => u.user_id !== user.user_id));
    } catch (err) {
      alert("Error deleting user");
    }
  };

  return (
    <DashboardLayout>
      <Box mt={4} sx={{ background: "#fff", borderRadius: 3, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", p: 2, pt: 12, pl: 12 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>HUD OFFICERS</Typography>

        <Box display="flex" gap={1} mb={2}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search by ID, Username, or District Code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 220 }}
            InputProps={{ startAdornment: <SearchIcon color="action" /> }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Add Officer'}
          </Button>
        </Box>

        <div style={{ height: 480, width: '100%' }}>
          <DataGrid
            sx={{
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#f5f5f5", // optional: light background
                color: "black",              // dark text
                fontWeight: "1000",         // make it bold
                fontSize: "1rem",
              },
            }}
            rows={users.filter(user =>
              (
                user.username?.toLowerCase().includes(search.toLowerCase()) ||
                user.user_id?.toLowerCase().includes(search.toLowerCase()) ||
                user.district_code?.toLowerCase().includes(search.toLowerCase())
              ) &&
              (statusFilter === "All" || user.status === statusFilter)
            )}

            columns={[
              { field: "user_id", headerName: "Officer ID", width: 200 },
              { field: "username", headerName: "Username", width: 180 },
              { field: "phone_number", headerName: "Phone", width: 150 },
              // { field: "district_code", headerName: "District Code", width: 150 },
              { field: "district_name", headerName: "District Name", width: 200 },
              // { field: "role", headerName: "Role", width: 120 },
              // { field: "module", headerName: "Module", width: 140 },
              { field: "email", headerName: "Email", width: 200 },
              {
                field: "status",
                headerName: "Status",
                width: 120,
                renderCell: (params) => (
                  <Typography color={params.value === "Active" ? "success.main" : "error.main"}>
                    {params.value}
                  </Typography>
                )
              },
              {
                field: "edit",
                headerName: "Edit",
                width: 60,
                sortable: false,
                filterable: false,
                renderCell: (params) => (
                  <IconButton color="primary" onClick={() => handleEdit(params.row)}>
                    <EditIcon />
                  </IconButton>
                )
              },
              {
                field: "delete",
                headerName: "Delete",
                width: 70,
                sortable: false,
                filterable: false,
                renderCell: (params) => (
                  <IconButton color="error" onClick={() => handleDelete(params.row)}>
                    <DeleteIcon />
                  </IconButton>
                )
              }
            ]}
            loading={loading}
            pageSize={5}
            getRowId={(row) => row.user_id}
          />
        </div>

        {/* Add Officer Dialog */}
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add District Officer</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <FormControl fullWidth error={!!errors.district}>
                <InputLabel>District *</InputLabel>
                <Select
                  name="district_code"
                  value={form.district_code}
                  label="District *"
                  onChange={handleDistrictChange}
                  required
                >
                  <MenuItem value="">Select District</MenuItem>
                  {districts.map((district) => (
                    <MenuItem key={district.district_code} value={district.district_code}>
                      {district.district_name} ({district.district_code})
                    </MenuItem>
                  ))}
                </Select>
                {errors.district && <Typography color="error" variant="caption">{errors.district}</Typography>}
              </FormControl>

              <TextField
                label="Officer ID"
                value={form.user_id}
                disabled
                fullWidth
                helperText="Auto-generated based on district"
              />

              <TextField
                label="Username *"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                fullWidth
              />

              <TextField
                label="Email *"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                fullWidth
              />

              <TextField
                label="Password *"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                error={!!errors.password}
                helperText={errors.password}
                required
                fullWidth
              />

              <TextField
                label="Phone Number"
                name="phone_number"
                value={form.phone_number}
                onChange={handleChange}
                error={!!errors.phone_number}
                helperText={errors.phone_number}
                fullWidth
              />

              <TextField
                label="Role"
                value="district_user"
                disabled
                fullWidth
              />

              <TextField
                label="Module"
                value="mosquito"
                disabled
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} color="error">Cancel</Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={
                !form.district_code ||
                !form.username ||
                !form.password ||
                !!errors.password ||
                !!errors.phone_number ||
                !!errors.email
              }
            >
              Add Officer
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Officer Dialog */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit District Officer</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Username"
                name="username"
                value={editUser?.username || ""}
                onChange={handleEditUserChange}
                error={!!errors.username}
                helperText={errors.username}
                fullWidth
              />
              <TextField
                label="Phone Number"
                name="phone_number"
                value={editUser?.phone_number || ""}
                onChange={handleEditUserChange}
                error={!!errors.phone_number}
                helperText={errors.phone_number}
                fullWidth
              />
              <TextField
                label="Email"
                name="email"
                value={editUser?.email || ""}
                onChange={handleEditUserChange}
                error={!!errors.email}
                helperText={errors.email}
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                value={editUser?.password || ""}
                onChange={e => setEditUser(prev => ({ ...prev, password: e.target.value }))}
                helperText="Leave blank to keep current password"
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={editUser?.status || "Active"}
                  label="Status"
                  onChange={handleEditUserChange}
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)} color="error">Cancel</Button>
            <Button
              onClick={handleEditSave}
              variant="contained"
              disabled={!!errors.phone_number || !!errors.email}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
};

export default UserStats;

