import React, { useEffect, useState } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography, Table, TableHead, TableRow, TableCell, TableBody
} from "@mui/material";

export default function MosDistrictMasterTable() {
  const [districts, setDistricts] = useState([]);
  const [open, setOpen] = useState(false);
  const [districtName, setDistrictName] = useState('');

  useEffect(() => {
    fetchDistricts();
  }, []);

  const fetchDistricts = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mos-district");
      const data = await res.json();
      setDistricts(data);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleAdd = async () => {
    if (!districtName.trim()) return;
    try {
      const res = await fetch("http://localhost:3000/dashboard/mos-district", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district_name: districtName })
      });

      if (!res.ok) throw new Error("Failed to add");

      const newData = await res.json();
      console.log("Added:", newData);
      setOpen(false);
      setDistrictName('');
      fetchDistricts();
    } catch (err) {
      alert("Failed to add district: " + err.message);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, pt: 15, pl: 10 }}>
        <Typography variant="h5" mb={2}>DBC District Master Table</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Add District
        </Button>
        <Table sx={{ mt: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell><strong>District Code</strong></TableCell>
              <TableCell><strong>District Name</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {districts.map((row) => (
              <TableRow key={row.district_code}>
                <TableCell>{row.district_code}</TableCell>
                <TableCell>{row.district_name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>Add New District</DialogTitle>
          <DialogContent>
            <TextField
              label="District Name"
              fullWidth
              value={districtName}
              onChange={(e) => setDistrictName(e.target.value)}
              autoFocus
              margin="dense"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAdd}>Add</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
