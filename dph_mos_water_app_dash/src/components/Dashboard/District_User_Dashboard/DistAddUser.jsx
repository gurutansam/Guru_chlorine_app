import React, { useState, useEffect } from "react";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
} from "@mui/material";
import DashboardLayout from "./DashboardLayout";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const DistUserStats = () => {
  const [users, setUsers] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [districtUser, setDistrictUser] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editPasswordError, setEditPasswordError] = useState("");

  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    district_code: "",
    district_name: "",
    block_id: "",
    block_name: "",
    phone_number: "",
    status: "Active",
    module: "mosquito",
    role: "block_user",
  });

  useEffect(() => {
    const fetchDistrictUser = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/district-officers");
        const data = await res.json();
        const loggedInUsername = localStorage.getItem("loggedInUsername");
        const matchedUser = data.find(
          (u) => u.username.toLowerCase() === loggedInUsername?.toLowerCase()
        );
        if (matchedUser) {
          setDistrictUser(matchedUser);
        } else {
          toast.error("Not authorized or user not found");
        }
      } catch (err) {
        console.error("Error fetching district user:", err);
        toast.error("Error fetching district user");
      }
    };

    fetchDistrictUser();
  }, []);

  useEffect(() => {
    if (districtUser) {
      fetchUsers();
      fetchDistricts();
    }
  }, [districtUser]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mosquito-block-users");
      const data = await res.json();
      const filtered = data.filter(
        (u) => u.district_code === districtUser.district_code
      );
      setUsers(filtered);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      toast.error("Failed to fetch users");
    }
  };

  const fetchDistricts = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mosquito-blocks");
      const data = await res.json();

      const grouped = data.reduce((acc, curr) => {
        const existing = acc.find(d => d.district_code === curr.district_code);
        const block = {
          block_id: curr.block_id,
          block_name: curr.block_name,
        };
        if (existing) {
          existing.blocks.push(block);
        } else {
          acc.push({
            district_code: curr.district_code,
            district_name: curr.district_name,
            blocks: [block],
          });
        }
        return acc;
      }, []);

      setDistricts(grouped);
    } catch (err) {
      console.error("Failed to fetch districts:", err);
      toast.error("Failed to fetch blocks");
    }
  };

  const validatePassword = (value) =>
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+[\]{};':"\\|,.<>/?]).{8,}$/.test(value);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "block_name") {
      const selectedDistrict = districts.find(
        (d) => d.district_code === districtUser.district_code
      );
      const selectedBlock = selectedDistrict?.blocks.find((b) => b.block_name === value);
      setForm((prev) => ({
        ...prev,
        block_name: selectedBlock?.block_name || "",
        block_id: selectedBlock?.block_id || "",
      }));
      return;
    }

    if (name === "password") {
      setPasswordError(
        validatePassword(value)
          ? ""
          : "Password must be 8+ chars, 1 uppercase, 1 number, 1 special char"
      );
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!validatePassword(form.password)) {
      setPasswordError("Password must be 8+ chars, 1 uppercase, 1 number, 1 special char");
      return;
    }

    try {
      const res = await fetch("http://localhost:3000/dashboard/mosquito-block-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to submit");

      toast.success("Block user added successfully");
      setOpen(false);
      await fetchUsers();

      setForm({
        username: "",
        password: "",
        email: "",
        district_code: districtUser.district_code,
        district_name: districtUser.district_name,
        block_id: "",
        block_name: "",
        phone_number: "",
        status: "Active",
        module: "mosquito",
        role: "block_user",
      });
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Error adding block user");
    }
  };

  const handleEdit = (user) => {
    setEditUser({ ...user, password: "" }); // Don't prefill password
    setEditOpen(true);
  };

  const handleEditUserChange = (e) => {
    const { name, value } = e.target;
    setEditUser((prev) => ({ ...prev, [name]: value }));

    if (name === "password") {
      setEditPasswordError(
        validatePassword(value)
          ? ""
          : "Password must be 8+ chars, 1 uppercase, 1 number, 1 special char"
      );
    }
  };

  const handleEditSave = async () => {
    if (editUser.password && !validatePassword(editUser.password)) {
      setEditPasswordError("Password must be 8+ chars, 1 uppercase, 1 number, 1 special char");
      return;
    }
    try {
      const payload = {
        email: editUser.email,
        phone_number: editUser.phone_number,
        status: editUser.status,
      };
      if (editUser.password) payload.password = editUser.password;

      const res = await fetch(`http://localhost:3000/dashboard/mosquito-block-user/${editUser.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update user");
      toast.success("Block user updated");
      setEditOpen(false);
      setEditUser(null);
      await fetchUsers();
    } catch {
      toast.error("Error updating user");
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`http://localhost:3000/dashboard/mosquito-block-user/${user.user_id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete user");
      toast.success("Block user deleted");
      await fetchUsers();
    } catch {
      toast.error("Error deleting user");
    }
  };

  const columns = [
    { field: "user_id", headerName: "User ID", width: 250 },
    { field: "username", headerName: "Username", width: 150 },
    { field: "email", headerName: "Email", width: 180 },
    // { field: "password", headerName: "Password", width: 150 },
    { field: "phone_number", headerName: "Phone", width: 130 },
    // { field: "district_code", headerName: "District Code", width: 130 },
    { field: "district_name", headerName: "District Name", width: 180 },
    // { field: "block_id", headerName: "Block ID", width: 150 },
    { field: "block_name", headerName: "Block Name", width: 150 },
    {
      field: "status",
      headerName: "Status",
      width: 100,
      renderCell: (params) => (
        <span style={{
          color: params.value === "Active" ? "green" : "red",
          fontWeight: "bold"
        }}>
          {params.value}
        </span>
      )
    },
    // { field: "module", headerName: "Module", width: 130 },
    // { field: "role", headerName: "Role", width: 130 },
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
  ];

  return (
    <DashboardLayout>
      <ToastContainer position="top-right" autoClose={3000} />
      <Box p={3}>
        {/* District Officer Card */}
        {districtUser && (
          <Box mb={3}>
            <Box
              sx={{
                border: "1px solid #ccc",
                borderRadius: "12px",
                padding: "16px",
                maxWidth: "600px",
                position: "relative",
              }}
            >
              <Typography variant="h6" gutterBottom fontWeight={600}>
                District Officer
              </Typography>
              <Typography><strong>District Name:</strong> {districtUser.district_name}</Typography>
              <Typography><strong>District Code:</strong> {districtUser.district_code}</Typography>
              <Typography><strong>User ID:</strong> {districtUser.user_id}</Typography>
              {/* <Typography><strong>Role:</strong> {districtUser.role}</Typography> */}
              <Box sx={{ position: "absolute", top: 16, right: 16 }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      district_code: districtUser.district_code,
                      district_name: districtUser.district_name,
                    }));
                    setOpen(true);
                  }}
                >
                  Add Block User
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        <Typography variant="h6" mb={2} fontWeight={600}>
          BLOCK USERS
        </Typography>

        <DataGrid
          rows={users}
          columns={columns}
          getRowId={(row) => row.user_id}
          pageSize={5}
          sx={{
            height: 500,
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#2A2F5B",  // dark navy or change as needed
              color: "black",            // white text
              fontWeight: "bold",
              fontSize: "0.95rem",
            },
          }}
        />


        {/* Add User Dialog */}
        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Add Block User</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              {/* Read-only District Field */}
              <TextField
                label="District"
                value={districtUser?.district_name || ""}
                InputProps={{ readOnly: true }}
                fullWidth
              />

              {/* Block Select */}
              <FormControl fullWidth>
                <InputLabel>Block</InputLabel>
                <Select
                  name="block_name"
                  value={form.block_name}
                  onChange={handleChange}
                >
                  <MenuItem value="">Select Block</MenuItem>
                  {districts
                    .find((d) => d.district_code === districtUser?.district_code)
                    ?.blocks.map((b) => (
                      <MenuItem key={b.block_id} value={b.block_name}>
                        {b.block_name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {/* Block ID */}
              {form.block_id && (
                <TextField
                  label="Block ID"
                  value={form.block_id}
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
              )}

              <TextField
                label="Username"
                name="username"
                value={form.username}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="Email"
                name="email"
                value={form.email}
                onChange={handleChange}
                type="email"
                fullWidth
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
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((prev) => !prev)}>
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
                inputProps={{ maxLength: 10 }}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} color="error" variant="outlined">
              Cancel
            </Button>
            <Button onClick={handleSubmit} variant="contained">
              Add
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Edit Block User</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Email"
                name="email"
                value={editUser?.email || ""}
                onChange={handleEditUserChange}
                type="email"
                fullWidth
              />
              <TextField
                label="Phone Number"
                name="phone_number"
                value={editUser?.phone_number || ""}
                onChange={handleEditUserChange}
                fullWidth
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                value={editUser?.password || ""}
                onChange={handleEditUserChange}
                error={!!editPasswordError}
                helperText={editPasswordError || "Leave blank to keep current password"}
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
            <Button onClick={() => setEditOpen(false)} color="error" variant="outlined">
              Cancel
            </Button>
            <Button onClick={handleEditSave} variant="contained" disabled={!!editPasswordError}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
};

export default DistUserStats;
