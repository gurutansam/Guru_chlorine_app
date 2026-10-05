import React, { useEffect, useState, useCallback } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Card, CardContent, Typography, Box, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  IconButton, InputAdornment
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

export default function HubOfficerAdd() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [collectors, setCollectors] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editableFields, setEditableFields] = useState({
    email: false,
    phone_number: false,
    password: false,
  });
  const [inspectionPlans, setInspectionPlans] = useState([]);

  const [newUser, setNewUser] = useState({
    user_id: "",
    username: "",
    email: "",
    phone: "",
    password: "",
  });

  useEffect(() => {
    const fetchLoggedInUser = async () => {
      try {
        const response = await fetch("http://localhost:3000/dashboard/chl-hubusers");
        const data = await response.json();
        const loggedInUsername = localStorage.getItem("loggedInUsername");

        if (data && loggedInUsername) {
          const matchedUser = data.find((u) => u.username === loggedInUsername);
          setUser(matchedUser);
        }
      } catch (error) {
        toast.error("Failed to fetch user data");
        console.error("Error fetching user data:", error);
      }
    };

    fetchLoggedInUser();
  }, []);

  const fetchCollectors = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:3000/dashboard/chl-datacollector");
      const data = await response.json();
      setCollectors(data);
    } catch (err) {
      toast.error("Failed to fetch data collectors");
      console.error("Error fetching collectors:", err);
    }
  }, []);

  const fetchInspectionPlans = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/inspection-plan");
      const data = await res.json();

      if (Array.isArray(data.printablePlan)) {
        const today = new Date();
        const grouped = {};

        data.printablePlan.forEach(plan => {
          if (plan.hub_id !== user?.hub_id) return;

          const fromDate = new Date(plan.from.split("-").reverse().join("-"));
          if (fromDate >= today) {
            if (!grouped[plan.user_id]) grouped[plan.user_id] = [];
            grouped[plan.user_id].push({ ...plan, fromDate });
          }
        });

        // Pick earliest upcoming plan per user
        let upcomingPlans = Object.values(grouped).map(plans =>
          plans.sort((a, b) => a.fromDate - b.fromDate)[0]
        );

        // 🔹 Fetch status for each plan
        const plansWithStatus = await Promise.all(
          upcomingPlans.map(async (plan) => {
            try {
              const statusRes = await fetch(
                `http://localhost:3000/dashboard/get-save-plan-status?user_id=${plan.user_id}`
              );
              const statusData = await statusRes.json();

              if (statusData.length > 0) {
                return {
                  ...plan,
                  accepted: statusData[0].accepted,
                  reason: statusData[0].reason,
                  remarks: statusData[0].remarks || "", // <-- add this
                };
              }
            } catch (e) {
              console.error("Error fetching status for", plan.user_id, e);
            }
            return plan; // return original plan if error
          })
        );

        setInspectionPlans(plansWithStatus);
      }
    } catch (err) {
      toast.error("Failed to fetch inspection plans");
      console.error("Error fetching inspection plans:", err);
    }
  }, [user]);


  useEffect(() => {
    if (user) {
      fetchCollectors();
      fetchInspectionPlans();
    }
  }, [user, fetchCollectors, fetchInspectionPlans]);

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setNewUser({ user_id: "", username: "", email: "", phone: "", password: "" });
  };

  const handleChange = (e) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!user) return;

    const payload = {
      hub_id: user.hub_id,
      hub_name: user.hub_name,
      username: newUser.username,
      email: newUser.email,
      phone_number: newUser.phone,
      password: newUser.password,
    };

    try {
      const res = await fetch("http://localhost:3000/dashboard/add-chl-datacollector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success(`User added successfully with ID: ${result.user_id}`);
        await fetchCollectors();
        handleClose();
      } else {
        toast.error(result.message || "Failed to add user");
      }
    } catch {
      toast.error("Network error while adding user");
    }
  };

  const handleEditClick = (user) => {
    setSelectedUser({ ...user, password: "" });
    setEditableFields({ email: false, phone_number: false, password: false });
    setEditOpen(true);
  };

  const handleEditFieldToggle = (field) => {
    setEditableFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setSelectedUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async () => {
    try {
      const payload = {
        email: selectedUser.email,
        phone_number: selectedUser.phone_number,
      };

      if (selectedUser.password && selectedUser.password.trim() !== "") {
        payload.password = selectedUser.password;
      }

      const res = await fetch(`http://localhost:3000/dashboard/chl-datacollector/${selectedUser.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update");

      toast.success("User updated successfully");
      await fetchCollectors();
      setEditOpen(false);
    } catch {
      toast.error("Failed to update user");
    }
  };

  const handleDelete = async (user_id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        const res = await fetch(`http://localhost:3000/dashboard/chl-datacollector/${user_id}`, {
          method: "DELETE",
        });

        if (!res.ok) throw new Error("Failed to delete");

        await fetchCollectors();
        toast.warn("User deleted successfully");
      } catch {
        toast.error("Failed to delete user");
      }
    }
  };

  return (
    <DashboardLayout>
      <div style={{ paddingLeft: "70px", paddingTop: "150px" }}>
        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: "#2A2F5B", mb: 3 }}>
            {user?.hub_name?.toUpperCase() || "HUB"} - Inspection Team
          </Typography>
        </Box>

        {user && (
          <Card sx={{ maxWidth: "auto", position: "relative" }}>
            <CardContent>
              <Typography variant="h6">
                Chief Regional Office: <strong>{user.hub_name}</strong>
              </Typography>
              <Box sx={{ position: "absolute", top: 16, right: 16 }}>
                <Button variant="contained" onClick={handleOpen}>Add User</Button>
              </Box>
            </CardContent>
          </Card>
        )}

        <Box sx={{ mt: 4, height: 400 }}>
          <Typography variant="h6" gutterBottom>Regional Health Inspectors</Typography>
          <DataGrid
            rows={collectors.filter((c) => c.hub_id === user?.hub_id).map((c, i) => ({ id: i + 1, ...c }))}
            columns={[
              { field: "username", headerName: "Username", flex: 1 },
              { field: "email", headerName: "Email", flex: 1 },
              { field: "phone_number", headerName: "Phone Number", flex: 1 },
              {
                field: "edit",
                headerName: "Edit",
                flex: 0.4,
                renderCell: (params) => (
                  <IconButton onClick={() => handleEditClick(params.row)}><EditIcon /></IconButton>
                ),
              },
              {
                field: "delete",
                headerName: "Delete",
                flex: 0.5,
                renderCell: (params) => (
                  <IconButton color="error" onClick={() => handleDelete(params.row.user_id)}><DeleteIcon /></IconButton>
                ),
              },
            ]}
            pageSize={5}
            rowsPerPageOptions={[5]}
            disableSelectionOnClick
            sx={{
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: '#f5f5f5',
                color: '#000000',
                fontWeight: 700,
                fontSize: '14px',
              },
              '& .MuiDataGrid-columnHeader': {
                fontWeight: 700,
                color: '#000000',
              }
            }}
          />
        </Box>

        {/* Add User Dialog */}
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
          <DialogTitle>Add Data Collection User</DialogTitle>
          <DialogContent dividers>
            <Box sx={{ mb: 2 }}>
              {/* <strong>RWAL ID:</strong> {user?.hub_id} */}
              <br />
              <strong>RWAL Name:</strong> {user?.hub_name}
            </Box>
            <TextField fullWidth margin="dense" label="Username" name="username" value={newUser.username} onChange={handleChange} />
            <TextField fullWidth margin="dense" label="Email" name="email" value={newUser.email} onChange={handleChange} />
            <TextField fullWidth margin="dense" label="Phone Number" name="phone" value={newUser.phone} onChange={handleChange} />
            <TextField fullWidth margin="dense" label="Password" type="password" name="password" value={newUser.password} onChange={handleChange} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Edit User</DialogTitle>
          <DialogContent dividers>
            {selectedUser && (
              <>
                {["email", "phone_number", "password"].map((field) => (
                  <TextField
                    key={field}
                    fullWidth
                    margin="dense"
                    label={field.replace("_", " ").toUpperCase()}
                    name={field}
                    type={field === "password" ? "password" : "text"}
                    value={selectedUser[field] || ""}
                    onChange={handleEditChange}
                    InputProps={{
                      readOnly: !editableFields[field],
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => handleEditFieldToggle(field)}>
                            <EditIcon />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                ))}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleEditSubmit}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* upcoming plan */}
        <Box sx={{ mt: 10 }}>
          <Typography variant="h6" gutterBottom>Upcoming Inspection Plans</Typography>
          <DataGrid
            rows={inspectionPlans.map((row, index) => ({ id: index + 1, ...row }))}
            columns={[
              { field: "sno", headerName: "S.No", flex: 0.3 },
              { field: "from", headerName: "From", flex: 1 },
              { field: "to", headerName: "To", flex: 1 },
              { field: "proposed_place", headerName: "Proposed Place", flex: 1 },
              { field: "return_date", headerName: "Return Date", flex: 1 },
              { field: "hi_name", headerName: "HI Name", flex: 1 },
              // { field: "hub_id", headerName: "Hub ID", flex: 1 },
              // { field: "user_id", headerName: "User ID", flex: 1 },
              {
                field: "accepted",
                headerName: "Status",
                flex: 1,
                renderCell: (params) => {
                  const value = params.row.accepted;
                  const reason = params.row.reason;

                  if (value === 1) {
                    return <span style={{ color: "green", fontWeight: "bold" }}>Accepted</span>;
                  } else if (value === 0) {
                    return (
                      <span style={{ color: "red", fontWeight: "bold" }}>
                        Rejected{reason ? ` (${reason})` : ""}
                      </span>
                    );
                  } else {
                    return <span style={{ color: "#999" }}>Pending</span>;
                  }
                },
              },
              {
                field: "remarks",
                headerName: "Remarks",
                width: 250,
                renderCell: (params) => {
                  const remarks = params.row.remarks || "";
                  return <Typography variant="body2">{remarks.length > 25 ? remarks.slice(0, 25) + "..." : remarks}</Typography>;
                },
              },
            ]}
            autoHeight
            pageSize={5}
          />
        </Box>
        {/* Toast container */}
        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    </DashboardLayout>
  );
}
