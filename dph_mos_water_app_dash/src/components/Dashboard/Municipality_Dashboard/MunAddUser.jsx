// MunicipalityUserStats.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "./DashboardLayout";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const MunUserStats = () => {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    username: "",
    password: "",
    phone_number: "",
    email: "",
    municipality_name: "",
    district_name: "",
    role: "municipality_user",
    status: "active",
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mosquito-municipality-collectors");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch users");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm({
      username: "",
      password: "",
      phone_number: "",
      email: "",
      municipality_name: "",
      district_name: "",
      role: "municipality_user",
      status: "active",
    });
    setIsEdit(false);
    setEditingUserId(null);
  };

  const handleSubmit = async () => {
    const url = isEdit
      ? `http://localhost:3000/dashboard/mosquito-municipality-collector/${editingUserId}`
      : "http://localhost:3000/dashboard/mosquito-municipality-collector";

    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Submit failed");

      toast.success(isEdit ? "User updated" : "User added");
      setOpen(false);
      fetchUsers();
      resetForm();
    } catch (err) {
      toast.error("Error submitting user");
    }
  };

  const handleEdit = (user) => {
    setForm({
      username: user.username,
      password: "",
      phone_number: user.phone_number || "",
      email: user.email || "",
      municipality_name: user.municipality_name,
      district_name: user.district_name || "",
      role: user.role,
      status: user.status,
    });
    setEditingUserId(user.user_id);
    setIsEdit(true);
    setOpen(true);
  };

  const handleDelete = async (userId) => {
    const confirm = window.confirm("Are you sure you want to delete this user?");
    if (!confirm) return;

    try {
      const res = await fetch(
        `http://localhost:3000/dashboard/mosquito-municipality-collector/${userId}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) throw new Error("Delete failed");
      toast.success("User deleted");
      fetchUsers();
    } catch (err) {
      toast.error("Error deleting user");
    }
  };

  const columns = [
    { field: "user_id", headerName: "User ID", width: 200 },
    { field: "username", headerName: "Username", width: 150 },
    { field: "phone_number", headerName: "Phone", width: 140 },
    { field: "email", headerName: "Email", width: 200 }, // Added
    { field: "municipality_name", headerName: "Municipality", width: 180 },
    { field: "district_name", headerName: "District", width: 180 },
    { field: "status", headerName: "Status", width: 100 },
    {
      field: "edit",
      headerName: "Edit",
      width: 80,
      renderCell: (params) => (
        <IconButton color="primary" onClick={() => handleEdit(params.row)}>
          <EditIcon />
        </IconButton>
      ),
    },
    {
      field: "delete",
      headerName: "Delete",
      width: 80,
      renderCell: (params) => (
        <IconButton color="error" onClick={() => handleDelete(params.row.user_id)}>
          <DeleteIcon />
        </IconButton>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <ToastContainer />
      <Box p={3}>
        <Typography variant="h6" mb={2} fontWeight={600}>
          MUNICIPALITY INSPECTORS
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
        >
          Add Municipality User
        </Button>
        <Box mt={2}>
          <DataGrid
            rows={users}
            columns={columns}
            getRowId={(row) => row.user_id}
            autoHeight
            sx={{
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#f5f5f5",
                color: "#1a1a1a",
                fontWeight: "bold",
                fontSize: "1.2rem",
              },
              "& .MuiDataGrid-cell": {
                color: "#333",
              },
            }}
          />
        </Box>
        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{isEdit ? "Edit Municipality User" : "Add Municipality User"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Username"
                name="username"
                value={form.username}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="Phone Number"
                name="phone_number"
                value={form.phone_number}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="Email"
                name="email"
                value={form.email}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="District Name"
                name="district_name"
                value={form.district_name}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="Municipality Name"
                name="municipality_name"
                value={form.municipality_name}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="Password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((prev) => !prev)}>
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} color="error">
              Cancel
            </Button>
            <Button onClick={handleSubmit} variant="contained">
              {isEdit ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
};

export default MunUserStats;
