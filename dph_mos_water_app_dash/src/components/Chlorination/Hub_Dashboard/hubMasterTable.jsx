import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "./DashboardLayout";

const getStatusStyle = (status) => ({
  color: status === "Completed" ? "green" : "red",
  fontWeight: 600,
  fontFamily: "Nunito, sans-serif",
});

const summaryColumns = [
  {
    field: "id",
    headerName: "S.No",
    width: 80,
    renderCell: (params) => (
      <Typography sx={{ fontWeight: "bold", width: "100%", textAlign: "center" }}>
        {params.value}
      </Typography>
    ),
    headerAlign: "center",
    align: "center",
  },
  { field: "district", headerName: "District", width: 150 },
  { field: "corporation", headerName: "Corporation", width: 150 },
  { field: "municipalities", headerName: "Municipalities", width: 150 },
  { field: "townPanchayats", headerName: "Town Panchayats", width: 200 },
  { field: "govtHospitals", headerName: "Government Hospitals", width: 200 },
  { field: "railwayStations", headerName: "Railway Stations", width: 200 },
  { field: "approvedHomes", headerName: "Approved Homes", width: 190 },
  { field: "prisons", headerName: "Prisons", width: 150 },
  { field: "govtInstitutions", headerName: "Goverment Institutions", width: 250 },
  { field: "educationalInstitutions", headerName: "Educational Institutions", width: 200 },
  { field: "pwdPoondi", headerName: "PWD", width: 170 },
  { field: "templeCamp", headerName: "Temple Camp", width: 170 },
  { field: "total", headerName: "Total", width: 100 },
  // {
  //   field: "cycle1Status",
  //   headerName: "Cycle 1 Status",
  //   width: 140,
  //   renderCell: (params) => (
  //     <Typography style={getStatusStyle(params.value)}>{params.value}</Typography>
  //   ),
  // },
  // {
  //   field: "cycle2Status",
  //   headerName: "Cycle 2 Status",
  //   width: 140,
  //   renderCell: (params) => (
  //     <Typography style={getStatusStyle(params.value)}>{params.value}</Typography>
  //   ),
  // },
];

const detailColumns = [
  { field: "id", headerName: "S.No", width: 80 },
  { field: "district", headerName: "District", width: 180 },
  { field: "category", headerName: "Category", width: 220 },
  { field: "location_name", headerName: "Location Name", width: 350 },
  // { field: "created_at", headerName: "Created At", width: 200 },
];

export default function ChlBlockTable() {
  const [summaryRows, setSummaryRows] = useState([]);
  const [detailRows, setDetailRows] = useState([]);
  const [userHubName, setUserHubName] = useState("");

  useEffect(() => {
    const loggedInUsername = localStorage.getItem("loggedInUsername");
    if (!loggedInUsername) return;

    fetch("http://localhost:3000/dashboard/chl-hubusers")
      .then((res) => res.json())
      .then((userData) => {
        const currentUser = userData.find((u) => u.username === loggedInUsername);
        if (!currentUser?.hub_id) return;

        const userHubId = currentUser.hub_id;
        const userHubName = currentUser.hub_name;
        setUserHubName(userHubName);

        fetch("http://localhost:3000/dashboard/chl-hub-master-data")
          .then((res) => res.json())
          .then(({ summary, details }) => {
            // ✅ Filter summary
            const filteredSummary = summary
              .filter((row) => row.hub_id === userHubId)
              .map((row, index) => ({ ...row, id: index + 1 }));

            const totals = {
              corporation: 0,
              municipalities: 0,
              townPanchayats: 0,
              govtHospitals: 0,
              railwayStations: 0,
              approvedHomes: 0,
              prisons: 0,
              govtInstitutions: 0,
              educationalInstitutions: 0,
              pwdPoondi: 0,
              templeCamp: 0,
              total: 0,
            };

            filteredSummary.forEach((row) => {
              for (const key in totals) {
                totals[key] += row[key] || 0;
              }
            });

            const totalRow = {
              id: "Total",
              district: "TOTAL",
              ...totals,
              cycle1Status: "",
              cycle2Status: "",
            };

            setSummaryRows([...filteredSummary, totalRow]);

            // ✅ Filter details
            const filteredDetails = details
              .filter((d) => d.hub_id === userHubId)
              .map((row, index) => ({
                id: index + 1,
                ...row,
              }));

            setDetailRows(filteredDetails);
          });
      });
  }, []);

  return (
    <DashboardLayout>
      <Box p={2} pl={4} pr={4} sx={{ paddingTop: "150px", paddingLeft: "70px" }}>
        <Typography
          variant="h5"
          gutterBottom
          sx={{
            fontWeight: 600,
            color: "#2A2F5B",
            fontFamily: "Nunito, sans-serif",
          }}
        >
          {userHubName
            ? `${userHubName.toUpperCase()} – REGION MASTER DATA`
            : "REGIONAL WATER ANALYSIS LABORATORY MASTER DATA"}
        </Typography>
        {/* 🔹 Summary DataGrid */}
        <Typography variant="h6" mt={2} mb={1} fontWeight={600}>
          Regional Water Analysis Laboratory Data Summary
        </Typography>
        <Box sx={{ height: "auto", width: "100%" }}>
          <DataGrid
            rows={summaryRows}
            columns={summaryColumns}
            getRowId={(row) => row.id}
            pageSize={30}
            rowsPerPageOptions={[5, 10]}
            sx={{
              fontFamily: "Nunito, sans-serif",
              borderRadius: 2,
              boxShadow: 2,
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#2A2F5B",
              },
              "& .MuiDataGrid-columnHeaderTitle": {
                fontWeight: "bold",
                color: "black",
                fontSize: "16px",
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
              "& .MuiDataGrid-row[data-id='Total']": {
                backgroundColor: "#e0f7fa",
                fontWeight: "bold",
              },
            }}
          />
        </Box>

        {/* 🔹 Detailed DataGrid */}
        <Typography variant="h6" mt={4} mb={1} fontWeight={600}>
          Locations Detail
        </Typography>
        <Box sx={{ height: "auto", width: "100%", mb: 4 }}>
          <DataGrid
            rows={detailRows}
            columns={detailColumns}
            pageSize={10}
            rowsPerPageOptions={[5, 10]}
            sx={{
              borderRadius: 2,
              fontFamily: "Nunito, sans-serif",
              boxShadow: 2,
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#e3f2fd",
              },
              "& .MuiDataGrid-cell": {
                fontSize: "0.95rem",
              },
            }}
          />
        </Box>
      </Box>
    </DashboardLayout>
  );
}
