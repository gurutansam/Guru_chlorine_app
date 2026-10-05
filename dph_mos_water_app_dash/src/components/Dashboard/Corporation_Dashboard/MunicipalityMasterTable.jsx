import React, { useEffect, useState } from "react";
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
  IconButton,
  MenuItem,
} from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";
import { ToastContainer, toast } from "react-toastify";
import DashboardLayout from "./DashboardLayout";

export default function MosMunicipalityMasterTable() {
  const [municipalitiesRaw, setMunicipalitiesRaw] = useState([]);
  const [corporations, setCorporations] = useState([]);
  const [enrichedMunicipalities, setEnrichedMunicipalities] = useState([]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    district_name: "",
    corporation_name: "",
    corporation_code: "",
    municipality_name: "",
    module: "mosquito",
    municipality_id: "",
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const corpRes = await fetch("http://localhost:3000/dashboard/mos-corporation");
      const corpData = await corpRes.json();
      setCorporations(corpData);

      const muniRes = await fetch("http://localhost:3000/dashboard/mos-municipalities");
      const muniData = await muniRes.json();
      setMunicipalitiesRaw(muniData);

      enrichMunicipalities(muniData, corpData);
    } catch (error) {
      toast.error("Failed to fetch data");
    }
  };

  const enrichMunicipalities = (municipalities, corporations) => {
    const enriched = municipalities.map((muni) => {
      const corporation = corporations.find(
        (corp) => corp.corporation_code === muni.corporation_code
      );

      const district = corporation?.district_name?.toUpperCase().substring(0, 4) || "XXXX";
      const corpCode = corporation?.corporation_name?.toUpperCase().substring(0, 3) || "YYY";

      return {
        ...muni,
        corporation_name: corporation?.corporation_name || "N/A",
        corporation_code: corporation?.corporation_code || "N/A",
        district_name: corporation?.district_name || "N/A",
        municipality_code: `MOS${district}${corpCode}USR001`,
      };
    });

    setEnrichedMunicipalities(enriched);
  };

  const handleOpen = () => {
    setForm({
      district_name: "",
      corporation_name: "",
      corporation_code: "",
      municipality_name: "",
      module: "mosquito",
      municipality_id: "",
    });
    setEditingId(null);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async () => {
    try {
      const selectedCorp = corporations.find(
        (corp) => corp.corporation_name === form.corporation_name
      );

      if (!selectedCorp) {
        toast.error("Corporation not found");
        return;
      }

      const body = {
        municipality_name: form.municipality_name,
        corporation_code: selectedCorp.corporation_code,
        module: form.module,
      };

      if (editingId) {
        await fetch(`http://localhost:3000/dashboard/mos-municipalities/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        toast.success("Updated successfully");
      } else {
        await fetch("http://localhost:3000/dashboard/mos-municipalities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        toast.success("Added successfully");
      }

      handleClose();
      fetchAllData();
    } catch (err) {
      toast.error("Operation failed");
    }
  };

  const handleEdit = (municipality) => {
    const corp = corporations.find(
      (corp) => corp.corporation_code === municipality.corporation_code
    );
    setForm({
      district_name: corp?.district_name || "",
      corporation_name: corp?.corporation_name || "",
      corporation_code: corp?.corporation_code || "",
      municipality_name: municipality.municipality_name,
      module: municipality.module || "mosquito",
      municipality_id: municipality.municipality_id || "",
    });
    setEditingId(municipality.municipality_id);
    setOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`http://localhost:3000/dashboard/mos-municipalities/${id}`, {
        method: "DELETE",
      });
      toast.error("Deleted successfully", {
        style: { backgroundColor: "#f44336", color: "#fff" },
      });
      fetchAllData();
    } catch {
      toast.error("Delete failed", {
        style: { backgroundColor: "#d32f2f", color: "#fff" },
      });
    }
  };

  return (
    <DashboardLayout>
      <ToastContainer />
      <Box p={2}>
        <Typography variant="h6" sx={{ fontWeight: "bold" }}>Mosquito Municipality Master</Typography>
        <Button variant="contained" color="primary" onClick={handleOpen} sx={{ my: 2 }}>
          Add Municipality
        </Button>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>District Name</strong></TableCell>
              <TableCell><strong>Corporation Name</strong></TableCell>
              <TableCell><strong>Municipality Name</strong></TableCell>
              <TableCell align="center"><strong>Edit</strong></TableCell>
              <TableCell align="center"><strong>Delete</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {enrichedMunicipalities.map((row, index) => (
              <TableRow key={row.municipality_id || index}>
                <TableCell>{row.district_name}</TableCell>
                <TableCell>{row.corporation_name}</TableCell>
                <TableCell>{row.municipality_name}</TableCell>
                <TableCell align="center">
                  <IconButton
                    onClick={() => handleEdit(row)}
                    sx={{ color: "#127fd8ff" }}
                    aria-label="edit"
                  >
                    <Edit />
                  </IconButton>
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    onClick={() => handleDelete(row.municipality_id)}
                    sx={{ color: "red" }}
                    aria-label="delete"
                  >
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

        </Table>

        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>{editingId ? "Edit" : "Add"} Municipality</DialogTitle>
          <DialogContent>
            {/* {editingId && (
              <TextField
                label="Municipality ID"
                fullWidth
                margin="normal"
                value={form.municipality_id}
                InputProps={{
                  readOnly: true,
                }}
              />
            )} */}

            <TextField
              label="Corporation Name"
              select
              fullWidth
              margin="normal"
              value={form.corporation_name}
              onChange={(e) => {
                const selectedCorp = corporations.find(c => c.corporation_name === e.target.value);
                setForm({
                  ...form,
                  corporation_name: selectedCorp?.corporation_name || "",
                  corporation_code: selectedCorp?.corporation_code || "",
                  district_name: selectedCorp?.district_name || "",
                });
              }}
            >
              {corporations.map((corp) => (
                <MenuItem key={corp.corporation_code} value={corp.corporation_name}>
                  {corp.corporation_name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Municipality Name"
              fullWidth
              margin="normal"
              value={form.municipality_name}
              onChange={(e) => setForm({ ...form, municipality_name: e.target.value })}
            />

            <TextField
              label="Module"
              fullWidth
              margin="normal"
              value={form.module}
              disabled
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit}>
              {editingId ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
