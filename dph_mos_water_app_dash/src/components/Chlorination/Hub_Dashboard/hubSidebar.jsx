import React, { useState } from "react";
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
  Collapse,
  IconButton,
} from "@mui/material";
import {
  Home as HomeIcon,
  Dashboard as DashboardIcon,
  Logout as LogoutIcon,
  BarChart as BarChartIcon,
  Menu as MenuIcon,
  ExpandLess,
  ExpandMore,
} from "@mui/icons-material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BusinessIcon from "@mui/icons-material/Business";
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import SchoolIcon from "@mui/icons-material/School";
import HomeWorkIcon from '@mui/icons-material/HomeWork'; // Approved Homes
import GavelIcon from "@mui/icons-material/Gavel"; // Prisons
import EngineeringIcon from "@mui/icons-material/Engineering"; // PWD
import TempleBuddhistIcon from "@mui/icons-material/TempleBuddhist";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance"; // Temples
import TrainIcon from "@mui/icons-material/Train"; // Railway Stations
import LocationCityIcon from "@mui/icons-material/LocationCity"; // Municipalities
import StoreMallDirectoryIcon from "@mui/icons-material/StoreMallDirectory"; // Town Panchayats
import { useNavigate, useLocation } from "react-router-dom";


const HubSidebar = ({ isOpen, closeSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openMaster, setOpenMaster] = useState(
    location.pathname.startsWith("/hub-block") ||
    location.pathname.startsWith("/hub-corporation-master-table")||
    location.pathname.startsWith("/hub-hospitals-master-table") ||
    location.pathname.startsWith("/hub-educational-institutions-master-table")||
    location.pathname.startsWith("/hub-prison-master-table")||
    location.pathname.startsWith("/hub-government-institutions-master-table")||
    location.pathname.startsWith("/hub-approved-homes-master-table")||
    location.pathname.startsWith("/hub-towns-master-table")||
    location.pathname.startsWith("/hub-municipalities-master-table")||
    location.pathname.startsWith("/hub-railway-stations-master-table")||
    location.pathname.startsWith("/hub-pwd-master-table")||
    location.pathname.startsWith("/hub-temple-festival-master-table")
  );

  const handleLogout = () => {
    navigate("/");
  };

  const toggleMaster = () => {
    setOpenMaster((prev) => !prev);
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
    paddingTop: "220px",
  };
// const listItemButtonStyle = {
//   "&.Mui-selected": {
//     backgroundColor: "#1565c0",       // deep blue background
//     color: "#ffffff",                 // white text
//     "& .MuiListItemIcon-root": {
//       color: "#ffffff",               // white icon
//     },
//   },
//   "&.Mui-selected:hover": {
//     backgroundColor: "#0d47a1",       // darker blue on hover
//   },
//   "&:hover": {
//     backgroundColor: "#e3f2fd",       // light hover for non-selected
//     color: "#1976d2",
//     "& .MuiListItemIcon-root": {
//       color: "#1976d2",
//     },
//   },
// };

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

  const renderNavItems = () => (
    <List>
      <ListItem disablePadding>
        <ListItemButton
          component="a"
          href="/hub-dashboard"
          sx={listItemButtonStyle}
          selected={location.pathname === "/hub-dashboard"}
        >
          <ListItemIcon sx={{ color: "#666" }}><HomeIcon /></ListItemIcon>
          <ListItemText primary="Home" />
        </ListItemButton>
      </ListItem>

      <ListItem disablePadding>
        <ListItemButton
          component="a"
          href="/add_user"
          sx={listItemButtonStyle}
          selected={location.pathname === "/add_user"}
        >
          <ListItemIcon sx={{ color: "#666" }}><PersonOutlineIcon /></ListItemIcon>
          <ListItemText primary="Add User" />
        </ListItemButton>
      </ListItem>

       <ListItem disablePadding>
        <ListItemButton
          component="a"
          href="/hud-table"
          sx={listItemButtonStyle}
          selected={location.pathname === "/hud-table"}
        >
          <ListItemIcon sx={{ color: "#666" }}><PersonOutlineIcon /></ListItemIcon>
          <ListItemText primary="HUD Data" />
        </ListItemButton>
      </ListItem>


     <ListItem disablePadding>
        <ListItemButton
          component="a"
          href="/hud-block-master-table"
          sx={listItemButtonStyle}
          selected={location.pathname === "/hud-block-master-table"}
        >
          <ListItemIcon sx={{ color: "#666" }}><PersonOutlineIcon /></ListItemIcon>
          <ListItemText primary="HUD Block Data" />
        </ListItemButton>
      </ListItem>

      <ListItem disablePadding>
        <ListItemButton
          component="a"
          href="/hud-user"
          sx={listItemButtonStyle}
          selected={location.pathname === "/hud-user"}
        >
          <ListItemIcon sx={{ color: "#666" }}><PersonOutlineIcon /></ListItemIcon>
          <ListItemText primary="Add HUD User" />
        </ListItemButton>
      </ListItem>
      
       
       <ListItem disablePadding>
        <ListItemButton
          component="a"
          href="/hud-village"
          sx={listItemButtonStyle}
          selected={location.pathname === "/hud-village"}
        >
          <ListItemIcon sx={{ color: "#666" }}><PersonOutlineIcon /></ListItemIcon>
          <ListItemText primary="Village Data Overview" />
        </ListItemButton>
      </ListItem>

       <ListItem disablePadding>
        <ListItemButton
          component="a"
          href="/inspection-plan"
          sx={listItemButtonStyle}
          selected={location.pathname === "/inspection-plan"}
        >
          <ListItemIcon sx={{ color: "#666" }}><PersonOutlineIcon /></ListItemIcon>
          <ListItemText primary="Upcoming Inspection Plan" />
        </ListItemButton>
      </ListItem>

      <ListItem disablePadding>
        <ListItemButton
          component="a"
          href="/inspection-summary"
          sx={listItemButtonStyle}
          selected={location.pathname === "/inspection-summary"}
        >
          <ListItemIcon sx={{ color: "#666" }}><PersonOutlineIcon /></ListItemIcon>
          <ListItemText primary="Upcoming visit Summary" />
        </ListItemButton>
      </ListItem>

      {/* Master Data Dropdown */}
      <ListItem disablePadding>
        <ListItemButton onClick={toggleMaster} sx={listItemButtonStyle}>
          <ListItemIcon sx={{ color: "#666" }}><DashboardIcon /></ListItemIcon>
          <ListItemText primary="Master Data" />
          {openMaster ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
      </ListItem>

      <Collapse in={openMaster} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          <ListItemButton
            component="a"
            href="/hub-block"
            sx={{ ...listItemButtonStyle, pl: 4 }}
            selected={location.pathname === "/hub-block"}
          >
            <ListItemIcon sx={{ color: "#666" }}><AccountTreeIcon /></ListItemIcon>
            <ListItemText primary=" RWAL Master Data" />
          </ListItemButton>
          <ListItemButton
            component="a"
            href="/hub-corporation-master-table"
            sx={{ ...listItemButtonStyle, pl: 4 }}
            selected={location.pathname === "/hub-corporation-master-table"}
          >
            <ListItemIcon sx={{ color: "#666" }}><BusinessIcon /></ListItemIcon>
            <ListItemText primary="Corporation Data" />
          </ListItemButton>
          <ListItemButton
            component="a"
            href="/hub-hospitals-master-table"
            sx={{ ...listItemButtonStyle, pl: 4 }}
            selected={location.pathname === "/hub-hospitals-master-table"}
          >
            <ListItemIcon sx={{ color: "#666" }}><LocalHospitalIcon /></ListItemIcon>
            <ListItemText primary="Hospitals Data" />
          </ListItemButton>
          <ListItemButton
            component="a"
            href="/hub-educational-institutions-master-table"
            sx={{ ...listItemButtonStyle, pl: 4 }}
            selected={location.pathname === "/hub-educational-institutions-master-table"}
          >
            <ListItemIcon sx={{ color: "#666" }}><SchoolIcon /></ListItemIcon>
            <ListItemText primary="Educational Institution Data" />
          </ListItemButton>
          <ListItemButton
            component="a"
            href="/hub-government-institutions-master-table"
            sx={{ ...listItemButtonStyle, pl: 4 }}
            selected={location.pathname === "/hub-government-institutions-master-table"}
          >
            <ListItemIcon sx={{ color: "#666" }}><AccountBalanceIcon/></ListItemIcon>
            <ListItemText primary="Government Institution Data" />
          </ListItemButton>
          <ListItemButton
            component="a"
            href="/hub-prison-master-table"
            sx={{ ...listItemButtonStyle, pl: 4 }}
            selected={location.pathname === "/hub-prison-master-table"}
          >
            <ListItemIcon sx={{ color: "#666" }}><GavelIcon /></ListItemIcon>
            <ListItemText primary="Prison  Data" />
          </ListItemButton>
          <ListItemButton
            component="a"
            href="/hub-approved-homes-master-table"
            sx={{ ...listItemButtonStyle, pl: 4 }}
            selected={location.pathname === "/hub-approved-homes-master-table"}
          >
            <ListItemIcon sx={{ color: "#666" }}>< HomeWorkIcon/></ListItemIcon>
            <ListItemText primary="Government Homes  Data" /> 
          </ListItemButton>
          <ListItemButton
            component="a"
            href="/hub-towns-master-table"
            sx={{ ...listItemButtonStyle, pl: 4 }}
            selected={location.pathname === "/hub-towns-master-table"}
          >
            <ListItemIcon sx={{ color: "#666" }}><StoreMallDirectoryIcon /></ListItemIcon>
            <ListItemText primary="Town Panchayats Data" />
          </ListItemButton>
          <ListItemButton
            component="a"
            href="/hub-municipalities-master-table"
            sx={{ ...listItemButtonStyle, pl: 4 }}
            selected={location.pathname === "/hub-municipalities-master-table"}
          >
            <ListItemIcon sx={{ color: "#666" }}><LocationCityIcon/></ListItemIcon>
            <ListItemText primary="Municipalities Data" /> 
          </ListItemButton>
           <ListItemButton
            component="a"
            href="/hub-railway-stations-master-table"
            sx={{ ...listItemButtonStyle, pl: 4 }}
            selected={location.pathname === "/hub-railway-stations-master-table"}
          >
            <ListItemIcon sx={{ color: "#666" }}><TrainIcon /></ListItemIcon>
            <ListItemText primary="RailwayStation  Data" />
          </ListItemButton>
          <ListItemButton
            component="a"
            href="/hub-pwd-master-table"
            sx={{ ...listItemButtonStyle, pl: 4 }}
            selected={location.pathname === "/hub-pwd-master-table"}
          >
            <ListItemIcon sx={{ color: "#666" }}><EngineeringIcon /></ListItemIcon>
            <ListItemText primary="PWD(Poondi)  Data" /> 
          </ListItemButton>
          <ListItemButton
            component="a"
            href="/hub-temple-festival-master-table"
            sx={{ ...listItemButtonStyle, pl: 4 }}
            selected={location.pathname === "/hub-temple-festival-master-table"}
          >
            <ListItemIcon sx={{ color: "#666" }}><TempleBuddhistIcon/></ListItemIcon>
            <ListItemText primary="Temple(Festival Camp) Data" />
          </ListItemButton>
        </List>
      </Collapse>

      <ListItem disablePadding>
        <ListItemButton
          component="a"
          href="/hub-data"
          sx={listItemButtonStyle}
          selected={location.pathname === "/hub-data"}
        >
          <ListItemIcon sx={{ color: "#666" }}><BarChartIcon /></ListItemIcon>
          <ListItemText primary="RWAL Chlorination Monitoring" />
        </ListItemButton>
      </ListItem>

      <ListItem disablePadding>
        <ListItemButton
          component="a"
          href="/hud-chl-monitoring"
          sx={listItemButtonStyle}
          selected={location.pathname === "/hud-chl-monitoring"}
        >
          <ListItemIcon sx={{ color: "#666" }}><PersonOutlineIcon /></ListItemIcon>
          <ListItemText primary="HUD Chlorination Monitoring" />
        </ListItemButton>
      </ListItem>
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
        <Box sx={{ flexGrow: 1 }}>{renderNavItems()}</Box>
        <Divider />
        <Box>
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout} sx={logoutButtonStyle}>
              <ListItemIcon><LogoutIcon /></ListItemIcon>
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
        <Box sx={{ flexGrow: 1 }}>{renderNavItems()}</Box>
        <Divider />
        <Box>
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout} sx={logoutButtonStyle}>
              <ListItemIcon><LogoutIcon /></ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </ListItem>
        </Box>
      </Drawer>

      {/* Header for small screens */}
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

export default HubSidebar;
