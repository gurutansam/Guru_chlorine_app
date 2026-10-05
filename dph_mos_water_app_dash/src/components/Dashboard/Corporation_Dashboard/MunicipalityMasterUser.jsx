import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Typography,
  IconButton,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "./DashboardLayout";
import { toast, ToastContainer } from "react-toastify";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const initialForm = {
  user_id: "",
  username: "",
  email: "",
  phone_number: "",
  password: "",
  role: "municipality_user",
  status: "Active",
  corporation_name: "",
  corporation_id: "",
  district_name: "",
  municipality_name: "",
  municipality_id: "",
};

const MosMunicipalityUserStats = () => {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [corporations, setCorporations] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchCorporations();
    fetchMunicipalities();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mosquito-municipality-master-users");
      const data = await res.json();
      setUsers(data);
    } catch {
      toast.error("Failed to fetch users");
    }
  };

  const fetchCorporations = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mos-corporation");
      const data = await res.json();
      setCorporations(data);
    } catch {
      toast.error("Failed to fetch corporations");
    }
  };

  const fetchMunicipalities = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mos-municipalities");
      const data = await res.json();
      setMunicipalities(data);
    } catch {
      toast.error("Failed to fetch municipalities");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setForm(initialForm);
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    try {
      const url = isEditing
        ? `http://localhost:3000/dashboard/mosquito-municipality-master-users/${form.user_id}`
        : "http://localhost:3000/dashboard/mosquito-municipality-master-users";

      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Operation failed");

      toast.success(isEditing ? "User updated" : "User added");
      handleClose();
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    }
  };

  const handleEdit = (row) => {
    setForm({ ...row, password: "" }); // clear password field on edit
    setIsEditing(true);
    setOpen(true);
  };

  const handleDelete = async (user_id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      const res = await fetch(
        `http://localhost:3000/dashboard/mosquito-municipality-master-users/${user_id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Delete failed");
      }

      toast.success("User deleted successfully");
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Error deleting user");
    }
  };

  const columns = [
    { field: "user_id", headerName: "User ID", width: 180 },
    { field: "username", headerName: "Username", width: 150 },
    { field: "email", headerName: "Email", width: 200 },
    { field: "phone_number", headerName: "Phone", width: 130 },
    { field: "corporation_name", headerName: "Corporation", width: 200 },
    { field: "municipality_name", headerName: "Municipality", width: 200 },
    { field: "district_name", headerName: "District", width: 150 },
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
        <IconButton
          color="error"
          onClick={() => handleDelete(params.row.user_id)}
        >
          <DeleteIcon />
        </IconButton>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <Box p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">Municipality Health Inspectors</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setForm(initialForm);
              setIsEditing(false);
              setOpen(true);
            }}
          >
            Add User
          </Button>
        </Box>
        <div style={{ height: 500, width: "100%" }}>
          <DataGrid
            rows={users}
            columns={columns}
            getRowId={(row) => row.user_id}
            sx={{
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'white',
                color: 'black',
                fontWeight: 'bold',
                fontSize: '1.1rem',
              },
            }}
          />
        </div>
      </Box>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{isEditing ? "Edit User" : "Add User"}</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Username"
            fullWidth
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Email"
            fullWidth
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Phone Number"
            fullWidth
            value={form.phone_number}
            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
          />
          <TextField
            select
            margin="dense"
            label="Corporation"
            fullWidth
            value={form.corporation_name}
            onChange={(e) => {
              const selected = corporations.find(c => c.corporation_name === e.target.value);
              setForm({
                ...form,
                corporation_name: selected?.corporation_name || "",
                corporation_id: selected?._id || "",
                district_name: selected?.district_name || "",
              });
            }}
          >
            {corporations.map((corp) => (
              <MenuItem key={corp._id} value={corp.corporation_name}>
                {corp.corporation_name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            margin="dense"
            label="District"
            fullWidth
            value={form.district_name}
            InputProps={{ readOnly: true }}
          />

          <TextField
            select
            margin="dense"
            label="Municipality"
            fullWidth
            value={form.municipality_name}
            onChange={(e) => {
              const selected = municipalities.find(m => m.municipality_name === e.target.value);
              setForm({
                ...form,
                municipality_name: selected?.municipality_name || "",
                municipality_id: selected?.municipality_id || "",
              });
            }}
          >
            {municipalities
              .filter(m => m.corporation_code === corporations.find(c => c.corporation_name === form.corporation_name)?.corporation_code)
              .map((muni) => (
                <MenuItem key={muni.municipality_id} value={muni.municipality_name}>
                  {muni.municipality_name}
                </MenuItem>
              ))}
          </TextField>

          <TextField
            select
            margin="dense"
            label="Status"
            fullWidth
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <MenuItem value="Active">Active</MenuItem>
            <MenuItem value="Inactive">Inactive</MenuItem>
          </TextField>

          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <TextField
            margin="dense"
            label="Role"
            fullWidth
            value="municipality_user"
            InputProps={{ readOnly: true }}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {isEditing ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      <ToastContainer position="top-center" />
    </DashboardLayout>
  );
};

export default MosMunicipalityUserStats;
