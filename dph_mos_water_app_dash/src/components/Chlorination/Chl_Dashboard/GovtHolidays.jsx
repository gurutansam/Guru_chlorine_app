import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Snackbar,
  Alert,
  Paper,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "./DashboardLayout";

const GovtHolidays = () => {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ holiday_name: "", date: "" });
  const [loading, setLoading] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [errorSnack, setErrorSnack] = useState(false);

  // Fetch holidays
  const fetchHolidays = async () => {
    try {
      const response = await fetch("http://localhost:3000/dashboard/govt-holidays");
      if (!response.ok) throw new Error("Failed to fetch holidays");
      const data = await response.json();
      const sorted = data.sort((a, b) => new Date(a.date) - new Date(b.date));
      setRows(sorted);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      setErrorSnack(true);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleSubmit = async () => {
    if (!form.holiday_name || !form.date) {
      alert("Both fields are required");
      return;
    }

    const isValidDate = !isNaN(new Date(form.date).getTime());
    if (!isValidDate) {
      alert("Invalid date format. Use YYYY-MM-DD");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("http://localhost:3000/dashboard/govt-holidays", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) throw new Error("Failed to add holiday");

      setForm({ holiday_name: "", date: "" });
      setSnackOpen(true);
      fetchHolidays(); // Refresh the list
    } catch (error) {
      console.error("Error adding holiday:", error);
      setErrorSnack(true);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: "id", headerName: "ID", width: 90 },
    { field: "holiday_name", headerName: "Holiday", width: 220 },
    { field: "date", headerName: "Date", width: 150 },
  ];

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, paddingTop: 15, background: "#f5f7fa", minHeight: "100vh" }}>
        <Paper
          elevation={3}
          sx={{
            maxWidth: 1000,
            mx: "auto",
            p: { xs: 2, sm: 4 },
            borderRadius: 4,
            boxShadow: "0 4px 24px 0 rgba(33,150,243,0.08)",
            background: "#fff",
            mb: 4,
          }}
        >
          <Typography
            variant="h5"
            gutterBottom
            sx={{
              fontWeight: 700,
              color: "black",
              fontFamily: "Nunito, Poppins, sans-serif",
              mb: 2,

              letterSpacing: 1,
            }}
          >
            Government Holidays
          </Typography>

          <Box
            component="form"
            sx={{
              display: "flex",
              gap: 2,
              mb: 3,
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "flex-start",
            }}
            noValidate
            autoComplete="off"
          >
            <TextField
              label="Holiday Name"
              value={form.holiday_name}
              onChange={(e) => setForm({ ...form, holiday_name: e.target.value })}
              sx={{ minWidth: 180 }}
              size="small"
            />
            <TextField
              label="Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              sx={{ minWidth: 150 }}
              size="small"
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={loading}
              sx={{
                fontWeight: 700,
                px: 3,
                height: 40,
                background: "linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)",
                boxShadow: "0 2px 8px 0 rgba(25, 118, 210, 0.08)",
                borderRadius: 2,
                textTransform: "none",
                "&:hover": {
                  background: "linear-gradient(90deg, #1565c0 0%, #64b5f6 100%)",
                },
              }}
            >
              {loading ? "Submitting..." : "Add"}
            </Button>
          </Box>

          <Box sx={{ height: 400, background: "#fafbfc", borderRadius: 2, p: 1 }}>
            <DataGrid
              rows={rows}
              columns={columns}
              getRowId={(row) => row.id}
              pageSize={5}
              rowsPerPageOptions={[5]}
              sx={{
                fontFamily: "Nunito, Poppins, sans-serif",
                border: "1.5px solid #0b0e11ff",
                borderRadius: 2,
                boxShadow: 1,
                background: "#fafbfc",
                "& .MuiDataGrid-columnHeaders": {
                  color: "#090b0eff",
                  fontWeight: 900,
                  fontSize: "1.1rem",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  borderBottom: "2.5px solid #080c0fff",
                  background: "transparent",
                },
                "& .MuiDataGrid-cell": {
                  borderBottom: "1px solid #e3e3e3",
                  fontSize: "1rem",
                },
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: "#e3f2fd",
                },
                "& .MuiDataGrid-footerContainer": {
                  backgroundColor: "#f5f7fa",
                },
              }}
            />
          </Box>
        </Paper>

        {/* Success Snackbar */}
        <Snackbar
          open={snackOpen}
          autoHideDuration={3000}
          onClose={() => setSnackOpen(false)}
        >
          <Alert onClose={() => setSnackOpen(false)} severity="success" sx={{ width: "100%" }}>
            Holiday added successfully!
          </Alert>
        </Snackbar>

        {/* Error Snackbar */}
        <Snackbar
          open={errorSnack}
          autoHideDuration={3000}
          onClose={() => setErrorSnack(false)}
        >
          <Alert onClose={() => setErrorSnack(false)} severity="error" sx={{ width: "100%" }}>
            Something went wrong!
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
};

export default GovtHolidays;