import React, { useEffect, useState } from "react";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function MosBlockMasterTable() {
  const [user, setUser] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editBlock, setEditBlock] = useState(null);
  const [blockToDelete, setBlockToDelete] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [form, setForm] = useState({
    district_code: "",
    district_name: "",
    block_name: "",
    block_id: "",
  });

  useEffect(() => {
    fetchLoggedInDistrictUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchBlocks();
      fetchDistricts();
    }
  }, [user]);

  const fetchLoggedInDistrictUser = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/district-officers");
      const data = await res.json();
      const loggedInUsername = localStorage.getItem("loggedInUsername");
      const matchedUser = data.find(
        (u) => u.username.toLowerCase() === loggedInUsername?.toLowerCase()
      );
      if (matchedUser) {
        setUser(matchedUser);
        setForm((prev) => ({
          ...prev,
          district_code: matchedUser.district_code,
          district_name: matchedUser.district_name,
        }));
      } else {
        toast.error("User not authorized");
      }
    } catch (err) {
      console.error("Error fetching district user:", err);
      toast.error("Error fetching user");
    }
  };

  const fetchBlocks = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mosquito-blocks");
      const data = await res.json();
      const filtered = data.filter((b) => b.district_code === user.district_code);
      setBlocks(filtered);
    } catch (err) {
      console.error("Failed to fetch blocks:", err);
      toast.error("Failed to fetch blocks");
    }
  };

  const fetchDistricts = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/mos-district");
      const data = await res.json();
      setDistricts(data);
    } catch (err) {
      console.error("Failed to fetch districts:", err);
      toast.error("Failed to fetch districts");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "block_name") {
      const distPrefix = (form.district_name || "").slice(0, 4).toUpperCase();
      const blockPrefix = value.slice(0, 4).toUpperCase();
      const count = blocks.length + 1;
      const block_id = `${distPrefix}BLK${blockPrefix}${String(count).padStart(3, "0")}`;

      setForm((prev) => ({ ...prev, block_name: value, block_id }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdd = async () => {
    if (!form.district_code || !form.block_name.trim()) {
      return toast.error("Please enter block name");
    }

    try {
      const res = await fetch("http://localhost:3000/dashboard/mosquito-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to add block");

      await fetchBlocks();
      setForm({
        district_code: user.district_code,
        district_name: user.district_name,
        block_name: "",
        block_id: "",
      });
      setOpen(false);
      toast.success("Block added successfully");
    } catch (err) {
      console.error("Add error:", err);
      toast.error("Failed to add block");
    }
  };

  const handleEditClick = (block) => {
    setEditBlock(block);
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    try {
      const payload = {
        block_name: editBlock.block_name,
        block_id: editBlock.block_id,
      };
      const res = await fetch(
        `http://localhost:3000/dashboard/mosquito-blocks/${editBlock.block_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Failed to update block");

      toast.success("Block updated");
      setEditOpen(false);
      setEditBlock(null);
      fetchBlocks();
    } catch (err) {
      toast.error("Error updating block");
    }
  };
  const handleDeleteBlock = async () => {
    if (!blockToDelete) return;

    try {
      const res = await fetch(
        `http://localhost:3000/dashboard/mosquito-blocks/${blockToDelete.block_id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) throw new Error("Delete failed");
      toast.success("Block deleted successfully");

      setDeleteDialogOpen(false);
      setBlockToDelete(null);
      fetchBlocks(); // Refresh list
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete block");
    }
  };

  return (
    <DashboardLayout>
      <ToastContainer position="top-right" autoClose={3000} />
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" mb={2}>
          Mosquito Block Master Table
        </Typography>
        {user && (
          <Box
            sx={{
              border: "1px solid #ccc",
              borderRadius: 2,
              p: 2,
              mb: 2,
              maxWidth: 500,
              position: "relative",
            }}
          >
            <Typography variant="h6" gutterBottom>
              District Officer
            </Typography>
            <Typography>
              <strong>District Name:</strong> {user.district_name}
            </Typography>
            {/* <Typography>
              <strong>District Code:</strong> {user.district_code}
            </Typography> */}
            <Typography>
              <strong>User ID:</strong> {user.user_id}
            </Typography>
            <Box sx={{ position: "absolute", top: 16, right: 16 }}>
              <Button variant="contained" onClick={() => setOpen(true)}>
                Add Block
              </Button>
            </Box>
          </Box>
        )}

        <Table sx={{ mt: 3 }}>
          <TableHead>
            <TableRow>
              {/* <TableCell><strong>Block ID</strong></TableCell> */}
              <TableCell><strong>Block Name</strong></TableCell>
              <TableCell><strong>District Name</strong></TableCell>
              {/* <TableCell><strong>District Code</strong></TableCell> */}
              <TableCell><strong>Edit</strong></TableCell>
              <TableCell><strong>Delete</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...blocks]
              .sort((a, b) => a.block_id.localeCompare(b.block_id))
              .map((b) => (
                <TableRow key={b.block_id}>
                  {/* <TableCell>{b.block_id}</TableCell> */}
                  <TableCell>{b.block_name}</TableCell>
                  <TableCell>{b.district_name}</TableCell>
                  {/* <TableCell>{b.district_code}</TableCell> */}
                  <TableCell>
                    <IconButton onClick={() => handleEditClick(b)}>
                      <Edit />
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => {
                        setBlockToDelete(b);
                        setDeleteDialogOpen(true);
                      }}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>Add New Block</DialogTitle>
          <DialogContent>
            <TextField
              label="District"
              fullWidth
              margin="dense"
              value={form.district_name}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Block Name"
              fullWidth
              margin="dense"
              name="block_name"
              value={form.block_name}
              onChange={handleChange}
              disabled={!form.district_code}
            />
            {form.block_id && (
              <TextField
                label="Generated Block ID"
                fullWidth
                margin="dense"
                value={form.block_id}
                InputProps={{ readOnly: true }}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAdd}>
              Add
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Block</DialogTitle>
          <DialogContent sx={{ minWidth: 400 }}>
            <TextField
              label="Block Name"
              fullWidth
              margin="dense"
              value={editBlock?.block_name || ""}
              onChange={(e) =>
                setEditBlock((prev) => ({
                  ...prev,
                  block_name: e.target.value,
                }))
              }
            />
            <TextField
              label="Block ID"
              fullWidth
              margin="dense"
              value={editBlock?.block_id || ""}
              InputProps={{ readOnly: true }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleEditSave}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete{" "}
              <strong>{blockToDelete?.block_name}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeleteBlock}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </DashboardLayout>
  );
}