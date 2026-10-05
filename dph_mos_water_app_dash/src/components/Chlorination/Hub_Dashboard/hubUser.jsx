import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
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
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const HubUserStats = () => {
  const [users, setUsers] = useState([]);
  const [hubsData, setHubsData] = useState([]);
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [form, setForm] = useState({
    user_id: "",
    username: "",
    password: "",
    email: "",
    hub_id: "",
    phone_number: "",
    status: "Active",
  });

  // Fetch users and hubs on load
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
      console.error("Failed to fetch users:", err);
    }
  };

  const fetchHubs = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/hubs-districts");
      const data = await res.json();
      setHubsData(data);
    } catch (err) {
      console.error("Failed to fetch hubs:", err);
    }
  };

  const validatePassword = (value) =>
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+[\]{};':"\\|,.<>/?]).{8,}$/.test(value);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "hub_id") {
      const userCount = users.filter((u) => u.hub_id === value).length + 1;
      const newUserId = `${value}USR${String(userCount).padStart(3, "0")}`;
      setForm((prev) => ({
        ...prev,
        hub_id: value,
        user_id: newUserId,
      }));
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
      setPasswordError(
        "Password must be 8+ chars, 1 uppercase, 1 number, 1 special char"
      );
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

      alert("User added successfully");
      await fetchUsers(); // Refresh users from DB

      // Reset form
      setForm({
        user_id: "",
        username: "",
        password: "",
        email: "",
        hub_id: "",
        phone_number: "",
        status: "Active",
      });
      setPasswordError("");
      setOpen(false);
    } catch (err) {
      console.error("Submission error:", err);
      alert("Error submitting user data");
    }
  };

  return (
    <DashboardLayout>
      <div style={{ paddingLeft: "70px", paddingTop: "150px" }}>
        <Box mt={4} sx={{ background: "#fff", borderRadius: 3, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: "#2A2F5B", mb: 2 }}>
            STATE USERS
          </Typography>

          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpen(true)}
              sx={{
                background: "linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)",
                color: "#fff",
                borderRadius: 2,
                fontWeight: 700,
                px: 3,
                "&:hover": {
                  background: "linear-gradient(90deg, #1565c0 0%, #64b5f6 100%)",
                },
              }}
            >
              Add User
            </Button>
          </Box>

          <DataGrid
            rows={users}
            columns={[
              // { field: "user_id", headerName: "User ID", width: 160 },
              { field: "username", headerName: "Username", width: 150 },
              { field: "email", headerName: "Email", width: 180 },
              { field: "password", headerName: "Password", width: 150 },
              { field: "hub_id", headerName: "Region ID", width: 120 },
              { field: "hub_name", headerName: "Region Name", width: 180 },
              { field: "phone_number", headerName: "Phone", width: 130 },
              { field: "status", headerName: "Status", width: 100 },
            ]}
            getRowId={(row) => row.user_id}
            pageSize={5}
            sx={{ height: 480 }}
          />

          {/* Add User Dialog */}
          <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Add User</DialogTitle>
            <DialogContent>
              <Stack spacing={2} mt={1}>
                <FormControl fullWidth>
                  <InputLabel id="hub-label">Region</InputLabel>
                  <Select
                    labelId="hub-label"
                    name="hub_id"
                    value={form.hub_id}
                    onChange={handleChange}
                    label="Hub"
                  >
                    <MenuItem value="">Select Region</MenuItem>
                    {hubsData.map((hub) => (
                      <MenuItem key={hub.hub_id} value={hub.hub_id}>
                        {hub.hub_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {form.hub_id && (
                  <>
                    <TextField label="User ID" name="user_id" value={form.user_id} fullWidth InputProps={{ readOnly: true }} />
                    <TextField label="Username" name="username" value={form.username} onChange={handleChange} fullWidth />
                    <TextField label="Email" name="email" value={form.email} onChange={handleChange} type="email" fullWidth />
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
                      inputProps={{ maxLength: 10, inputMode: "numeric" }}
                      error={form.phone_number && form.phone_number.length !== 10}
                      helperText={
                        form.phone_number && form.phone_number.length !== 10
                          ? "Phone number must be 10 digits"
                          : ""
                      }
                      fullWidth
                    />

                  </>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)} color="error" variant="outlined">
                Cancel
              </Button>
              <Button onClick={handleSubmit} variant="contained" disabled={!form.user_id}>
                Add
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </div>
    </DashboardLayout>
  );
};

export default HubUserStats;
