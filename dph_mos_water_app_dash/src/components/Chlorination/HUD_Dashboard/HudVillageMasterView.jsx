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
  TableBody
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "./DashboardLayout";

export default function HudVillageMasterView() {
  const [villages, setVillages] = useState([]);
  const [summary, setSummary] = useState([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!user || !user.hud_id) {
      console.error("HUD ID not found in logged-in user data.");
      return;
    }
    fetchData(user.hud_id);
  }, []);

  const fetchData = async (hud_id) => {
    try {
      const [blocksRes, villagesRes] = await Promise.all([
        fetch("http://localhost:3000/dashboard/hud-blocks"),
        fetch("http://localhost:3000/dashboard/village")
      ]);

      let blocksData = await blocksRes.json();
      let villagesData = await villagesRes.json();

      // Filter datasets by HUD ID
      blocksData = blocksData.filter(b => b.hud_id === hud_id);
      villagesData = villagesData.filter(v => v.hud_id === hud_id);

      setVillages(villagesData);

      const groupedSummary = groupByHUD(blocksData, villagesData);
      setSummary(groupedSummary);

    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  const groupByHUD = (blocks, villages) => {
    const hudMap = new Map();

    // Add blocks grouped by HUD (unique count with Set)
    blocks.forEach(({ hud_id, hud_name, block_id }) => {
      if (!hudMap.has(hud_id)) {
        hudMap.set(hud_id, {
          hud_id,
          hud_name,
          blocks: new Set(),
          villagesCount: 0
        });
      }
      hudMap.get(hud_id).blocks.add(block_id);
    });

    // Add villages count per HUD
    villages.forEach(({ hud_id }) => {
      if (!hudMap.has(hud_id)) {
        // In case village HUD doesn't exist in blocks data
        hudMap.set(hud_id, {
          hud_id,
          hud_name: "",
          blocks: new Set(),
          villagesCount: 0
        });
      }
      hudMap.get(hud_id).villagesCount += 1;
    });

    return Array.from(hudMap.values()).map(item => ({
      hud_id: item.hud_id,
      hud_name: item.hud_name,
      block_count: item.blocks.size,
      village_count: item.villagesCount
    }));
  };

  const columns = [
    { field: "id", headerName: "ID", width: 100 },
    // { field: "hud_id", headerName: "HUD ID", width: 120 },
    { field: "hud_name", headerName: "HUD Name", width: 180 },
    // { field: "block_id", headerName: "Block ID", width: 120 },
    { field: "block_name", headerName: "Block Name", width: 280 },
    // { field: "village_id", headerName: "Village ID", width: 120 },
    { field: "village_name", headerName: "Village Name", width: 500 }
  ];

  const detailedRows = villages.map((v, index) => ({
    id: index + 1,
    ...v
  }));

  return (
    <DashboardLayout>
      <Box p={2} pt={15} pl={10}>
        <Typography variant="h5" gutterBottom>
          HUD-wise Village Summary
        </Typography>

        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  {/* <TableCell sx={{ color: "black", fontWeight: "bold" }}>HUD ID</TableCell> */}
                  <TableCell sx={{ color: "black", fontWeight: "bold" }}>HUD Name</TableCell>
                  <TableCell sx={{ color: "black", fontWeight: "bold" }}>Block Count</TableCell>
                  <TableCell sx={{ color: "black", fontWeight: "bold" }}>Village Count</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.map((row, idx) => (
                  <TableRow key={idx}>
                    {/* <TableCell>{row.hud_id}</TableCell> */}
                    <TableCell>{row.hud_name}</TableCell>
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
                    fontSize: "1.1rem"
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      </Box>
    </DashboardLayout>
  );
}
