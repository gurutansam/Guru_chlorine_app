import React, { useEffect, useState } from "react";
import {
  Box,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Typography,
  CircularProgress,
  TextField,
} from "@mui/material";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import { toast } from "react-toastify";

const DistUserContributionTable = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [usernameFilter, setUsernameFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [districtUser, setDistrictUser] = useState(null);

  const totalTarget = 50;

  // Fetch logged-in district officer
  useEffect(() => {
    const fetchDistrictUser = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/district-officers");
        const users = await res.json();
        const loggedInUsername = localStorage.getItem("loggedInUsername");
        const matchedUser = users.find(
          (u) => u.username.toLowerCase() === loggedInUsername?.toLowerCase()
        );
        if (matchedUser) {
          setDistrictUser(matchedUser);
        } else {
          toast.error("Not authorized or user not found");
        }
      } catch (err) {
        console.error(err);
        toast.error("Error fetching district user");
      }
    };
    fetchDistrictUser();
  }, []);

  // Fetch user contribution data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/datacollection");
        const json = await res.json();

        const districtRes = await fetch("http://localhost:3000/dashboard/mos-district");
        const districts = await districtRes.json();

        const counts = {};

        json.forEach((item) => {
          const username = item.username;
          const userId = item.user_id;
          const districtCode = userId?.substring(0, 7).toUpperCase();
          const districtMatch = districts.find((d) =>
            d.district_code?.toUpperCase().startsWith(districtCode)
          );
          const district = districtMatch?.district_name || "Unknown";

          // Only include logged-in user's district
          if (districtUser && district !== districtUser.district_name) return;

          if (!counts[username]) {
            counts[username] = { username, count: 1, district };
          } else {
            counts[username].count += 1;
          }
        });

        setData(Object.values(counts));
        setFilteredData(Object.values(counts));
      } catch (err) {
        console.error(err);
        toast.error("Error fetching user contribution data");
      }
    };

    if (districtUser) fetchData();
  }, [districtUser]);

  // Filter whenever username / date changes
  useEffect(() => {
    if (!districtUser) return;

    let filtered = [...data];

    if (usernameFilter) filtered = filtered.filter((d) => d.username === usernameFilter);

    if (fromDate)
      filtered = filtered.filter((d) =>
        new Date(d.timestamp).toISOString().split("T")[0] >= fromDate
      );
    if (toDate)
      filtered = filtered.filter((d) =>
        new Date(d.timestamp).toISOString().split("T")[0] <= toDate
      );

    setFilteredData(filtered);
  }, [usernameFilter, fromDate, toDate, data, districtUser]);

  const downloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("User Contributions");

    worksheet.columns = [
      { header: "S.No", key: "sno", width: 10 },
      { header: "Username", key: "username", width: 25 },
      { header: "District", key: "district", width: 25 },
      { header: "Houses Visited", key: "count", width: 15 },
      { header: "Total Target", key: "totalTarget", width: 15 },
    ];

    filteredData.forEach((item, index) => {
      worksheet.addRow({
        sno: index + 1,
        username: item.username,
        district: item.district,
        count: item.count,
        totalTarget: totalTarget,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "UserContributionReport.xlsx"
    );
  };

  if (!data.length)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  const usernameOptions = [...new Set(data.map((d) => d.username))].sort();
  const totalEntries = filteredData.reduce((sum, u) => sum + u.count, 0);

  return (

    <Box sx={{ mt: 6, ml: 2, mr: 2 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        HOUSES VISITED BY USERS
      </Typography>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel>User</InputLabel>
          <Select
            value={usernameFilter}
            onChange={(e) => setUsernameFilter(e.target.value)}
            label="User"
          >
            <MenuItem value="">All Users</MenuItem>
            {usernameOptions.map((user, idx) => (
              <MenuItem key={idx} value={user}>
                {user}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          color="success"
          startIcon={<DownloadForOfflineIcon />}
          onClick={downloadExcel}
        >
          Download Excel
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>S.NO</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>District</TableCell>
              <TableCell>Houses Visited</TableCell>
              <TableCell>Total Target</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map((user, idx) => {
              const isTargetMet = user.count >= totalTarget;
              return (
                <TableRow key={idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.district}</TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      textAlign: "center",
                      bgcolor: isTargetMet ? "#d4edda" : "#f8d7da",
                    }}
                  >
                    {user.count}
                  </TableCell>
                  <TableCell>{totalTarget}</TableCell>
                </TableRow>
              );
            })}
            <TableRow sx={{ fontWeight: "bold", backgroundColor: "#f1f1f1" }}>
              <TableCell colSpan={3} align="right">
                Total
              </TableCell>
              <TableCell>{totalEntries}</TableCell>
              <TableCell>{totalTarget}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>

  );
};

export default DistUserContributionTable;
