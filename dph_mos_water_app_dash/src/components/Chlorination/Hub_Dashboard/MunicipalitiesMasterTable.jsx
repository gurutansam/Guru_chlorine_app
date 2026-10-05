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


export default function MunicipalitiesMasterTable() {
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
      .then((hubUsers) => {
        const currentUser = hubUsers.find((u) => u.username === loggedInUsername);
        if (!currentUser) return;

        setUserHub(currentUser.hub_id);
        setUserHubName(currentUser.hub_name);

        // Step 1: Fetch districts for the current hub
        fetch(`http://localhost:3000/dashboard/chl-districts-by-hub?hub_id=${currentUser.hub_id}`)
          .then((res) => res.json())
          .then((districts) => {
            setDistrictOptions(districts);

            // Step 2: Now fetch all municipalities
            return fetch("http://localhost:3000/dashboard/municipality-master");
          })
          .then((res) => res.json())
          .then((municipalities) => {
            // Step 3: Filter municipalities by hub_id
            const filteredRows = municipalities
              .filter((item) => item.hub_id === currentUser.hub_id)
              .map((item, index) => ({
                id: index + 1,
                name: item.municipality_name,
                district: item.district_name,
                latitude: item.latitude,
                longitude: item.longitude,
              }));

            setRows(filteredRows);
          })
          .catch((err) => console.error("Failed to fetch municipalities or districts:", err));
      })
      .catch((err) => console.error("Failed to fetch hub users:", err));
  }, []);



  const columns = [
    { field: "id", headerName: "S.No", width: 80 },
    { field: "name", headerName: "Municipality Name", width: 500 },
    { field: "district", headerName: "District", width: 200 },
    { field: "latitude", headerName: "Latitude", width: 150 },
    { field: "longitude", headerName: "Longitude", width: 150 },
  ];

  const handleAdd = () => {
    const payload = {
      hub_id: userHub,
      hub_name: userHubName,
      district_name: formData.district,
      municipality_name: formData.name,
      latitude: formData.latitude,
      longitude: formData.longitude,
    };


    fetch("http://localhost:3000/dashboard/municipality-master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then(() => {
        const newRow = {
          id: rows.length + 1,
          name: payload.municipality_name,
          district: payload.district_name,
          latitude: payload.latitude,
          longitude: payload.longitude,
        };
        setRows([...rows, newRow]);
        setOpenDialog(false);
        setFormData(initialForm);
        setOpenSnackbar(true); // ✅ Show toast
      })
      .catch((err) => {
        console.error("Failed to save municipality:", err);
        alert("Error saving data");
      });
  };

  return (
    <DashboardLayout>
      <div style={{ paddingLeft: "60px", paddingTop: "150px" }}>
        <Box p={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                color: "#2A2F5B",
                fontFamily: "Nunito, sans-serif",
              }}
            >
              {userHubName
                ? `${userHubName.toUpperCase()} – MUNICIPALITY MASTER DATA`
                : "MUNICIPALITY MASTER DATA"}
            </Typography>

            <Button variant="contained" onClick={() => setOpenDialog(true)}>
              Add Municipality
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

          {/* Add Dialog */}
          <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontFamily: "Nunito, sans-serif" }}>Add Municipality</DialogTitle>
            <DialogContent dividers>
              <Box display="flex" flexDirection="column" gap={2} mt={1}>
                <TextField label="Region" value={userHub} fullWidth disabled />
                <TextField
                  select
                  label="District"
                  value={formData.district}
                  onChange={(e) =>
                    setFormData({ ...formData, district: e.target.value })
                  }
                  fullWidth
                >
                  {districtOptions.map((district) => (
                    <MenuItem key={district.district_code} value={district.district_name}>
                      {district.district_name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Municipality Name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
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

          {/* ✅ Snackbar */}
          <Snackbar
            open={openSnackbar}
            autoHideDuration={3000}
            onClose={() => setOpenSnackbar(false)}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert
              onClose={() => setOpenSnackbar(false)}
              severity="success"
              sx={{ width: "100%" }}
            >
              Municipality added successfully!
            </Alert>
          </Snackbar>
        </Box>
      </div>
    </DashboardLayout>
  );
}
