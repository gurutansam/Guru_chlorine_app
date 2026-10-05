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

export default function ChlHudVillageMasterView() {
  const [villages, setVillages] = useState([]);
  const [summary, setSummary] = useState([]);
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    fetchVillages();
  }, []);
  const fetchVillages = async () => {
    try {
      // Fetch villages
      const resVillages = await fetch("http://localhost:3000/dashboard/village");
      if (!resVillages.ok) throw new Error("Failed to fetch villages");
      const dataVillages = await resVillages.json();
      setVillages(dataVillages);

      // Fetch blocks
      const resBlocks = await fetch("http://localhost:3000/dashboard/hud-blocks");
      if (!resBlocks.ok) throw new Error("Failed to fetch blocks");
      const dataBlocks = await resBlocks.json();
      setBlocks(dataBlocks);

      // Prepare summary
      const grouped = groupByHUD(dataVillages, dataBlocks);
      setSummary(grouped);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  const groupByHUD = (villageData, blockData) => {
    const map = new Map();

    villageData.forEach((v) => {
      if (!map.has(v.hud_id)) {
        map.set(v.hud_id, {
          hud_id: v.hud_id,
          hud_name: v.hud_name,
          villages: 0,
        });
      }
      const hudData = map.get(v.hud_id);
      hudData.villages += 1;
    });

    // Add block count only from hud-blocks API
    blockData.forEach((b) => {
      if (map.has(b.hud_id)) {
        const hudData = map.get(b.hud_id);
        hudData.block_count = (hudData.block_count || 0) + 1;
      }
    });

    return Array.from(map.values()).map((item) => ({
      hud_id: item.hud_id,
      hud_name: item.hud_name,
      block_count: item.block_count || 0,
      village_count: item.villages,
    }));
  };

  const columns = [
    { field: "id", headerName: "ID", width: 90 },
    // { field: "hud_id", headerName: "HUD ID", width: 120 },
    { field: "hud_name", headerName: "HUD Name", width: 180 },
    // { field: "block_id", headerName: "Block ID", width: 120 },
    { field: "block_name", headerName: "Block Name", width: 280 },
    // { field: "village_id", headerName: "Village ID", width: 120 },
    { field: "village_name", headerName: "Village Name", width: 480 }
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
