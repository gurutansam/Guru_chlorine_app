import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Divider,
} from "@mui/material";

// classify function
const classifyPpm = (ppmValue, samplingPoint) => {
  const raw = parseFloat(ppmValue);
  if (isNaN(raw)) return { ppm: 0, status: "Nil" };
  const ppm = raw > 0 && raw < 0.1 ? 0 : Math.round(raw * 10) / 10;
  const s = (samplingPoint || "").toUpperCase();
  if ((s === "TAIL" || s === "MID") && ppm >= 0.2) return { ppm, status: "Adequate" };
  if ((s === "OHT" || s === "GLR" || s === "SUMP") && ppm >= 1) return { ppm, status: "Adequate" };
  if ((s === "TAIL" || s === "MID") && ppm > 0 && ppm < 0.2) return { ppm, status: "Inadequate" };
  if ((s === "OHT" || s === "GLR" || s === "SUMP") && ppm > 0 && ppm < 1) return { ppm, status: "Inadequate" };
  if (ppm === 0) return { ppm, status: "Nil" };
  return { ppm, status: "Nil" };
};

// professional colors
const COLOR_MAP = {
  Adequate: "#2e7d32",
  Inadequate: "#ed6c02",
  Nil: "#c62828",
  Total: "#37474f",
};

export default function PpmSummaryCards() {
  const [rows, setRows] = useState([]);
  const [hudBlocks, setHudBlocks] = useState([]);
  const [hudList, setHudList] = useState([]);
  const [blockList, setBlockList] = useState([]);
  const [userHubId, setUserHubId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedHud, setSelectedHud] = useState(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // 1️⃣ Logged-in user
        const userStr = localStorage.getItem("loggedInUser");
        const userObj = userStr ? JSON.parse(userStr) : null;
        if (!userObj?.username) return;

        // 2️⃣ Get hub info for user
        const userRes = await fetch("http://localhost:3000/dashboard/chl-hubusers");
        const userData = await userRes.json();
        const loggedUser = userData.find((u) => u.username === userObj.username);
        if (!loggedUser) return;
        setUserHubId(loggedUser.hub_id);

        // 3️⃣ Fetch blocks and HUDs
        const [blockRes, hudRes] = await Promise.all([
          fetch("http://localhost:3000/dashboard/hud-blocks"),
          fetch("http://localhost:3000/dashboard/hud"),
        ]);
        const blocks = await blockRes.json();
        const huds = await hudRes.json();
        setBlockList(blocks);
        setHudList(huds);

        // 4️⃣ Map block → hub
        const blockToHub = {};
        blocks.forEach((block) => {
          const hud = huds.find((h) => h.hud_id === block.hud_id);
          if (hud) blockToHub[block.block_id] = hud.hub_id;
        });

        // 5️⃣ Fetch chlorination data
        const chlRes = await fetch("http://localhost:3000/dashboard/chl_hud_datacollection");
        const chlData = await chlRes.json();

        // 6️⃣ Filter by user hub
        const filtered = chlData
          .filter((item) => blockToHub[item.block_id] === loggedUser.hub_id)
          .map((item, index) => ({ id: index + 1, ...item }));

        setRows(filtered);
        setHudBlocks(blocks);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // compute counts
  const getCounts = (data) => {
    const c = { Adequate: 0, Inadequate: 0, Nil: 0 };
    data.forEach((row) => {
      const { status } = classifyPpm(row.ppm, row.samplingPoint);
      c[status] += 1;
    });
    c.Total = c.Adequate + c.Inadequate + c.Nil;
    return c;
  };

  // HUD summary
  const hudSummary = useMemo(() => {
    const grouped = {};
    hudBlocks.forEach((b) => {
      if (!grouped[b.hud_id]) grouped[b.hud_id] = { hud_name: b.hud_name, rows: [] };
    });
    rows.forEach((row) => {
      const block = hudBlocks.find((b) => b.block_id === row.block_id);
      if (block && grouped[block.hud_id]) grouped[block.hud_id].rows.push(row);
    });
    return Object.entries(grouped).map(([hud_id, { hud_name, rows }]) => ({
      hud_id,
      hud_name,
      counts: getCounts(rows),
    }));
  }, [rows, hudBlocks]);

  // Block summary
  const blockSummary = useMemo(() => {
    if (!selectedHud) return [];
    const blocks = hudBlocks.filter((b) => b.hud_id === selectedHud);
    return blocks.map((block) => {
      const blockRows = rows.filter((r) => r.block_id === block.block_id);
      return {
        block_id: block.block_id,
        block_name: block.block_name,
        counts: getCounts(blockRows),
      };
    });
  }, [selectedHud, rows, hudBlocks]);

  if (loading) return <Box display="flex" justifyContent="center" alignItems="center" height={200}><CircularProgress /></Box>;

  const renderCards = (items, type = "HUD") => (
    <Box display="flex" flexWrap="wrap" gap={3} mt={2} pl={10}>
      {items.map((item) => (
        <Card
          key={type === "HUD" ? item.hud_id : item.block_id}
          sx={{
            width: 370,
            minHeight: 240,
            borderRadius: 3,
            boxShadow: 3,
            cursor: type === "HUD" ? "pointer" : "default",
            transition: "0.3s",
            "&:hover": type === "HUD" ? { transform: "translateY(-4px)", boxShadow: 6 } : {},
          }}
          onClick={() => { if (type === "HUD") setSelectedHud(item.hud_id); }}
        >
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: "#37474f" }}>
              {type === "HUD" ? item.hud_name : item.block_name}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5}>
              {["Adequate", "Inadequate", "Nil", "Total"].map((status) => (
                <Box key={status} sx={{
                  p: 1.2,
                  borderRadius: 2,
                  border: `1px solid ${COLOR_MAP[status]}`,
                  textAlign: "center",
                  backgroundColor: "#fafafa",
                }}>
                  <Typography variant="body2" sx={{ color: COLOR_MAP[status], fontWeight: 500 }}>{status}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: "bold", color: "#212121" }}>{item.counts[status]}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );

  return (
    <Box p={3}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold", pl: 10 }}>
        {selectedHud ? "Block Summary" : "HUD-wise PPM Summary"}
      </Typography>

      {selectedHud ? (
        <>
          <Typography variant="body2" sx={{ mb: 2, cursor: "pointer", color: "#1976d2", pl: 10 }} onClick={() => setSelectedHud(null)}>
            ← Back to HUDs
          </Typography>
          {renderCards(blockSummary, "BLOCK")}
        </>
      ) : (
        renderCards(hudSummary, "HUD")
      )}
    </Box>
  );
}
