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


export default function RailwayStationsMasterTable() {
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
      .then((data) => {
        const currentUser = data.find((u) => u.username === loggedInUsername);
        if (currentUser) {
          setUserHub(currentUser.hub_id);
          setUserHubName(currentUser.hub_name);

          // 1. Fetch districts
          fetch(`http://localhost:3000/dashboard/chl-districts-by-hub?hub_id=${currentUser.hub_id}`)
            .then((res) => res.json())
            .then((districts) => {
              setDistrictOptions(districts);

              // 2. Fetch existing railway stations
              return fetch("http://localhost:3000/dashboard/railway-station-master");
            })
            .then((res) => res.json())
            .then((stations) => {
              const filtered = stations.filter((row) => row.hub_id === currentUser.hub_id);
              const formatted = filtered.map((row, index) => ({
                id: index + 1,
                name: row.station_name,
                district: row.district_name,
                latitude: row.latitude,
                longitude: row.longitude,
              }));
              setRows(formatted);
            });
        }
      })
      .catch((err) => console.error("Error during setup:", err));
  }, []);

  const columns = [
    { field: "id", headerName: "S.No", width: 80 },
    { field: "name", headerName: "Railway Station Name", width: 500 },
    { field: "district", headerName: "District", width: 200 },
    { field: "latitude", headerName: "Latitude", width: 150 },
    { field: "longitude", headerName: "Longitude", width: 150 },
  ];

  const handleAdd = () => {
    const payload = {
      hub_id: userHub,
      hub_name: userHubName,
      district_name: formData.district,
      station_name: formData.name,
      latitude: formData.latitude,
      longitude: formData.longitude,
    };


    fetch("http://localhost:3000/dashboard/railway-station-master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then(() => {
        const newRow = {
          id: rows.length + 1,
          name: payload.station_name,
          district: payload.district_name,
        };
        setRows([...rows, newRow]);
        setOpenDialog(false);
        setFormData(initialForm);
        setOpenSnackbar(true);
      })
      .catch((err) => {
        console.error("Failed to save station:", err);
        alert("Error saving data");
      });
  };

  return (
    <DashboardLayout>
      <div style={{ paddingLeft: "60px", paddingTop: "150px" }}>

        <Box p={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: "#2A2F5B", fontFamily: "Nunito, sans-serif" }}>
              {userHubName ? `${userHubName.toUpperCase()} – RAILWAY STATION MASTER DATA` : "RAILWAY STATION MASTER DATA"}
            </Typography>

            <Button variant="contained" onClick={() => setOpenDialog(true)}>
              Add Railway Station
            </Button>
          </Box>

          <Box sx={{ height: "auto", width: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              pageSize={20}
              rowsPerPageOptions={[20]}
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
            <DialogTitle sx={{ fontFamily: "Nunito, sans-serif" }}>Add Railway Station</DialogTitle>
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
                  {districtOptions.map((district) => (
                    <MenuItem key={district.district_code} value={district.district_name}>
                      {district.district_name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Railway Station Name"
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
              <Button onClick={handleAdd} variant="contained">
                Save
              </Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={openSnackbar}
            autoHideDuration={3000}
            onClose={() => setOpenSnackbar(false)}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert onClose={() => setOpenSnackbar(false)} severity="success" sx={{ width: "100%" }}>
              Railway station added successfully!
            </Alert>
          </Snackbar>
        </Box>
      </div>
    </DashboardLayout>
  );
}
