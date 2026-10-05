import React, { useEffect, useState } from "react";
import DashboardLayout from "./DashboardLayout";
import { Box, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

export default function BlkVillageOfficerView() {
  const [userBlockId, setUserBlockId] = useState(null);
  const [userBlockName, setUserBlockName] = useState(null);
  const [officers, setOfficers] = useState([]);

  // ✅ Get logged-in user's block from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) {
      try {
        const userObj = JSON.parse(storedUser);
        if (userObj?.block_id) {
          setUserBlockId(userObj.block_id);
          setUserBlockName(userObj.block_name || "Block");
        }
      } catch (err) {
        console.error("Error parsing loggedInUser from localStorage:", err);
      }
    }
  }, []);

  // ✅ Fetch officers and filter by block_id
  useEffect(() => {
    if (userBlockId) {
      fetchOfficers(userBlockId);
    }
  }, [userBlockId]);

  const fetchOfficers = async (blockId) => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/village-user");
      if (!res.ok) throw new Error("Failed to fetch officers");
      const data = await res.json();

      // ✅ Filter officers belonging to the logged-in user's block
      const filtered = data.filter((o) => o.block_id === blockId);
      setOfficers(filtered);
    } catch (err) {
      console.error("Error fetching officers:", err);
      setOfficers([]);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ paddingLeft: "67px", paddingTop: "150px" }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
          {userBlockName?.toUpperCase() || "BLOCK"} - Health Inspectors
        </Typography>

        <Box sx={{ height: 400 }}>
          <DataGrid
            rows={officers.map((o, i) => ({ id: i + 1, ...o }))}
            columns={[
              { field: "user_id", headerName: "User ID", flex: 1 },
              { field: "username", headerName: "Username", flex: 1 },
              { field: "email", headerName: "Email", flex: 1 },
              { field: "phone_number", headerName: "Phone", flex: 1 },
              { field: "block_name", headerName: "Block", flex: 1 },
            ]}
            pageSize={5}
            rowsPerPageOptions={[5]}
            disableSelectionOnClick
          />
        </Box>
      </Box>
    </DashboardLayout>
  );
}
