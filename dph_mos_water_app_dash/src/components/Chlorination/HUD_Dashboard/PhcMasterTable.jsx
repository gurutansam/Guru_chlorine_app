import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DashboardLayout from "./DashboardLayout";

export default function PhcMasterTable() {
  const [phcs, setPhcs] = useState([]);
  const [allHuds, setAllHuds] = useState([]);
  const [allBlocks, setAllBlocks] = useState([]);
  const [filteredBlocks, setFilteredBlocks] = useState([]);

  const [open, setOpen] = useState(false);
  const [phcName, setPhcName] = useState("");
  const [selectedHud, setSelectedHud] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("");
  const [hubId, setHubId] = useState("");
  const hud = allHuds.find((h) => h.hud_id === hubId);
  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editPhcId, setEditPhcId] = useState(null);
  const [editPhcName, setEditPhcName] = useState("");
  const [editSelectedHud, setEditSelectedHud] = useState("");
  const [editSelectedBlock, setEditSelectedBlock] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (user?.hud_id) {
      setHubId(user.hud_id);
      setSelectedHud(user.hud_id);
    }
  }, []);

  useEffect(() => {
    if (!hubId) return;

    const fetchData = async () => {
      try {
        // get HUD data
        const hudRes = await fetch("http://localhost:3000/dashboard/hud");
        const hudData = await hudRes.json();
        setAllHuds(hudData);

        // get BLOCKS under this HUD
        const blockRes = await fetch("http://localhost:3000/dashboard/hud-blocks");
        const blockData = await blockRes.json();
        setAllBlocks(blockData.filter((b) => b.hud_id === hubId));

        // get PHC under this HUD
        const phcRes = await fetch("http://localhost:3000/dashboard/phc");
        const phcData = await phcRes.json();
        setPhcs(phcData.filter((p) => p.hud_id === hubId));

      } catch (err) {
        console.error("Fetch error:", err);
      }
    };

    fetchData();
  }, [hubId]);


  // when HUD selection changes, update blocks list
  useEffect(() => {
    if (!selectedHud) {
      setFilteredBlocks([]);
      setSelectedBlock("");
      return;
    }
    const f = allBlocks.filter((b) => b.hud_id === selectedHud);
    setFilteredBlocks(f);
    // if the currently selected block is not in new filtered list, clear it
    if (!f.find((x) => x.block_id === selectedBlock)) setSelectedBlock("");
  }, [selectedHud, allBlocks]);

  // same for edit HUD -> edit blocks
  useEffect(() => {
    if (!editSelectedHud) return;
    const f = allBlocks.filter((b) => b.hud_id === editSelectedHud);
    // don't store separately; we just ensure editSelectedBlock validity
    if (!f.find((x) => x.block_id === editSelectedBlock)) setEditSelectedBlock("");
  }, [editSelectedHud, allBlocks]);

  // Add PHC
  const handleAdd = async () => {
    if (!phcName.trim() || !selectedHud || !selectedBlock) return alert("Fill all fields");
    const hud = allHuds.find((h) => h.hud_id === selectedHud);
    const block = allBlocks.find((b) => b.block_id === selectedBlock);

    try {
      const res = await fetch("http://localhost:3000/dashboard/phc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phc_name: phcName.trim(),
          hud_id: hud.hud_id,
          hud_name: hud.hud_name,
          block_id: block.block_id,
          block_name: block.block_name,
        }),
      });

      if (!res.ok) throw new Error("Failed to add PHC");
      setPhcName("");
      setSelectedHud("");
      setSelectedBlock("");
      setOpen(false);

      // reload list — lightweight approach
      const phcRes = await fetch("http://localhost:3000/dashboard/phc");
      const phcData = await phcRes.json();
      setPhcs(phcData);
    } catch (err) {
      alert("Error adding PHC: " + err.message);
    }
  };

  // Delete PHC
  const handleDelete = async (phc_id) => {
    if (!window.confirm("Are you sure you want to delete this PHC?")) return;
    try {
      const res = await fetch(`http://localhost:3000/dashboard/phc/${phc_id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      // update local list
      setPhcs((prev) => prev.filter((p) => p.phc_id !== phc_id));
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  // Open edit dialog with PHC data
  const handleEditClick = (phc) => {
    setEditPhcId(phc.phc_id);
    setEditPhcName(phc.phc_name);
    setEditSelectedHud(phc.hud_id);
    setEditSelectedBlock(phc.block_id);
    setEditOpen(true);
  };

  // Save edited PHC
  const handleEditSave = async () => {
    if (!editPhcName.trim() || !editSelectedHud || !editSelectedBlock)
      return alert("Fill all fields");

    const hud = allHuds.find((h) => h.hud_id === editSelectedHud);
    const block = allBlocks.find((b) => b.block_id === editSelectedBlock);

    try {
      const res = await fetch(`http://localhost:3000/dashboard/phc/${editPhcId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phc_name: editPhcName.trim(),
          hud_id: hud.hud_id,
          hud_name: hud.hud_name,
          block_id: block.block_id,
          block_name: block.block_name,
        }),
      });

      if (!res.ok) throw new Error("Failed to update PHC");

      // update local list
      setPhcs((prev) =>
        prev.map((p) =>
          p.phc_id === editPhcId
            ? {
              ...p,
              phc_name: editPhcName.trim(),
              hud_id: hud.hud_id,
              hud_name: hud.hud_name,
              block_id: block.block_id,
              block_name: block.block_name,
            }
            : p
        )
      );

      setEditOpen(false);
      setEditPhcId(null);
      setEditPhcName("");
      setEditSelectedHud("");
      setEditSelectedBlock("");
    } catch (err) {
      alert("Error updating PHC: " + err.message);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, paddingTop: 20, paddingLeft: 10 }}>
        <Typography variant="h5" mb={2}>
          PHC Master Table
        </Typography>

        <Button variant="contained" onClick={() => setOpen(true)} sx={{ float: "right", mb: 2 }}>
          Add PHC
        </Button>

        <Table sx={{ mt: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell><strong>PHC Name</strong></TableCell>
              <TableCell><strong>HUD Name</strong></TableCell>
              <TableCell><strong>Block Name</strong></TableCell>
              <TableCell align="center"><strong>Edit</strong></TableCell>
              <TableCell align="center"><strong>Delete</strong></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {phcs.map((p) => (
              <TableRow key={p.phc_id}>
                <TableCell>{p.phc_name}</TableCell>
                <TableCell>{p.hud_name}</TableCell>
                <TableCell>{p.block_name}</TableCell>
                <TableCell align="center">
                  <IconButton sx={{ color: "blue" }} onClick={() => handleEditClick(p)}>
                    <EditIcon />
                  </IconButton>
                </TableCell>
                <TableCell align="center">
                  <IconButton sx={{ color: "red" }} onClick={() => handleDelete(p.phc_id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Add Dialog */}
        {/* ADD PHC DIALOG */}
        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>Add New PHC</DialogTitle>
          <DialogContent>

            {/* 1️⃣ HUD - READ ONLY */}
            <TextField
              label="HUD"
              fullWidth
              value={
                allHuds.find((h) => h.hud_id === hubId)?.hud_name || "Unknown HUD"
              }
              margin="dense"
              InputProps={{ readOnly: true }}
            />

            {/* 2️⃣ BLOCK DROPDOWN (Filter only blocks under this HUD) */}
            <Select
              fullWidth
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
              displayEmpty
              sx={{ mt: 2 }}
            >
              <MenuItem value="" disabled>Select Block</MenuItem>

              {allBlocks
                .filter((b) => b.hud_id === hubId)
                .map((b) => (
                  <MenuItem key={b.block_id} value={b.block_id}>
                    {b.block_name} ({b.block_id})
                  </MenuItem>
                ))}
            </Select>

            {/* 3️⃣ PHC NAME */}
            <TextField
              label="PHC Name"
              fullWidth
              value={phcName}
              onChange={(e) => setPhcName(e.target.value)}
              margin="dense"
              sx={{ mt: 2 }}
              disabled={!selectedBlock}
            />
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleAdd}
              disabled={!phcName.trim() || !selectedBlock}
            >
              Add
            </Button>
          </DialogActions>
        </Dialog>


        {/* EDIT PHC DIALOG (HUD Read-only like ADD dialog) */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
          <DialogTitle>Edit PHC</DialogTitle>
          <DialogContent>

            {/* 1️⃣ HUD - READ ONLY */}
            <TextField
              label="HUD"
              fullWidth
              value={
                allHuds.find((h) => h.hud_id === editSelectedHud)?.hud_name ||
                "Unknown HUD"
              }
              margin="dense"
              InputProps={{ readOnly: true }}
              sx={{ mt: 1 }}
            />

            {/* 2️⃣ BLOCK DROPDOWN (Filter only blocks under this HUD) */}
            <Select
              fullWidth
              value={editSelectedBlock}
              onChange={(e) => setEditSelectedBlock(e.target.value)}
              displayEmpty
              sx={{ mt: 2 }}
            >
              <MenuItem value="" disabled>Select Block</MenuItem>

              {allBlocks
                .filter((b) => b.hud_id === editSelectedHud)
                .map((b) => (
                  <MenuItem key={b.block_id} value={b.block_id}>
                    {b.block_name} ({b.block_id})
                  </MenuItem>
                ))}
            </Select>

            {/* 3️⃣ PHC NAME */}
            <TextField
              label="PHC Name"
              fullWidth
              value={editPhcName}
              onChange={(e) => setEditPhcName(e.target.value)}
              margin="dense"
              sx={{ mt: 2 }}
              disabled={!editSelectedBlock}
            />

          </DialogContent>

          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleEditSave}
              disabled={
                !editPhcName.trim() ||
                !editSelectedHud ||
                !editSelectedBlock
              }
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>



      </Box>
    </DashboardLayout>
  );
}
