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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "../Hub_Dashboard/DashboardLayout";
import AddIcon from '@mui/icons-material/Add';

const initialForm = {
  name: "",
  district: "",
  latitude: "",
  longitude: "",
};

export default function CorporationMasterTable() {
  const [rows, setRows] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [userHub, setUserHub] = useState("");
  const [userHubName, setUserHubName] = useState("");
  const [districtOptions, setDistrictOptions] = useState([]);

  useEffect(() => {
    const loggedInUsername = localStorage.getItem("loggedInUsername");
    if (!loggedInUsername) return;

    // Step 1: Fetch all hub users
    fetch("http://localhost:3000/dashboard/chl-hubusers")
      .then((res) => res.json())
      .then((users) => {
        const currentUser = users.find((u) => u.username === loggedInUsername);

        if (currentUser) {
          const hubId = currentUser.hub_id;
          const hubName = currentUser.hub_name;

          setUserHub(hubId);
          setUserHubName(hubName);

          // Step 2: Fetch districts for this hub
          fetch(`http://localhost:3000/dashboard/chl-districts-by-hub?hub_id=${hubId}`)
            .then((res) => res.json())
            .then((districts) => {
              setDistrictOptions(districts);
            })
            .catch((err) => console.error("Failed to fetch districts:", err));

          // Step 3: Fetch all corporation master data
          fetch(`http://localhost:3000/dashboard/corporation-master?hub_id=${hubId}`)
            .then((res) => res.json())
            .then((data) => {
              const formatted = data.map((row, index) => ({
                id: index + 1,
                name: row.corporation_name,
                district: row.district_name,
                latitude: row.latitude,
                longitude: row.longitude,
              }));

              setRows(formatted);
            })
            .catch((err) => console.error("Failed to fetch corporation data:", err));
        } else {
          console.warn("No matching user found for", loggedInUsername);
        }
      })
      .catch((err) => console.error("Failed to fetch hub users:", err));
  }, []);

  const columns = [
    { field: "id", headerName: "S.No", width: 80 },
    { field: "name", headerName: "Corporation Name", width: 300 },
    { field: "district", headerName: "District", width: 200 },
    { field: "latitude", headerName: "Latitude", width: 150 },
    { field: "longitude", headerName: "Longitude", width: 150 },
  ];

  const handleAdd = () => {
    const selectedDistrict = districtOptions.find(
      (d) => d.district_name === formData.district
    );

    if (!selectedDistrict) {
      alert("Invalid district selected");
      return;
    }

    const payload = {
      hub_id: userHub,
      hub_name: userHubName,
      district_id: selectedDistrict.district_code,
      district_name: selectedDistrict.district_name,
      corporation_name: formData.name,
      latitude: formData.latitude,
      longitude: formData.longitude,
    };

    fetch("http://localhost:3000/dashboard/corporation-master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then(() => {
        const newRow = {
          id: rows.length + 1,
          name: payload.corporation_name,
          district: payload.district_name,
          latitude: payload.latitude,
          longitude: payload.longitude,
        };
        setRows([...rows, newRow]);
        setOpenDialog(false);
        setFormData(initialForm);
      })
      .catch((err) => {
        console.error("Failed to save corporation:", err);
        alert("Error saving data");
      });
  };

  return (
    <DashboardLayout>
      <div style={{ paddingLeft: "60px", paddingTop: "150px" }}>
        <Box p={2}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                color: "#2A2F5B",
                fontFamily: "Nunito, sans-serif",
              }}
            >
              {userHubName
                ? `${userHubName.toUpperCase()} – CORPORATION MASTER DATA`
                : "CORPORATION MASTER DATA"}
            </Typography>

            <Button variant="contained" onClick={() => setOpenDialog(true)}>
              <AddIcon fontSize="small" sx={{ marginRight: 1 }} />
              Add Corporation
            </Button>
          </Box>

          <Box sx={{ height: "auto", width: "100%", margin: "0 auto" }}>
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
            <DialogTitle sx={{ fontFamily: "Nunito, sans-serif", display: 'flex', alignItems: 'center', gap: 1 }}>
              Add Corporation
            </DialogTitle>
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
                  label="Corporation Name"
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
        </Box>
      </div>
    </DashboardLayout>
  );
}
