import React, { useState } from "react";
import {
  Box,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  TextField,
  Paper,
  IconButton,
  Menu,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import DashboardLayout from "./DashboardLayout";
// import TamilNaduMap from "./TamilNadu";
import UserContributionTable from "./UserContributionTable";
import MosSummaryCard from "./MosquitoSummaryCard";
import LarvaSummaryCards from "./LarvaSummaryCards";
import HouseIndexSummary from "./HouseIndexSummaryCard";
// import HiSupervisionMap from "./HiSupervisionMap";
import HudHiTable from "./DataCollectorCounts";

const Mos_Dashboard = () => {
  const today = new Date();
  const formatDate = (date) => date.toISOString().split("T")[0];

  const nextMonthDate = new Date(today);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(formatDate(nextMonthDate));

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleDownloadClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleDownloadClose = () => {
    setAnchorEl(null);
  };

  const handleDownload = (format) => {
    handleDownloadClose();
    alert(`Downloading as ${format.toUpperCase()} for range ${fromDate || "N/A"} to ${toDate}`);
  };

  return (
    <DashboardLayout>
      <div className="row mb-4">

        {/* {dataBoxes.map(({ title, number }, idx) => (
          <div key={idx} className="col-12 col-sm-6 col-md-3 mb-3 d-flex">
            <div
              className="card text-center w-100"
              style={{
                height: "148px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                borderRadius: "18px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                transition: "box-shadow 0.2s, transform 0.2s",
                fontFamily: "Nunito, Poppins, sans-serif",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(25, 118, 210, 0.18)";
                e.currentTarget.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                e.currentTarget.style.transform = "none";
              }}
            >
              <div className="card-body d-flex flex-column justify-content-center align-items-center p-2">
                <h5 className="card-title" style={{ fontWeight: 700, color: "steelblue", marginBottom: 8 }}>
                  {title}
                </h5>
                <p className="card-text fs-3 fw-bold" style={{ color: "#007556", margin: 0 }}>
                  {number}
                </p>
              </div>
            </div>
          </div>
        ))} */}
      </div>

      {/* Filter and download */}
      {/* <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              fullWidth
              label="From Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              fullWidth
              label="To Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={3}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadClick}
            >
              Download
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleDownloadClose}
            >
              <MenuItem onClick={() => handleDownload("excel")}>Excel</MenuItem>
              <MenuItem onClick={() => handleDownload("csv")}>CSV</MenuItem>
              <MenuItem onClick={() => handleDownload("pdf")}>PDF</MenuItem>
            </Menu>
          </Grid>
        </Grid>
      </Paper> */}
      <Box
          display="flex"
          
          flexWrap="wrap"
          sx={{ mb: 5, ml: 10 }} 
        >
          <MosSummaryCard />
        </Box>
         <Box
          display="flex"
          
          flexWrap="wrap"
          sx={{ mb: 5, ml: 10 }} 
        >
          <LarvaSummaryCards/>
        </Box>
       <Box sx={{ mb: 5, pl: 13}}>
        <HouseIndexSummary />
      </Box>

        {/* <HiSupervisionMap /> */}
         <HudHiTable />
        {/* <TamilNaduMap /> */}
      {/* Table */}
      {/* <UserContributionTable /> */}
    </DashboardLayout>
  );
};

export default Mos_Dashboard;
