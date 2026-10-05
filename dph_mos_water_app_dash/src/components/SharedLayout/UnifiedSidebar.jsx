import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  Collapse,
  Typography,
  Avatar,
  Drawer,
} from "@mui/material";

import HomeIcon from "@mui/icons-material/Home";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LogoutIcon from "@mui/icons-material/Logout";
import BarChartIcon from "@mui/icons-material/BarChart";
import MapIcon from "@mui/icons-material/Map";
import PeopleIcon from "@mui/icons-material/People";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import TableChartIcon from "@mui/icons-material/TableChart";
import BugReportIcon from "@mui/icons-material/BugReport";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import ScienceIcon from "@mui/icons-material/Science";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EventNoteIcon from "@mui/icons-material/EventNote";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BusinessIcon from "@mui/icons-material/Business";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import SchoolIcon from "@mui/icons-material/School";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import GavelIcon from "@mui/icons-material/Gavel";
import EngineeringIcon from "@mui/icons-material/Engineering";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import TrainIcon from "@mui/icons-material/Train";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import StoreMallDirectoryIcon from "@mui/icons-material/StoreMallDirectory";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import SupervisedUserCircleIcon from "@mui/icons-material/SupervisedUserCircle";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HolidayVillageIcon from "@mui/icons-material/HolidayVillage";
import NaturePeopleIcon from "@mui/icons-material/NaturePeople";
import TempleBuddhistIcon from "@mui/icons-material/TempleHindu";

