import React, { useEffect, useState, useCallback } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { toast, ToastContainer } from "react-toastify";
import { Edit, Delete } from "@mui/icons-material";
import "react-toastify/dist/ReactToastify.css";

export default function BlockOfficerAdd() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [collectors, setCollectors] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    user_id: "",
    username: "",
    email: "",
    phone: "",
    password: "",
  });
  const [editUser, setEditUser] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);


  // Toast style
  const notify = {
    success: (msg) => toast.success(msg),
    error: (msg) => toast.error(msg),
    warn: (msg) => toast.warning(msg),
  };

  // Fetch logged-in block user
  useEffect(() => {
    const fetchLoggedInUser = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/mosquito-block-users");
        const data = await res.json();
        const loggedInUsername = localStorage.getItem("loggedInUsername");
        const matchedUser = data.find((u) => u.username === loggedInUsername);
        if (matchedUser) setUser(matchedUser);
      } catch (err) {
        notify.error("Error fetching block user");
      }
    };
    fetchLoggedInUser();
  }, []);

  // Fetch collectors
  const fetchCollectors = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mos-block-add-collectors");
      const data = await res.json();
      setCollectors(data);
    } catch (err) {
      notify.error("Error fetching collectors");
    }
  }, []);

  useEffect(() => {
    if (user) fetchCollectors();
  }, [user, fetchCollectors]);

  const handleOpen = () => setOpen(true);

  const handleClose = () => {
    setOpen(false);
    setNewUser({
      user_id: "",
      username: "",
      email: "",
      phone: "",
      password: "",
    });
  };

  const handleChange = (e) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!user) return;

    const { username, email, phone, password } = newUser;

    // Validation
    if (!username || !email || !phone || !password) {
      return notify.warn("All fields are required.");
    }
    if (!/^\d{10}$/.test(phone)) {
      return notify.warn("Phone number must be 10 digits.");
    }

    const payload = {
      username,
      email,
      phone_number: phone,
      password,
      district_id: user.district_code,
      district_name: user.district_name,
      block_id: user.block_id,
      block_name: user.block_name,
    };

    try {
      const res = await fetch("http://localhost:3000/dashboard/mos-block-add-collectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.ok) {
        notify.success(`User added successfully! ID: ${result.user_id}`);
        setNewUser((prev) => ({ ...prev, user_id: result.user_id }));
        await fetchCollectors();
        handleClose();
      } else {
        notify.error(result.message || "Failed to add user");
      }
    } catch (err) {
      console.error("Error submitting form:", err);
      notify.error("Network error");
    }
  };
  return (
    <DashboardLayout>
      <ToastContainer position="top-right" autoClose={3000} />
      <div style={{ paddingLeft: "28px" }}>
        <Box sx={{ mt: 3 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: "#2A2F5B",
              fontFamily: "Nunito, sans-serif",
              mb: 3,
            }}
          >
            {user?.block_name?.toUpperCase() || "BLOCK"} - DATA MANAGEMENT
          </Typography>
        </Box>

        {user && (
          <Card sx={{ maxWidth: 500, position: "relative" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Block Officer
              </Typography>
              <Box sx={{ mb: 1 }}>
                <strong>District:</strong> {user.district_name}
              </Box>
              <Box sx={{ mb: 1 }}>
                <strong>District Code:</strong> {user.district_code}
              </Box>
              <Box sx={{ mb: 1 }}>
                <strong>Block:</strong> {user.block_name}
              </Box>
              <Box sx={{ mb: 1 }}>
                <strong>Block ID:</strong> {user.block_id}
              </Box>
              <Box sx={{ position: "absolute", top: 16, right: 16 }}>
                <Button variant="contained" onClick={handleOpen}>
                  Add User
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* DataGrid */}
        <Box sx={{ mt: 4, height: 460 }}>
          <Typography variant="h6" gutterBottom >
            <strong>Health Inspectors</strong>
          </Typography>
          <DataGrid
            components={{ Toolbar: GridToolbar }}
            rows={
              collectors
                .filter(
                  (c) =>
                    c.block_id === user?.block_id &&
                    c.district_id === user?.district_code
                )
                .map((c, i) => ({ id: i + 1, ...c }))
            }
            columns={[
              { field: "user_id", headerName: "User ID", flex: 1.5 },
              { field: "username", headerName: "Username", flex: 1 },
              { field: "email", headerName: "Email", flex: 1 },
              { field: "phone_number", headerName: "Phone", flex: 1 },
              { field: "district_name", headerName: "District", flex: 1 },
              { field: "block_name", headerName: "Block", flex: 1 },
              // { field: "module", headerName: "Module", flex: 1 },
              // { field: "role", headerName: "Role", flex: 1 }, 
              {
                field: "edit",
                headerName: "Edit",
                sortable: false,
                renderCell: (params) => (
                  <>
                    <IconButton
                      onClick={() => {
                        setEditUser(params.row);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Edit />
                    </IconButton>
                  </>
                ),
                flex: 1,
              },
              {
                field: "delete",
                headerName: "Delete",
                sortable: false,
                renderCell: (params) => (
                  <>
                    <IconButton
                      color="error"
                      onClick={() => {
                        setUserToDelete(params.row);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </>
                ),
                flex: 1,
              },
            ]}
            pageSize={20}
            rowsPerPageOptions={[5, 10, 25]}
            disableSelectionOnClick
            autoHeight
            sx={{
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#2A2F5B",
                color: "black",
                fontWeight: "bold",
                fontSize: "0.95rem",
              },
            }}
          />
        </Box>

        {/* Add Collector Dialog */}
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
          <DialogTitle>Add Health Inspector</DialogTitle>
          <DialogContent dividers>
            <Box sx={{ mb: 2 }}>
              <strong>District:</strong> {user?.district_name}
              <br />
              <strong>Block:</strong> {user?.block_name}
            </Box>
            <TextField
              fullWidth
              margin="dense"
              label="User ID (auto-generated)"
              name="user_id"
              value={newUser.user_id}
              InputProps={{ readOnly: true }}
              placeholder="Will be shown after saving"
            />
            <TextField
              fullWidth
              margin="dense"
              label="Username"
              name="username"
              value={newUser.username}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              margin="dense"
              label="Email"
              name="email"
              value={newUser.email}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              margin="dense"
              label="Phone Number"
              name="phone"
              value={newUser.phone}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              margin="dense"
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={newUser.password}
              onChange={handleChange}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Edit User</DialogTitle>
          <DialogContent dividers>
            <TextField
              fullWidth
              margin="dense"
              label="Username"
              name="username"
              value={editUser?.username || ""}
              onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
            />
            <TextField
              fullWidth
              margin="dense"
              label="Email"
              name="email"
              value={editUser?.email || ""}
              onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
            />
            <TextField
              fullWidth
              margin="dense"
              label="Phone"
              name="phone_number"
              value={editUser?.phone_number || ""}
              onChange={(e) => setEditUser({ ...editUser, phone_number: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={async () => {
                try {
                  const res = await fetch(`http://localhost:3000/dashboard/mos-block-collector/${editUser.user_id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      username: editUser.username,
                      email: editUser.email,
                      phone_number: editUser.phone_number,
                      district_id: user.district_code,
                      district_name: user.district_name,
                      block_id: user.block_id,
                      block_name: user.block_name,
                    }),
                  });

                  const data = await res.json();
                  if (res.ok) {
                    notify.success("User updated");
                    fetchCollectors();
                    setEditDialogOpen(false);
                  } else {
                    notify.error(data.message);
                  }
                } catch (err) {
                  notify.error("Error updating user");
                }
              }}

            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete <strong>{userToDelete?.username}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              color="error"
              onClick={async () => {
                try {
                  const res = await fetch(
                    `http://localhost:3000/dashboard/mos-block-collector/${userToDelete.user_id}`,
                    {
                      method: "DELETE",
                    }
                  );
                  const data = await res.json();
                  if (res.ok) {
                    notify.success("User deleted");
                    fetchCollectors();
                    setDeleteDialogOpen(false);
                  } else {
                    notify.error(data.message || "Failed to delete user");
                  }
                } catch (err) {
                  notify.error("Server error while deleting user");
                }
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
