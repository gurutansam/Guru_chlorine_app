import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "./DashboardLayout";

export default function BlkVillageMasterView() {
  const [villages, setVillages] = useState([]);
  const [summary, setSummary] = useState([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!user || !user.hud_id || !user.block_id) {
      console.error("HUD ID or Block ID not found in logged-in user data.");
      return;
    }
    fetchVillagesByBlock(user.hud_id, user.block_id);
  }, []);

  const fetchVillagesByBlock = async (hud_id, block_id) => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/village");
      const data = await res.json();

      // Filter villages by both hud_id and block_id for logged-in user
      const filteredData = data.filter(
        (v) => v.hud_id === hud_id && v.block_id === block_id
      );
      setVillages(filteredData);

      // Prepare summary for this block
      const summaryData = filteredData.length
        ? [
          {
            hud_id,
            hud_name: filteredData[0].hud_name,
            block_count: 1,
            village_count: filteredData.length,
            block_name: filteredData[0].block_name,
          },
        ]
        : [];
      setSummary(summaryData);
    } catch (err) {
      console.error("Error fetching villages:", err);
    }
  };

  const columns = [
    { field: "id", headerName: "ID", width: 100 },
    { field: "hud_name", headerName: "HUD Name", width: 180 },
    { field: "block_name", headerName: "Block Name", width: 280 },
    { field: "village_name", headerName: "Village Name", width: 500 },
  ];

  const detailedRows = villages.map((v, index) => ({
    id: index + 1,
    ...v,
  }));

  return (
    <DashboardLayout>
      <Box p={2} pt={15} pl={10}>
        <Typography variant="h5" gutterBottom>
          Block-wise Village Summary
        </Typography>

        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold" }}>HUD Name</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Block Name</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Block Count</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Village Count</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.hud_name}</TableCell>
                    <TableCell>{row.block_name}</TableCell>
                    <TableCell>{row.block_count}</TableCell>
                    <TableCell>{row.village_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Typography variant="h6" gutterBottom>
          Village Detail View
        </Typography>

        <Card>
          <CardContent>
            <div style={{ height: 500, width: "100%" }}>
              <DataGrid
                rows={detailedRows}
                columns={columns}
                pageSize={10}
                rowsPerPageOptions={[10, 20, 50]}
                sx={{
                  "& .MuiDataGrid-columnHeaders": {
                    backgroundColor: "#2A2F5B",
                    color: "black",
                    fontWeight: "bold",
                    fontSize: "1.1rem",
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
      </Box>
    </DashboardLayout>
  );
}
