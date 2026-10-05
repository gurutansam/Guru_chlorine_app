import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "../Hub_Dashboard/DashboardLayout";

const initialForm = {
  name: "",
  district: "",
  latitude: "",
  longitude: "",
};

export default function PrisonMasterTable() {
  const [rows, setRows] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [userHub, setUserHub] = useState("");
  const [userHubName, setUserHubName] = useState("");
  const [districtOptions, setDistrictOptions] = useState([]);
  const [openSnackbar, setOpenSnackbar] = useState(false);

  useEffect(() => {
    const loggedInUsername = localStorage.getItem("loggedInUsername");
    if (!loggedInUsername) return;

    fetch("http://localhost:3000/dashboard/chl-hubusers")
      .then((res) => res.json())
      .then((users) => {
        const currentUser = users.find((u) => u.username === loggedInUsername);
        if (currentUser) {
          setUserHub(currentUser.hub_id);
          setUserHubName(currentUser.hub_name || currentUser.hub_id);

          // 1. Get district options
          fetch(`http://localhost:3000/dashboard/chl-districts-by-hub?hub_id=${currentUser.hub_id}`)
            .then((res) => res.json())
            .then((districts) => {
              setDistrictOptions(districts);

              // 2. Get existing prisons
              return fetch("http://localhost:3000/dashboard/prison-master");
            })
            .then((res) => res.json())
            .then((prisons) => {
              const filtered = prisons.filter((p) => p.hub_id === currentUser.hub_id);
              const formatted = filtered.map((p, index) => ({
                id: index + 1,
                name: p.prison_name,
                district: p.district_name,
                latitude: p.latitude,
                longitude: p.longitude,
              }));
              setRows(formatted);
            });
        }
      })
      .catch((err) => console.error("Prison Master Load Error:", err));
  }, []);

  const handleAdd = () => {
    const payload = {
      hub_id: userHub,
      hub_name: userHubName,
      district_name: formData.district,
      prison_name: formData.name,
      latitude: formData.latitude,
      longitude: formData.longitude,
    };


    fetch("http://localhost:3000/dashboard/prison-master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then(() => {
        const newRow = {
          id: rows.length + 1,
          name: payload.prison_name,
          district: payload.district_name,
          latitude: payload.latitude,
          longitude: payload.longitude,
        };
        setRows([...rows, newRow]);
        setOpenDialog(false);
        setFormData(initialForm);
        setOpenSnackbar(true);
      })
      .catch((err) => {
        console.error("Failed to save prison:", err);
        alert("Error saving data");
      });
  };

  const columns = [
    { field: "id", headerName: "S.No", width: 80 },
    { field: "name", headerName: "Prison Name", width: 500 },
    { field: "district", headerName: "District", width: 200 },
    { field: "latitude", headerName: "Latitude", width: 150 },
    { field: "longitude", headerName: "Longitude", width: 150 },
  ];

  return (
    <DashboardLayout>
      <div style={{ paddingLeft: "60px", paddingTop: "150px" }}>
        <Box p={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: "#2A2F5B", fontFamily: "Nunito, sans-serif" }}>
              {userHubName
                ? `${userHubName.toUpperCase()} – PRISON MASTER DATA`
                : "PRISON MASTER DATA"}
            </Typography>

            <Button variant="contained" onClick={() => setOpenDialog(true)}>
              Add Prison
            </Button>
          </Box>

          <Box sx={{ height: 400, width: "100%", margin: "0 auto" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              pageSize={20}
              rowsPerPageOptions={[5]}
              sx={{
                fontFamily: "Nunito, sans-serif",
                border: "2px solid #2A2F5B",
                borderRadius: 2,
                boxShadow: 2,
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "#f5f5f5",
                },
                "& .MuiDataGrid-columnHeaderTitle": {
                  fontWeight: "bold",
                  color: "#2A2F5B",
                  fontSize: "1rem",
                },
                "& .MuiDataGrid-cell": {
                  borderBottom: "1px solid #ddd",
                  fontSize: "0.95rem",
                },
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: "#f0f4ff",
                },
                "& .MuiDataGrid-footerContainer": {
                  backgroundColor: "#f9f9f9",
                },
                "& .MuiDataGrid-columnSeparator": {
                  visibility: "hidden",
                },
              }}

            />
          </Box>

          <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Add Prison</DialogTitle>
            <DialogContent dividers>
              <Box display="flex" flexDirection="column" gap={2} mt={1}>
                <TextField label="Region" value={userHub} fullWidth disabled />
                <TextField
                  select
                  label="District"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  fullWidth
                >
                  {districtOptions.map((d) => (
                    <MenuItem key={d.district_code} value={d.district_name}>
                      {d.district_name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Prison Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  fullWidth
                />

                <TextField
                  label="Latitude"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="Longitude"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  fullWidth
                />

              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
              <Button onClick={handleAdd} variant="contained">Save</Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={openSnackbar}
            autoHideDuration={3000}
            onClose={() => setOpenSnackbar(false)}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert severity="success" sx={{ width: "100%" }} onClose={() => setOpenSnackbar(false)}>
              Prison added successfully!
            </Alert>
          </Snackbar>
        </Box>
      </div>
    </DashboardLayout>
  );
}
