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
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LogoutIcon from "@mui/icons-material/Logout";
import BarChartIcon from "@mui/icons-material/BarChart";
import MenuIcon from "@mui/icons-material/Menu";
import IconButton from "@mui/material/IconButton";
import { useNavigate, useLocation } from "react-router-dom";

const Sidebar = ({ isOpen, closeSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { text: "Home", icon: <HomeIcon />, href: "/mosquito-admin-dashboard" },
    { text: "State", icon: <DashboardIcon />, href: "/state" },
    { text: "Corporation User", icon: <DashboardIcon />, href: "/corporation-user" },
    { text: "District Master Data", icon: <DashboardIcon />, href: "/mos-district-master-table" },
    { text: "Corporation Master Data", icon: <DashboardIcon />, href: "/mos-corp-master-table" },
    { text: "HI Supervision Map", icon: <DashboardIcon />, href: "/hi-supervision-map" },
    { text: "DBC Supervision Map", icon: <DashboardIcon />, href: "/tamilnadu-map" },
    { text: "HI Supervision", icon: <DashboardIcon />, href: "/hi-supervision" },
    { text: "Administrators Supervision", icon: <DashboardIcon />, href: "/special-hi-supervision" },
    { text: "Larval Survey", icon: <DashboardIcon />, href: "/hi-supervision-larva" },
    {text:"Administrators Larval Survey", icon:<DashboardIcon />, href:"/special-larva-entry"},
    { text: "Source Reduction Report", icon: <DashboardIcon />, href: "/larva-index" },
    { text: "Data Sets", icon: <BarChartIcon />, href: "/data" },
  ];

  const handleLogout = () => {
    navigate("/"); 
  };

   const drawerStyles = {
    boxSizing: "border-box",
    width: 333,
    backgroundColor: "#f5f5f5",
    color: "#333",
    borderRight: "1px solid #e0e0e0",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    paddingTop: "165px",
  };
const listItemButtonStyle = {
  borderRadius: "1px",
  margin: "6px 12px",
  padding: "10px 14px",
  transition: "all 0.3s ease",
  fontWeight: 500,
  fontSize: "0.95rem",
  letterSpacing: "0.3px",
  display: "flex",
  alignItems: "center",

  "&.Mui-selected": {
    backgroundColor: "rgba(13, 71, 161, 0.15)", // smoother blue tint
    color: "#0D47A1",
    borderLeft: "5px solid #0D47A1",
    boxShadow: "inset 2px 0 0 #0D47A1", // subtle inset
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
    transform: "translateX(2px)", // slight motion
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
        <Box sx={{ flexGrow: 1 }}>
          <List>
            {navItems.map((item, index) => (
              <ListItem key={index} disablePadding>
                <ListItemButton
                  component="a"
                  href={item.href}
                  onClick={closeSidebar}
                  sx={listItemButtonStyle}
                  selected={location.pathname === item.href}
                >
                  <ListItemIcon sx={{ color: "#666" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
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
        <Box sx={{ flexGrow: 1 }}>
          <List>
            {navItems.map((item, index) => (
              <ListItem key={index} disablePadding>
                <ListItemButton
                  component="a"
                  href={item.href}
                  sx={listItemButtonStyle}
                  selected={location.pathname === item.href}
                >
                  <ListItemIcon sx={{ color: "#666" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
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

      {/* Header with Hamburger Menu Icon */}
      <Box
        sx={{
          display: "flex", // Always flex, so always visible
          alignItems: "center",
          mb: 2,
        }}
      >
       <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ mr: 2, display: { xs: "block", md: "none" } }}
          onClick={() => setIsOpen(true)}  
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

export default Sidebar;