// ─── Role-based nav config ────────────────────────────────────────────────────
const NAV_CONFIG = {
  "mosquito-admin": {
    label: "Mosquito Admin",
    accentColor: "#16a34a",
    items: [
      { text: "Home", icon: <HomeIcon />, href: "/mosquito-admin-dashboard" },
      { text: "State Data", icon: <DashboardIcon />, href: "/state" },
      { text: "Corporation Users", icon: <PeopleIcon />, href: "/corporation-user" },
      { text: "District Master Data", icon: <TableChartIcon />, href: "/mos-district-master-table" },
      { text: "Corporation Master Data", icon: <BusinessIcon />, href: "/mos-corp-master-table" },
      { text: "HI Supervision Map", icon: <MapIcon />, href: "/hi-supervision-map" },
      { text: "DBC Supervision Map", icon: <MapIcon />, href: "/tamilnadu-map" },
      { text: "HI Supervision", icon: <AssessmentIcon />, href: "/hi-supervision" },
      { text: "Admin Supervision", icon: <SupervisedUserCircleIcon />, href: "/special-hi-supervision" },
      { text: "Larval Survey", icon: <BugReportIcon />, href: "/hi-supervision-larva" },
      { text: "Admin Larval Survey", icon: <BugReportIcon />, href: "/special-larva-entry" },
      { text: "Source Reduction Report", icon: <BarChartIcon />, href: "/larva-index" },
      { text: "Data Sets", icon: <ScienceIcon />, href: "/data" },
    ],
  },
  "mosquito-district": {
    label: "District Officer",
    accentColor: "#d97706",
    items: [
      { text: "Home", icon: <HomeIcon />, href: "/mosquito-district-dashboard" },
      { text: "Block Master Table", icon: <TableChartIcon />, href: "/mosquito-district-block-master-table" },
      { text: "Add Users", icon: <PersonAddIcon />, href: "/mosquito-district-user" },
      { text: "HI Supervision", icon: <AssessmentIcon />, href: "/district-hi-supervision" },
      { text: "Block Admin Supervision", icon: <SupervisedUserCircleIcon />, href: "/district-block-supervision" },
      { text: "Data Sets", icon: <ScienceIcon />, href: "/mosquito-district-data" },
      { text: "Source Reduction Report", icon: <BarChartIcon />, href: "/dist-larva-index" },
      { text: "Larva Summary", icon: <BugReportIcon />, href: "/dist-larva-entry" },
      { text: "Admin Larval Summary", icon: <BugReportIcon />, href: "/block-larva-entry" },
    ],
  },
  "mosquito-block": {
    label: "Block Officer",
    accentColor: "#7c3aed",
    items: [
      { text: "Home", icon: <HomeIcon />, href: "/block-dashboard" },
      { text: "Add Users", icon: <PersonAddIcon />, href: "/block-users" },
      { text: "Data Sets", icon: <ScienceIcon />, href: "/block-data" },
      { text: "HI Supervision", icon: <AssessmentIcon />, href: "/block-hi-supervision" },
    ],
  },
  "mosquito-corp": {
    label: "Corporation Officer",
    accentColor: "#db2777",
    items: [
      { text: "Home", icon: <HomeIcon />, href: "/corp_dashboard" },
      { text: "Municipality Master Data", icon: <TableChartIcon />, href: "/mosquito-corp-municipality-master-table" },
      { text: "Municipality User", icon: <PeopleIcon />, href: "/mosquito-municipality-master-user" },
      { text: "Add Corp HI", icon: <PersonAddIcon />, href: "/mosquito-corp-users" },
      { text: "Data Sets", icon: <ScienceIcon />, href: "/mosquito-corp-data" },
    ],
  },
  "mosquito-mun": {
    label: "Municipality Officer",
    accentColor: "#0d9488",
    items: [
      { text: "Home", icon: <HomeIcon />, href: "/mun_dashboard" },
      { text: "Add Users", icon: <PersonAddIcon />, href: "/mosquito-mun-users" },
      { text: "Data Sets", icon: <ScienceIcon />, href: "/mosquito-mun-data" },
    ],
  },
  "chlorination-admin": {
    label: "DPH & PM Campus",
    accentColor: "#2563eb",
    items: [
      { text: "Home", icon: <HomeIcon />, href: "/chl-admin-dashboard" },
      { text: "Monitoring Map", icon: <MapIcon />, href: "/chl-tn-map" },
      { text: "Master Data", icon: <TableChartIcon />, href: "/chlorination-HUB-district-master-table" },
      { text: "Users", icon: <PeopleIcon />, href: "/chlorination-state" },
      { text: "Holidays", icon: <HolidayVillageIcon />, href: "/chlorination-holidays" },
      { text: "HUD Master Data", icon: <AccountTreeIcon />, href: "/hud-village-data" },
      { text: "Inspection Plan", icon: <CalendarMonthIcon />, href: "/inspection-data" },
      { text: "Admin Chlorination", icon: <WaterDropIcon />, href: "/special-chlorine-data" },
      { text: "RWAL Monitoring", icon: <BarChartIcon />, href: "/chlorination-data" },
      { text: "Block Admin Monitoring", icon: <BarChartIcon />, href: "/chl-block-data" },
      { text: "HUD Monitoring", icon: <AssessmentIcon />, href: "/chl-hud-data" },
    ],
  },
  "chlorination-hub": {
    label: "Hub (RWAL) Officer",
    accentColor: "#7c3aed",
    items: [
      { text: "Home", icon: <HomeIcon />, href: "/hub-dashboard" },
      { text: "Add User", icon: <PersonAddIcon />, href: "/add_user" },
      { text: "HUD Data", icon: <TableChartIcon />, href: "/hud-table" },
      { text: "HUD Block Data", icon: <AccountTreeIcon />, href: "/hud-block-master-table" },
      { text: "Add HUD User", icon: <PersonAddIcon />, href: "/hud-user" },
      { text: "Village Data Overview", icon: <NaturePeopleIcon />, href: "/hud-village" },
      { text: "Upcoming Inspection Plan", icon: <CalendarMonthIcon />, href: "/inspection-plan" },
      { text: "Upcoming Visit Summary", icon: <EventNoteIcon />, href: "/inspection-summary" },
      {
        text: "Master Data",
        icon: <DashboardIcon />,
        children: [
          { text: "RWAL Master Data", icon: <AccountTreeIcon />, href: "/hub-block" },
          { text: "Corporation Data", icon: <BusinessIcon />, href: "/hub-corporation-master-table" },
          { text: "Hospitals", icon: <LocalHospitalIcon />, href: "/hub-hospitals-master-table" },
          { text: "Educational Institutions", icon: <SchoolIcon />, href: "/hub-educational-institutions-master-table" },
          { text: "Govt. Institutions", icon: <AccountBalanceIcon />, href: "/hub-government-institutions-master-table" },
          { text: "Prisons", icon: <GavelIcon />, href: "/hub-prison-master-table" },
          { text: "Govt. Homes", icon: <HomeWorkIcon />, href: "/hub-approved-homes-master-table" },
          { text: "Town Panchayats", icon: <StoreMallDirectoryIcon />, href: "/hub-towns-master-table" },
          { text: "Municipalities", icon: <LocationCityIcon />, href: "/hub-municipalities-master-table" },
          { text: "Railway Stations", icon: <TrainIcon />, href: "/hub-railway-stations-master-table" },
          { text: "PWD (Poondi)", icon: <EngineeringIcon />, href: "/hub-pwd-master-table" },
          { text: "Temple Festival Camp", icon: <TempleBuddhistIcon />, href: "/hub-temple-festival-master-table" },
        ],
      },
      { text: "RWAL Chlorination Monitoring", icon: <WaterDropIcon />, href: "/hub-data" },
      { text: "HUD Chlorination Monitoring", icon: <AssessmentIcon />, href: "/hud-chl-monitoring" },
    ],
  },
  "chlorination-hud": {
    label: "HUD (District)",
    accentColor: "#ea580c",
    items: [
      { text: "Home", icon: <HomeIcon />, href: "/hud-admin-dashboard" },
      { text: "HUD Overall Data", icon: <TableChartIcon />, href: "/hud-master-view" },
      { text: "Add Block User", icon: <PersonAddIcon />, href: "/hud-block-user" },
      { text: "Add Health Inspector", icon: <PersonAddIcon />, href: "/hud-collector-add" },
      { text: "HUD Block Master Data", icon: <AccountTreeIcon />, href: "/hud-block-table" },
      { text: "PHC Master Table", icon: <MedicalServicesIcon />, href: "/hud-block-phc" },
      { text: "HSC Master Table", icon: <TableChartIcon />, href: "/hud-village-master-table" },
      { text: "Village Hamlet Data", icon: <NaturePeopleIcon />, href: "/hud-hamlet" },
      { text: "Administrative Monitoring", icon: <SupervisedUserCircleIcon />, href: "/hud-block-chlorine-data" },
      { text: "HUD Chlorination Monitoring", icon: <WaterDropIcon />, href: "/hud-data" },
    ],
  },
  "chlorination-block": {
    label: "Block Officer (Chl)",
    accentColor: "#0891b2",
    items: [
      { text: "Home", icon: <HomeIcon />, href: "/hud-block-dashboard" },
      { text: "Village Master Data", icon: <NaturePeopleIcon />, href: "/block-village-master-table" },
      { text: "HI Details", icon: <MedicalServicesIcon />, href: "/hud-collector-view" },
      { text: "Village Summary", icon: <AssessmentIcon />, href: "/hud-block-village" },
      { text: "Village Hamlet Data", icon: <NaturePeopleIcon />, href: "/block-hamlet" },
      { text: "HUD Chlorination Monitoring", icon: <WaterDropIcon />, href: "/hud-block-data" },
    ],
  },
};

