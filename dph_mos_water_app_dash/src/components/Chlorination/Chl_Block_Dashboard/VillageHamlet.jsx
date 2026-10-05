import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Button,
} from "@mui/material";
import DashboardLayout from "./DashboardLayout";

const BlkVillageHamlet = () => {
  const [plans, setPlans] = useState([]);
  const [villageData, setVillageData] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [user, setUser] = useState(null);
  const [months] = useState([
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ]);
  const [activeMonthIndex, setActiveMonthIndex] = useState(new Date().getMonth());
  const activeMonth = months[activeMonthIndex];

  // Fetch logged-in user's HUD info
  useEffect(() => {
    const fetchLoggedInUser = async () => {
      const username = localStorage.getItem("loggedInUsername");
      if (!username) return;
      try {
        const res = await fetch("http://localhost:3000/dashboard/block-users");
        const data = await res.json();
        const matched = data.find((u) => u.username === username);
        setUser(matched || null);
      } catch (err) {
        console.error("Error fetching HUD master users:", err);
      }
    };
    fetchLoggedInUser();
  }, []);

  // Fetch blocks filtered by user's HUD id
  useEffect(() => {
    if (user?.hud_id) {
      fetchBlocks();
    }
  }, [user]);

  const fetchBlocks = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/hud-blocks");
      if (!res.ok) throw new Error("Failed to fetch blocks");
      const data = await res.json();
      const filteredBlocks = data.filter((b) => b.hud_id === user.hud_id);
      setBlocks(filteredBlocks);
    } catch (err) {
      console.error(err);
      setBlocks([]);
    }
  };

  // Fetch village plans
  useEffect(() => {
    fetchPlans();
    fetchVillageData();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/village-water-plan");
      const data = await res.json();
      setPlans(data);
    } catch (err) {
      console.error("Error fetching plans:", err);
    }
  };

  const fetchVillageData = async () => {
    try {
      const res = await fetch("http://localhost:3000/dashboard/village");
      const data = await res.json();
      setVillageData(data);
    } catch (err) {
      console.error("Error fetching villages:", err);
    }
  };

  // Filter plans by active month AND blocks owned by logged-in user
  const userBlockIds = blocks.map((b) => b.block_id);
  const filteredPlans = plans.filter(
    (p) => p.month === activeMonth && userBlockIds.includes(p.block_id)
  );

  const totalSamples = filteredPlans.reduce((sum, p) => sum + (p.samples || 0), 0);

  const handleNext = () => {
    if (activeMonthIndex < months.length - 1) setActiveMonthIndex((prev) => prev + 1);
  };

  const handlePrevious = () => {
    if (activeMonthIndex > 0) setActiveMonthIndex((prev) => prev - 1);
  };

  return (
    <DashboardLayout>
      <Box p={2} pt={20} pl={10}>
        <Typography variant="h6" fontWeight="bold" align="center" gutterBottom>
          Sample District – Water Sample Collection Plan
        </Typography>

        {/* No add button */}

        <TableContainer component={Paper}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell>HUD</TableCell>
                <TableCell>Block</TableCell>
                <TableCell>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Button size="small" onClick={handlePrevious} disabled={activeMonthIndex === 0}>
                      ←
                    </Button>
                    <Typography variant="subtitle1" fontWeight="bold" textTransform="capitalize">
                      {activeMonth}
                    </Typography>
                    <Button size="small" onClick={handleNext} disabled={activeMonthIndex === months.length - 1}>
                      →
                    </Button>
                  </Box>
                </TableCell>
                <TableCell>Samples</TableCell>
                <TableCell>Village</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPlans.map((plan, index) => (
                <TableRow key={plan.id || index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{plan.hud_name}</TableCell>
                  <TableCell>{plan.block_name}</TableCell>
                  <TableCell>{activeMonth}</TableCell>
                  <TableCell>{plan.samples}</TableCell>
                  <TableCell>{plan.village_name}</TableCell>
                  <TableCell>{plan.date}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} align="right" sx={{ fontWeight: "bold" }}>
                  Total Samples
                </TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>{totalSamples}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </DashboardLayout>
  );
};

export default BlkVillageHamlet;
