import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";

export default function BlkVillageMasterTable() {
  const [villages, setVillages] = useState([]);
  const [open, setOpen] = useState(false);
  const [villageName, setVillageName] = useState("");

  const [userBlockId, setUserBlockId] = useState(null);
  const [userBlockName, setUserBlockName] = useState(null);

  // ✅ Get logged-in user's block from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.block_id) {
          setUserBlockId(parsedUser.block_id);
          setUserBlockName(parsedUser.block_name || "Block");
        }
      } catch (err) {
        console.error("Error parsing loggedInUser from localStorage:", err);
      }
    }
  }, []);

  // ✅ Fetch only this block's villages
  useEffect(() => {
    if (userBlockId) {
      fetchVillages(userBlockId);
    }
  }, [userBlockId]);

  const fetchVillages = async (blockId) => {
    try {
      const res = await fetch(`http://localhost:3000/dashboard/village`);
      if (!res.ok) throw new Error("Failed to fetch villages");
      const data = await res.json();

      // ✅ Filter by logged-in block
      const filtered = data.filter((v) => v.block_id === blockId);
      setVillages(filtered);
    } catch (err) {
      console.error("Error fetching villages:", err);
      setVillages([]);
    }
  };

  const handleAdd = async () => {
    if (!villageName.trim() || !userBlockId || !userBlockName) return;

    try {
      const res = await fetch("http://localhost:3000/dashboard/village", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          village_name: villageName.trim(),
          block_id: userBlockId,
          block_name: userBlockName,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to add village: ${res.status} - ${errorText}`);
      }

      await fetchVillages(userBlockId);
      handleCloseDialog();
    } catch (err) {
      alert("Error adding village: " + err.message);
    }
  };

  const handleCloseDialog = () => {
    setVillageName("");
    setOpen(false);
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, pt: 20, pl: 10 }}>
        <Typography variant="h5" mb={2}>
          {userBlockName?.toUpperCase() || "BLOCK"} - Village Master Table
        </Typography>

        <Button variant="contained" onClick={() => setOpen(true)}>
          Add Village
        </Button>

        <Table sx={{ mt: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell><strong>Village ID</strong></TableCell>
              <TableCell><strong>Village Name</strong></TableCell>
              <TableCell><strong>Block Name</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {villages.map((row) => (
              <TableRow key={row.village_id}>
                <TableCell>{row.village_id}</TableCell>
                <TableCell>{row.village_name}</TableCell>
                <TableCell>{row.block_name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Dialog */}
        <Dialog open={open} onClose={handleCloseDialog}>
          <DialogTitle>Add New Village</DialogTitle>
          <DialogContent>
            <TextField
              label="Village Name"
              fullWidth
              value={villageName}
              onChange={(e) => setVillageName(e.target.value)}
              margin="dense"
              autoFocus
            />

            <TextField
              label="Block"
              fullWidth
              value={userBlockName || ""}
              margin="dense"
              InputProps={{ readOnly: true }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button variant="contained" onClick={handleAdd}>
              Add
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
