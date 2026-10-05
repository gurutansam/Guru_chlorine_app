import React, { useEffect, useState } from "react";
import DashboardLayout from "./DashboardLayout";
import { Box, Typography, Paper, CircularProgress, Chip } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { toast } from "react-toastify";

const CATEGORY_KEYS = [
  "corporation",
  "municipalities",
  "townPanchayats",
  "govtHospitals",
  "railwayStations",
  "approvedHomes",
  "prisons",
  "govtInstitutions",
  "educationalInstitutions",
  "pwdPoondi",
  "templeCamp",
];

// Helper to format key string to readable category
const formatCategory = (key) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());

export default function HubSummaryTable() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [hubData, setHubData] = useState(null);
  const [summaryRows, setSummaryRows] = useState([]);

  useEffect(() => {
    // Fetch logged-in user
    async function fetchUser() {
      try {
        const res = await fetch("http://localhost:3000/dashboard/chl-hubusers");
        const data = await res.json();
        const loggedInUsername = localStorage.getItem("loggedInUsername");
        if (data && loggedInUsername) {
          const matchedUser = data.find((u) => u.username === loggedInUsername);
          setUser(matchedUser || null);
          if (!matchedUser) toast.error("Logged-in user not found");
        } else {
          toast.error("No logged-in user or empty user list");
          setUser(null);
        }
      } catch (e) {
        toast.error("Failed to fetch user data");
        console.error(e);
        setUser(null);
      }
    }
    fetchUser();
  }, []);

  useEffect(() => {
    if (!user?.hub_id) {
      setLoading(false);
      return;
    }

    async function fetchHubMasterData() {
      try {
        const res = await fetch("http://localhost:3000/dashboard/chl-hub-master-data");
        const data = await res.json();

        // Filter hub entries matching user's hub_id
        const hubEntries = data.summary.filter(h => h.hub_id === user.hub_id);
        if (hubEntries.length === 0) {
          toast.error("Hub data not found for your hub_id");
          setHubData(null);
          setLoading(false);
          return;
        }

        // Aggregate totals from hubEntries
        const aggregatedTotals = {};
        CATEGORY_KEYS.forEach(key => {
          aggregatedTotals[key] = hubEntries.reduce((sum, entry) => sum + (entry[key] || 0), 0);
        });

        setHubData(aggregatedTotals);
      } catch (e) {
        toast.error("Failed to fetch hub master data");
        console.error(e);
        setHubData(null);
        setLoading(false);
      }
    }

    fetchHubMasterData();
  }, [user]);

  useEffect(() => {
    if (!hubData || !user?.hub_id) {
      setSummaryRows([]);
      setLoading(false);
      return;
    }

    async function fetchStatusCounts() {
      try {
        const planRes = await fetch("http://localhost:3000/dashboard/inspection-plan");
        const planData = await planRes.json();

        if (!Array.isArray(planData.printablePlan)) {
          toast.error("Invalid inspection plan data");
          setLoading(false);
          return;
        }

        const filteredPlans = planData.printablePlan.filter(
          (plan) => plan.hub_id === user.hub_id
        );

        const userIds = [...new Set(filteredPlans.map(p => p.user_id))];

        const statusPromises = userIds.map(async (uid) => {
          try {
            const res = await fetch(`http://localhost:3000/dashboard/get-save-plan-status?user_id=${uid}`);
            const data = await res.json();
            return data.length > 0 ? data[0].accepted : null;
          } catch {
            return null;
          }
        });

        const statusResults = await Promise.all(statusPromises);

        let accepted = 0, rejected = 0, pending = 0;
        statusResults.forEach((val) => {
          if (val === 1) accepted++;
          else if (val === 0) rejected++;
          else pending++;
        });

        const rows = CATEGORY_KEYS.map((key, idx) => {
          const total = hubData[key] ?? 0;
          const acceptedCount = key === "corporation" ? accepted : 0;
          const rejectedCount = key === "corporation" ? rejected : 0;
          const pendingCount = key === "corporation" ? pending : 0;

          // Balance calculation:
          const balanceCount = acceptedCount > 0 ? total - acceptedCount : total;

          return {
            id: idx + 1,
            category: formatCategory(key),
            total,
            visited: acceptedCount,
            rejected: rejectedCount,
            pending: pendingCount,
            balance: balanceCount,
          };
        });

        setSummaryRows(rows);
      } catch (err) {
        toast.error("Failed to fetch status data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchStatusCounts();
  }, [hubData, user]);

  const columns = [
    { field: "category", headerName: "Category", minWidth: 350 },
    {
      field: "visited",
      headerName: "Accepted",
      width: 180,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          variant="outlined"
          sx={{
            fontWeight: "bold",
            color: "#2e7d32",           // green dark
            backgroundColor: "#c8e6c9", // light green
            borderColor: "#2e7d32",
          }}
        />


      ),
    },
    {
      field: "pending",
      headerName: "Pending",
      width: 120,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          variant="outlined"
          sx={{
            fontWeight: "bold",
            backgroundColor: "rgba(251, 140, 0, 0.15)",  // light transparent orange
            color: "#fb8c00",                             // orange text (MUI orange[600])
            borderColor: "#fb8c00",                       // same orange for border
          }}
        />
      ),
    },
    {
      field: "rejected",
      headerName: "Rejected",
      width: 110,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          variant="outlined"
          sx={{
            fontWeight: "bold",
            backgroundColor: "rgba(249, 113, 103, 0.15)", // light transparent red matching border
            color: "#a81a10ff",
            borderColor: "#f97167ff",
          }}
        />
      ),
    },
    {
      field: "balance",
      headerName: "Balance",
      width: 100,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          variant="outlined"
          sx={{
            fontWeight: "bold",
            color: "#1565c0",
            backgroundColor: "#e3f2fd",
            borderColor: "#1565c0",
          }}
        />
      ),
    },
    {
      field: "total",
      headerName: "Total",
      width: 100,
      type: "number",
      renderCell: (params) => <Typography sx={{ fontWeight: "bold" }}>{params.value}</Typography>,
    },
  ];

  return (
    <DashboardLayout>
      <Box sx={{ mt: 8, px: 3, pt: 9, pl: 10 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Upcoming Place Visit Summary (Region: {user?.hub_name || ""})
        </Typography>
        <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
              <CircularProgress />
            </Box>
          ) : summaryRows.length === 0 ? (
            <Typography variant="body1" align="center" sx={{ color: "gray", p: 2 }}>
              No summary data available.
            </Typography>
          ) : (
            <Box sx={{ height: 520, width: "100%" }}>
              <DataGrid
                rows={summaryRows}
                columns={columns}
                pageSize={11}
                rowsPerPageOptions={[5, 10, 20]}
                disableSelectionOnClick
                sx={{
                  "& .MuiDataGrid-columnHeaders": {
                    backgroundColor: "#1976d2",
                    color: "black",
                    fontWeight: "bold",
                  },
                  "& .MuiDataGrid-row:nth-of-type(odd)": {
                    backgroundColor: "#f5f5f5",
                  },
                }}
              />
            </Box>
          )}
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