// ─── Single nav item (supports sub-menus) ─────────────────────────────────────
const NavItem = ({ item, collapsed, location, closeSidebar, accentColor }) => {
  const navigate = useNavigate();
  const hasChildren = item.children && item.children.length > 0;
  const isChildActive = hasChildren && item.children.some((c) => location.pathname === c.href);
  const [open, setOpen] = useState(isChildActive);
  const isActive = !hasChildren && location.pathname === item.href;

  const activeBg = accentColor;
  const activeColor = "#ffffff";

  const btnSx = {
    mx: 1.5,
    my: 0.2,
    borderRadius: "10px",
    px: collapsed ? 1 : 1.5,
    py: 0.9,
    transition: "all 0.2s ease",
    color: isActive ? activeColor : "#6b7280",
    background: isActive ? activeBg : "transparent",
    position: "relative",
    "&:hover": {
      background: isActive ? activeBg : "#f3f4f6",
      color: isActive ? activeColor : "#374151",
    },
    "& .MuiListItemIcon-root": {
      color: isActive ? activeColor : "#9ca3af",
      minWidth: collapsed ? 0 : 36,
      transition: "color 0.2s",
    },
    "& .MuiListItemText-primary": {
      fontSize: "0.85rem",
      fontWeight: isActive ? 600 : 500,
    },
    "&::before": isActive ? {
      content: '""',
      position: "absolute",
      left: "-12px",
      top: "50%",
      transform: "translateY(-50%)",
      width: "5px",
      height: "26px",
      backgroundColor: activeBg,
      borderRadius: "0 4px 4px 0",
    } : {},
  };

  if (hasChildren) {
    const groupActive = open || isChildActive;
    return (
      <>
        <Tooltip title={collapsed ? item.text : ""} placement="right" arrow>
          <ListItemButton
            onClick={() => setOpen((p) => !p)}
            sx={{
              ...btnSx,
              color: groupActive ? activeColor : "#374151",
              background: groupActive ? activeBg : "transparent",
              "& .MuiListItemIcon-root": {
                color: groupActive ? activeColor : "#6b7280",
                minWidth: collapsed ? 0 : 36,
              },
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            {!collapsed && (
              <>
                <ListItemText primary={item.text} />
                {open ? (
                  <ExpandLessIcon sx={{ fontSize: 16, color: "#9ca3af" }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 16, color: "#9ca3af" }} />
                )}
              </>
            )}
          </ListItemButton>
        </Tooltip>
        <Collapse in={open && !collapsed} timeout="auto" unmountOnExit>
          <List disablePadding sx={{ pl: 1.5 }}>
            {item.children.map((child, i) => (
              <NavItem key={i} item={child} collapsed={collapsed} location={location} closeSidebar={closeSidebar} accentColor={accentColor} />
            ))}
          </List>
        </Collapse>
      </>
    );
  }

  return (
    <Tooltip title={collapsed ? item.text : ""} placement="right" arrow>
      <ListItemButton
        onClick={() => {
          navigate(item.href);
          closeSidebar();
        }}
        sx={btnSx}
      >
        <ListItemIcon>{item.icon}</ListItemIcon>
        {!collapsed && <ListItemText primary={item.text} />}
      </ListItemButton>
    </Tooltip>
  );
};

// ─── Sidebar inner content ─────────────────────────────────────────────────────
const SidebarContent = ({ role, collapsed, closeSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (_) {}
    }
  }, []);

  const config = NAV_CONFIG[role] || NAV_CONFIG["mosquito-admin"];
  const { label, accentColor, items } = config;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#ffffff",
        borderRight: "none",
      }}
    >
      {/* Role badge */}
      <Box
        sx={{
          px: collapsed ? 1 : 2,
          py: 1.5,
          borderBottom: "1px solid #f3f4f6",
          display: "flex",
          alignItems: "center",
          gap: 1.2,
          minHeight: 56,
          background: "#fafafa",
        }}
      >
        <Avatar
          sx={{
            width: 30,
            height: 30,
            background: accentColor,
            fontSize: "0.8rem",
            fontWeight: 700,
            flexShrink: 0,
            boxShadow: `0 2px 8px ${accentColor}44`,
          }}
        >
          {label.charAt(0)}
        </Avatar>
        {!collapsed && (
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1 }}>
              Dashboard
            </Typography>
            <Typography sx={{ fontSize: "0.78rem", color: "#111827", fontWeight: 700, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {role === "chlorination-hud" && user?.hud_name ? `${label} - ${user.hud_name}` : label}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Nav items */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          py: 0.75,
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": { background: "#d1d5db", borderRadius: "4px" },
        }}
      >
        <List dense disablePadding>
          {!collapsed && (
            <Typography
              sx={{
                px: 2.5,
                py: 1,
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              MENU
            </Typography>
          )}
          {items.map((item, idx) => (
            <NavItem key={idx} item={item} collapsed={collapsed} location={location} closeSidebar={closeSidebar} accentColor={accentColor} />
          ))}
        </List>
      </Box>

      {/* Logout */}
      <Box sx={{ borderTop: "1px solid #f3f4f6", py: 0.75 }}>
        {!collapsed && (
          <Typography
            sx={{
              px: 2.5,
              py: 1,
              fontSize: "0.68rem",
              fontWeight: 700,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            GENERAL
          </Typography>
        )}
        <Tooltip title={collapsed ? "Logout" : ""} placement="right" arrow>
          <ListItemButton
            onClick={() => navigate("/")}
            sx={{
              mx: 1.5,
              my: 0.2,
              borderRadius: "10px",
              px: collapsed ? 1 : 1.5,
              py: 0.9,
              color: "#ef4444",
              "&:hover": { background: "#fef2f2", color: "#b91c1c" },
              "& .MuiListItemIcon-root": { color: "#ef4444", minWidth: collapsed ? 0 : 36 },
              transition: "all 0.18s ease",
            }}
          >
            <ListItemIcon><LogoutIcon sx={{ fontSize: 20 }} /></ListItemIcon>
            {!collapsed && <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 600 }} />}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

// ─── Main export ───────────────────────────────────────────────────────────────
const UnifiedSidebar = ({ role = "mosquito-admin", isOpen, closeSidebar, collapsed = false, isMobile }) => {
  if (isMobile) {
    return (
      <Drawer
        anchor="left"
        open={isOpen}
        onClose={closeSidebar}
        PaperProps={{ sx: { width: 248, border: "none" } }}
      >
        <SidebarContent role={role} collapsed={false} closeSidebar={closeSidebar} />
      </Drawer>
    );
  }

  return <SidebarContent role={role} collapsed={collapsed} closeSidebar={closeSidebar || (() => {})} />;
};

export default UnifiedSidebar;
