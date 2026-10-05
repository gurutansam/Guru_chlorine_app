import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider,
  Button,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const DataCollectionDownload = ({ rows }) => {
  const [selectedFilter, setSelectedFilter] = useState("all");

  const filteredRows = useMemo(() => {
    if (selectedFilter === "all") return rows;
    if (selectedFilter === "adequate")
      return rows.filter((row) => row.status === "Adequate");
    if (selectedFilter === "under")
      return rows.filter((row) => row.status === "Under-chlorinated");
    if (selectedFilter === "over")
      return rows.filter((row) => row.status === "Over-chlorinated");
    return rows;
  }, [rows, selectedFilter]);

  const handleDownloadExcel = () => {
    const exportData = filteredRows.map((row) => ({
      ID: row.id,
      District: row.district_name,
      "User ID": row.userId,
      Username: row.username,
      "Area Type": row.areaType,
      Date: row.date,
      Time: row.time,
      "User Location": row.userGeo,
      "Survey Location": row.geo,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "User Data");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, "User_Contributions.xlsx");
  };

  const getCountByStatus = (status) =>
    rows.filter((row) => row.status === status).length;

  return (
    <Box m={2} pt={1}>
      <Typography variant="h6" gutterBottom>
        User Contributions
      </Typography>

      <Divider sx={{ mb: 2 }} />

      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <FormControl variant="outlined" size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Filter by Status</InputLabel>
          <Select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            label="Filter by Status"
          >
            <MenuItem value="all">All ({rows.length})</MenuItem>
            <MenuItem value="adequate">Adequate ({getCountByStatus("Adequate")})</MenuItem>
            <MenuItem value="under">
              Under-chlorinated ({getCountByStatus("Under-chlorinated")})
            </MenuItem>
            <MenuItem value="over">
              Over-chlorinated ({getCountByStatus("Over-chlorinated")})
            </MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="contained"
          color="primary"
          onClick={handleDownloadExcel}
          sx={{
            fontFamily: "Nunito, sans-serif",
            textTransform: "none",
            fontWeight: 500,
          }}
        >
          Download Excel
        </Button>
      </Box>

      <Paper elevation={3}>
        <DataGrid
          autoHeight
          rows={filteredRows}
          columns={[
            { field: "id", headerName: "ID", width: 80 },
            { field: "district_name", headerName: "District", width: 160 },
            { field: "userId", headerName: "User ID", width: 120 },
            { field: "username", headerName: "Username", width: 150 },
            { field: "areaType", headerName: "Area Type", width: 130 },
            { field: "date", headerName: "Date", width: 120 },
            { field: "time", headerName: "Time", width: 100 },
            { field: "userGeo", headerName: "User Location", width: 180 },
            { field: "geo", headerName: "Survey Location", width: 180 },
          ]}
          pageSize={10}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </Paper>
    </Box>
  );
};

export default DataCollectionDownload;
