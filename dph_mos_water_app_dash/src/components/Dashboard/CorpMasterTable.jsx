import React, { useEffect, useState } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, MenuItem, IconButton
} from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

export default function MosCorporationMasterTable() {
  const [corporations, setCorporations] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState(null);

  const [form, setForm] = useState({
    district_name: "",
    corporation_name: ""
  });

  useEffect(() => {
    fetchCorporations();
    fetchDistricts();
  }, []);

  const fetchCorporations = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mos-corporation");
      const data = await res.json();
      setCorporations(data);
    } catch (err) {
      console.error("Fetch corporations failed:", err);
      toast.error("Failed to load corporations");
    }
  };

  const fetchDistricts = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mos-district");
      const data = await res.json();
      setDistricts(data);
    } catch (err) {
      console.error("Fetch districts failed:", err);
      toast.error("Failed to load districts");
    }
  };

  const handleOpen = (row = null) => {
    if (row) {
      setForm({ district_name: row.district_name, corporation_name: row.corporation_name });
      setEditMode(true);
      setSelectedRow(row);
    } else {
      setForm({ district_name: "", corporation_name: "" });
      setEditMode(false);
      setSelectedRow(null);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setForm({ district_name: "", corporation_name: "" });
    setEditMode(false);
    setSelectedRow(null);
  };

  const handleSubmit = async () => {
    const endpoint = editMode
      ? `http://localhost:3000/dashboard/update-mos-corporation/${selectedRow.corporation_code}`
      : "http://localhost:3000/dashboard/mos-corporation";

    const method = editMode ? "PUT" : "POST";

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (!res.ok) throw new Error("Request failed");

      await fetchCorporations();
      handleClose();
      toast.success(`Corporation ${editMode ? "updated" : "added"} successfully`);
    } catch (err) {
      toast.error("Failed to save: " + err.message);
    }
  };

  const confirmDelete = (code) => {
    setCodeToDelete(code);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    try {
      const res = await fetch(`http://localhost:3000/dashboard/delete-mos-corporation/${codeToDelete}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Delete failed");

      await fetchCorporations();
      toast.success("Corporation deleted successfully");
    } catch (err) {
      toast.error("Delete failed: " + err.message);
    } finally {
      setDeleteDialogOpen(false);
      setCodeToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setCodeToDelete(null);
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, pt: 15, pl: 10 }}>
        <ToastContainer position="top-right" autoClose={3000} />
        <Typography variant="h5" mb={2}>DBC Corporation Master Table</Typography>
        <Button variant="contained" onClick={() => handleOpen()}>Add Corporation</Button>

        <Table sx={{ mt: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell ><strong>Corporation Code</strong></TableCell>
              <TableCell><strong>Corporation Name</strong></TableCell>
              <TableCell><strong>District Name</strong></TableCell>
              <TableCell><strong>Edit</strong></TableCell>
              <TableCell><strong>Delete</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {corporations.map((row) => (
              <TableRow key={row.corporation_code}>
                <TableCell>{row.corporation_code}</TableCell>
                <TableCell>{row.corporation_name}</TableCell>
                <TableCell>{row.district_name}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(row)} color="primary">
                    <Edit />
                  </IconButton>
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => confirmDelete(row.corporation_code)} color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Form Dialog */}
        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>{editMode ? "Edit Corporation" : "Add Corporation"}</DialogTitle>
          <DialogContent>
            <TextField
              select
              label="District"
              fullWidth
              value={form.district_name}
              onChange={(e) => setForm({ ...form, district_name: e.target.value })}
              margin="dense"
            >
              {districts.map((d) => (
                <MenuItem key={d.district_code} value={d.district_name}>
                  {d.district_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Corporation Name"
              fullWidth
              value={form.corporation_name}
              onChange={(e) => setForm({ ...form, corporation_name: e.target.value })}
              margin="dense"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit}>
              {editMode ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this corporation? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeleteConfirmed}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
