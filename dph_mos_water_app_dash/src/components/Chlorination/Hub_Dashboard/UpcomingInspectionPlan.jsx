import React, { useEffect, useState, useCallback } from "react";
import { Box, Typography, Paper, CircularProgress, Chip } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { toast } from "react-toastify";
import DashboardLayout from "./DashboardLayout";

export default function InspectionPlanTable() {
  const [inspectionPlans, setInspectionPlans] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch logged-in user
  useEffect(() => {
    const fetchLoggedInUser = async () => {
      try {
        const response = await fetch(
          "http://localhost:3000/dashboard/chl-hubusers"
        );
        const data = await response.json();
        const loggedInUsername = localStorage.getItem("loggedInUsername");

        if (data && loggedInUsername) {
          const matchedUser = data.find(
            (u) => u.username === loggedInUsername
          );
          setUser(matchedUser);
        }
      } catch (error) {
        toast.error("Failed to fetch user data");
        console.error("Error fetching user data:", error);
      }
    };

    fetchLoggedInUser();
  }, []);

  // Fetch inspection plans
  const fetchInspectionPlans = useCallback(async () => {
    if (!user?.hub_id) return;

    try {
      const res = await fetch(
        "http://localhost:3000/dashboard/inspection-plan"
      );
      const data = await res.json();

      if (Array.isArray(data.printablePlan)) {
        const today = new Date();
        const grouped = {};

        data.printablePlan.forEach((plan) => {
          if (plan.hub_id !== user.hub_id) return;

          const fromDate = new Date(plan.from.split("-").reverse().join("-"));
          if (fromDate >= today) {
            if (!grouped[plan.user_id]) grouped[plan.user_id] = [];
            grouped[plan.user_id].push({ ...plan, fromDate });
          }
        });

        let upcomingPlans = Object.values(grouped).map((plans) =>
          plans.sort((a, b) => a.fromDate - b.fromDate)[0]
        );

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
            return plan;
          })
        );

        setInspectionPlans(plansWithStatus);
      }
    } catch (err) {
      toast.error("Failed to fetch inspection plans");
      console.error("Error fetching inspection plans:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.hub_id) fetchInspectionPlans();
  }, [user, fetchInspectionPlans]);

  return (
    <DashboardLayout>
      <Box sx={{ mt: 10, px: 3, pt: 7, pl: 10 }}>
        <Paper sx={{ p: 2, boxShadow: 3, borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Upcoming Inspection Plans
          </Typography>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
              <CircularProgress />
            </Box>
          ) : inspectionPlans.length === 0 ? (
            <Typography
              variant="body1"
              align="center"
              sx={{ color: "gray", p: 2 }}
            >
              No upcoming inspection plans found.
            </Typography>
          ) : (
            <Box sx={{ height: 500, width: "100%", overflowX: "auto" }}>
              <DataGrid
                rows={inspectionPlans.map((row, index) => ({
                  id: row.user_id || index, // unique key
                  sno: index + 1, // serial number
                  ...row,
                }))}
                columns={[
                  {
                    field: "sno",
                    headerName: "S.No",
                    width: 80,
                    sortable: false,
                  },
                  { field: "from", headerName: "From", width: 150 },
                  { field: "to", headerName: "To", width: 150 },
                  {
                    field: "proposed_place",
                    headerName: "Proposed Place",
                    width: 250,
                  },
                  {
                    field: "return_date",
                    headerName: "Return Date",
                    width: 150,
                  },
                  { field: "hi_name", headerName: "HI Name", width: 180 },
                  {
                    field: "accepted",
                    headerName: "Status",
                    width: 250,
                    renderCell: (params) => {
                      const value = params.row.accepted;
                      const reason = params.row.reason;
                      if (value === 1) {
                        return (
                          <Chip
                            label="Accepted"
                            color="success"
                            variant="outlined"
                          />
                        );
                      } else if (value === 0) {
                        return (
                          <Chip
                            label={
                              reason ? `Rejected (${reason})` : "Rejected"
                            }
                            color="error"
                            variant="outlined"
                          />
                        );
                      } else {
                        return (
                          <Chip
                            label="Pending"
                            color="warning"
                            variant="outlined"
                          />
                        );
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
                pageSize={5}
                autoHeight={false}
                sx={{
                  "& .MuiDataGrid-columnHeaders": {
                    backgroundColor: "#1976d2 !important",
                    color: "black",
                    fontWeight: "bold",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  },
                  "& .MuiDataGrid-row:nth-of-type(odd)": {
                    backgroundColor: "#e9ebf1c0",
                  },
                  "& .MuiDataGrid-row:hover": {
                    backgroundColor: "#f0f0f0",
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
