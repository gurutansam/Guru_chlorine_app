import React from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Divider,
  Typography,
  IconButton,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LogoutIcon from "@mui/icons-material/Logout";
import BarChartIcon from "@mui/icons-material/BarChart";
import MenuIcon from "@mui/icons-material/Menu";
import { useNavigate, useLocation } from "react-router-dom";

const CorpSidebar = ({ isOpen, closeSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { text: "Home", icon: <HomeIcon />, href: "/corp_dashboard" },
    { text: "Municipality Master Data", icon: <DashboardIcon />, href: "/mosquito-corp-municipality-master-table" },
    { text: "Municipality User", icon: <DashboardIcon />, href: "/mosquito-municipality-master-user" },
    { text: "Add Corporation Health Inspector", icon: <DashboardIcon />, href: "/mosquito-corp-users" },
    { text: "Data Sets", icon: <BarChartIcon />, href: "/mosquito-corp-data" },
  ];

  const handleLogout = () => {
    navigate("/");
  };

  const drawerStyles = {
    boxSizing: "border-box",
    width: 250,
    backgroundColor: "#f5f5f5",
    color: "#333",
    borderRight: "1px solid #e0e0e0",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    paddingTop: "175px",
  };

  const listItemButtonStyle = {
    borderRadius: "1px",
    margin: "6px 12px",
    padding: "10px 14px",
    transition: "all 0.3s ease",
    fontWeight: 500,
    fontSize: "0.95rem",
    letterSpacing: "0.3px",

    "&.Mui-selected": {
      backgroundColor: "rgba(13, 71, 161, 0.15)",
      color: "#0D47A1",
      borderLeft: "4px solid #0D47A1",
      boxShadow: "inset 2px 0 0 #0D47A1",
      "& .MuiListItemIcon-root": {
        color: "#0D47A1",
      },
    },
    "&.Mui-selected:hover": {
      backgroundColor: "rgba(13, 71, 161, 0.2)",
    },
    "&:hover": {
      backgroundColor: "rgba(21, 101, 192, 0.08)",
      color: "#1565c0",
      transform: "translateX(2px)",
      "& .MuiListItemIcon-root": {
        color: "#1565c0",
      },
    },
  };

  const logoutButtonStyle = {
    color: "#d32f2f",
    "& .MuiListItemIcon-root": {
      color: "#d32f2f",
    },
    "&:hover": {
      backgroundColor: "#ffebee",
      color: "#b71c1c",
      "& .MuiListItemIcon-root": {
        color: "#b71c1c",
      },
    },
  };

  const renderSidebarList = () => (
    <List>
      {navItems.map((item, index) => (
        <ListItem key={index} disablePadding>
          <ListItemButton
            component="a"
            href={item.href}
            sx={listItemButtonStyle}
            selected={location.pathname === item.href}
            onClick={closeSidebar}
          >
            <ListItemIcon sx={{ color: "#666" }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={isOpen}
        onClose={closeSidebar}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": drawerStyles,
        }}
      >
        <Box sx={{ flexGrow: 1 }}>{renderSidebarList()}</Box>
        <Divider />
        <Box>
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout} sx={logoutButtonStyle}>
              <ListItemIcon>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </ListItem>
        </Box>
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": drawerStyles,
        }}
      >
        <Box sx={{ flexGrow: 1 }}>{renderSidebarList()}</Box>
        <Divider />
        <Box>
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout} sx={logoutButtonStyle}>
              <ListItemIcon>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </ListItem>
        </Box>
      </Drawer>

      {/* Header for mobile */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          mb: 2,
        }}
      >
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ mr: 2, display: { xs: "block", md: "none" } }}
          onClick={closeSidebar}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Dashboard
        </Typography>
      </Box>
    </>
  );
};

export default CorpSidebar;
