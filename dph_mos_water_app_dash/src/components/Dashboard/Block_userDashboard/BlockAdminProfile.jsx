import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Button,
  Divider,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Close";
import DashboardLayout from "./DashboardLayout";

const AdminProfile = () => {
  const [formData, setFormData] = useState({
    firstName: localStorage.getItem("loggedInName")?.split(" ")[0] || "David",
    lastName: localStorage.getItem("loggedInName")?.split(" ")[1] || "Warner",
    email: localStorage.getItem("loggedInEmail") || "admin@example.com",
    password: "",
  });

  const [editMode, setEditMode] = useState({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
  });

  const [errors, setErrors] = useState({
    password: "",
  });

  const handleInputChange = (field) => (e) => {
    const value = e.target.value;
    setFormData({ ...formData, [field]: value });

    if (field === "password") {
      const isValid =
        value.length >= 6 && /[a-zA-Z]/.test(value) && /[0-9]/.test(value);

      setErrors({
        ...errors,
        password: isValid
          ? ""
          : "Password must be at least 6 characters and include letters and numbers",
      });
    }
  };

  const toggleEdit = (field) => {
    setEditMode((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = () => {
    if (errors.password) return alert("Fix password errors before saving.");
    alert("Profile updated successfully!");
    console.log("Updated Profile:", formData);
  };

  return (
    <DashboardLayout>
      <Box sx={{ py: 4, px: 2 }}>
        <Paper
          elevation={4}
          sx={{
            maxWidth: 700,
            mx: "auto",
            px: 5,
            py: 5,
            borderRadius: 4,
            fontFamily: "Nunito, sans-serif",
          }}
        >
          <Typography
            variant="h4"
            align="center"
            fontWeight="700"
            color="#2A2F5B"
            gutterBottom
          >
            {`${formData.firstName} ${formData.lastName}`}
          </Typography>

          <Typography align="center" variant="subtitle1" color="text.secondary" mb={4}>
            Manage your profile details
          </Typography>

          <Divider sx={{ mb: 4 }} />

          {[
            { label: "First Name:", field: "firstName" },
            { label: "Last Name:", field: "lastName" },
            { label: "Email:", field: "email" },
            { label: "Password:", field: "password", type: "password" },
          ].map(({ label, field, type }) => (
            <Box
              key={field}
              display="flex"
              alignItems="center"
              mb={3}
              sx={{ gap: 2 }}
            >
              <Box sx={{ width: 150 }}>
                <Typography fontWeight={600}>{label}</Typography>
              </Box>

              <Box flex={1}>
                {editMode[field] ? (
                  <TextField
                    fullWidth
                    size="small"
                    type={type || "text"}
                    value={formData[field]}
                    onChange={handleInputChange(field)}
                    error={field === "password" && Boolean(errors.password)}
                    helperText={field === "password" && errors.password}
                  />
                ) : (
                  <Typography>{field === "password"
                    ? "*".repeat(formData.password?.length || 8)
                    : formData[field]}</Typography>
                )}
              </Box>

              <Box>
                {editMode[field] ? (
                  <>
                    <IconButton onClick={() => toggleEdit(field)} color="primary">
                      <SaveIcon />
                    </IconButton>
                    <IconButton onClick={() => toggleEdit(field)} color="error">
                      <CancelIcon />
                    </IconButton>
                  </>
                ) : (
                  <IconButton onClick={() => toggleEdit(field)} color="primary">
                    <EditIcon />
                  </IconButton>
                )}
              </Box>
            </Box>
          ))}

          <Divider sx={{ mt: 4, mb: 3 }} />

          <Box display="flex" justifyContent="center" mt={2}>
            <Button
              variant="contained"
              size="large"
              startIcon={<SaveIcon />}
              onClick={handleSubmit}
              sx={{
                backgroundColor: "#2A2F5B",
                px: 5,
                "&:hover": {
                  backgroundColor: "#1E2343",
                },
              }}
            >
             Submit
            </Button>
          </Box>
        </Paper>
      </Box>
    </DashboardLayout>
  );
};

export default AdminProfile;
