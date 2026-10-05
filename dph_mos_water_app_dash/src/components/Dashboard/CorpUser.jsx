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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "./DashboardLayout";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { IconButton, Tooltip } from "@mui/material";

const initialForm = {
  user_id: "",
  username: "",
  password: "",
  email: "",
  phone_number: "",
  corporation_code: "",
  corporation_name: "",
  district_name: "",
  role: "corporation_user",
  module: "mosquito",
  status: "Active",
};

export default function CorporationUserTable() {
  const [users, setUsers] = useState([]);
  const [corporations, setCorporations] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchCorporations();
  }, []);

  const fetchUsers = async () => {
    const res = await fetch("http://localhost:3000/dashboard/corp-master-users");
    const data = await res.json();
    setUsers(data);
  };

  const fetchCorporations = async () => {
    const res = await fetch("http://localhost:3000/dashboard/mos-corporation");
    const data = await res.json();
    setCorporations(data);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });

    if (e.target.name === "phone_number" && e.target.value.length !== 10) {
      setErrors({ ...errors, phone_number: "Phone number must be 10 digits" });
    } else if (e.target.name === "email" && !/\S+@\S+\.\S+/.test(e.target.value)) {
      setErrors({ ...errors, email: "Invalid email format" });
    } else if (e.target.name === "password" && e.target.value.length < 4) {
      setErrors({ ...errors, password: "Password must be at least 4 characters" });
    } else {
      setErrors({ ...errors, [e.target.name]: "" });
    }
  };

  const extractZoneNumber = (name) => {
    // Extracts number from "Zone 3" → "03"
    const match = name.match(/Zone\s*(\d+)/i);
    return match ? match[1].padStart(2, "0") : "00";
  };

  const generateUserId = (corpCode, corpName, users) => {
    const zoneNum = extractZoneNumber(corpName); // e.g., "03"
    const zoneCode = `ZONE${zoneNum}`;            // e.g., "ZONE03"

    const existingUsers = users?.filter(
      (user) =>
        user.corporation_code === corpCode &&
        extractZoneNumber(user.corporation_name) === zoneNum
    );

    const serial = (existingUsers?.length || 0) + 1;
    const serialStr = serial.toString().padStart(2, "0"); // e.g., 2 → "02"

    return `${corpCode}GRE${zoneCode}${serialStr}`;

  };

  const handleSubmit = async () => {
    if (!form.username || !form.password || !form.phone_number || !form.corporation_code) {
      alert("Please fill all required fields.");
      return;
    }

    const userId = generateUserId(form.corporation_code, form.corporation_name, users); // Fixed here

    const newUser = {
      ...form,
      user_id: userId,
      email: form.email || "", // Ensure email is included
    };

    try {
      const res = await fetch("http://localhost:3000/dashboard/add-corp-master-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      const result = await res.json();
      if (!res.ok) {
        alert(result.message || "Failed to add user");
        return;
      }

      fetchUsers();
      handleClose();
    } catch (err) {
      console.error(err);
      alert("Error occurred while adding user.");
    }
  };


  const handleEdit = (user) => {
    setEditingUser(user);
    setForm(user);
    setOpen(true);
  };

  const handleEditSave = async () => {
    const payload = {
      email: form.email,
      username: form.username,
      phone_number: form.phone_number,
      status: form.status,
    };

    if (form.password) payload.password = form.password;

    const res = await fetch(`http://localhost:3000/dashboard/update-corp-master-user/${form.user_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      fetchUsers();
      handleClose();
    } else {
      alert("Failed to update user");
    }
  };

  const handleDelete = async (user_id) => {
    if (!window.confirm("Delete this user?")) return;

    const res = await fetch(`http://localhost:3000/dashboard/delete-corp-master-user/${user_id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      fetchUsers();
    } else {
      alert("Failed to delete");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setForm(initialForm);
    setErrors({});
    setEditingUser(null);
  };

  const columns = [
    { field: "user_id", headerName: "User ID", flex: 1 },
    { field: "username", headerName: "Username", flex: 1 },
    { field: "corporation_name", headerName: "Corporation", flex: 1 },
    { field: "district_name", headerName: "District", flex: 1 },
    { field: "phone_number", headerName: "Phone", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => (
        <span
          style={{
            fontWeight: "bold",
            color: params.value === "Active" ? "green" : "red",
          }}
        >
          {params.value}
        </span>
      ),
    },
    {
      field: "edit",
      headerName: "Edit",
      flex: 0.5,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="Edit">
          <IconButton onClick={() => handleEdit(params.row)}>
            <EditIcon />
          </IconButton>
        </Tooltip>
      ),
    },
    {
      field: "delete",
      headerName: "Delete",
      flex: 0.5,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="Delete">
          <IconButton color="error" onClick={() => handleDelete(params.row.user_id)}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <Box m={2} sx={{ paddingTop: "150px", paddingLeft: "65px" }}>
        <Typography variant="h5">Corporation Users</Typography>
        <Button variant="contained" onClick={() => setOpen(true)} startIcon={<AddIcon />} sx={{ my: 2 }}>
          Add Corporation User
        </Button>
        <DataGrid
          rows={users}
          getRowId={(row) => row.user_id}
          columns={columns}
          autoHeight
          sx={{
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#e0e0e0", // slightly darker gray
              color: "#212121",           // near-black text
              fontWeight: "bold",
              fontSize: "1rem",
            },
            "& .MuiDataGrid-cell": {
              fontSize: "0.95rem",
            },
          }}
        />
        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 400 }}>
            <TextField name="username" label="Username" value={form.username} onChange={handleChange} />
            <TextField name="password" label="Password" value={form.password} onChange={handleChange} type="password" error={!!errors.password} helperText={errors.password} />
            <TextField name="phone_number" label="Phone Number" value={form.phone_number} onChange={handleChange} error={!!errors.phone_number} helperText={errors.phone_number} />
            <TextField
              name="email"
              label="Email"
              value={form.email}
              onChange={handleChange}
              error={!!errors.email}
              helperText={errors.email}
            />
            <TextField
              select
              label="Corporation"
              value={form.corporation_code}
              onChange={(e) => {
                const selected = corporations.find(c => c.corporation_code === e.target.value);
                if (selected) {
                  setForm({
                    ...form,
                    corporation_code: selected.corporation_code,
                    corporation_name: selected.corporation_name,
                    district_name: selected.district_name,
                  });
                }
              }}
            >
              {corporations.map((corp) => (
                <MenuItem key={corp.corporation_code} value={corp.corporation_code}>
                  {corp.corporation_name} ({corp.district_name})
                </MenuItem>
              ))}
            </TextField>

            <TextField name="status" label="Status" value={form.status} onChange={handleChange} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={editingUser ? handleEditSave : handleSubmit}>
              {editingUser ? "Save Changes" : "Add"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
