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
  corp_name: "",
  phone_number: "",
  role: "corporation_user",
  district_name: "",
  block_name: "",
  status: "",
  password: "",
  email: "",
};

const CorpUserStats = () => {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [corporations, setCorporations] = useState([]);
  const [blocks, setBlocks] = useState([]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/corp-users");
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
      toast.error("Failed to fetch corporation list");
    }
  };

  const fetchBlocks = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mosquito-blocks");
      const data = await res.json();
      setBlocks(data);
    } catch {
      toast.error("Failed to fetch blocks");
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCorporations();
    fetchBlocks();
  }, []);

  const handleClose = () => {
    setOpen(false);
    setForm(initialForm);
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    try {
      const url = isEditing
        ? `http://localhost:3000/dashboard/update-corp-user/${form.user_id}`
        : "http://localhost:3000/dashboard/add-corp-user";

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
    setForm(row);
    setIsEditing(true);
    setOpen(true);
  };

  const handleDelete = async (user_id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      const res = await fetch(
        `http://localhost:3000/dashboard/delete-corp-user/${user_id}`,
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
    { field: "user_id", headerName: "User ID", width: 200 },
    { field: "username", headerName: "Username", width: 150 },
    { field: "corp_name", headerName: "Corporation", width: 250 },
    { field: "phone_number", headerName: "Phone", width: 130 },
    // { field: "role", headerName: "Role", width: 100 },
    { field: "district_name", headerName: "District", width: 150 },
    { field: "block_name", headerName: "Block", width: 150 },
    { field: "status", headerName: "Status", width: 100 },
    { field: "email", headerName: "Email", width: 200 },
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
          <Typography variant="h6">Corporation Health Inspectors</Typography>
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
                backgroundColor: 'white', // darker color
                color: 'black',              // white text
                fontWeight: 'bold',
                fontSize: '1.1rem',         // bold text
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
            value={form.corp_name}
            onChange={(e) => {
              const selected = corporations.find(
                (c) => c.corporation_name === e.target.value
              );
              setForm({
                ...form,
                corp_name: selected?.corporation_name || "",
                district_name: selected?.district_name || "",
              });
            }}
          >
            {corporations.map((corp, idx) => (
              <MenuItem key={idx} value={corp.corporation_name}>
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
            label="Block"
            fullWidth
            value={form.block_name}
            onChange={(e) => setForm({ ...form, block_name: e.target.value })}
          >
            {blocks.map((block) => (
              <MenuItem key={block.block_code} value={block.block_name}>
                {block.block_name}
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
            value="corporation_user"
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

export default CorpUserStats;
