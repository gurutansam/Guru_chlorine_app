import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  useMediaQuery,
  Box,
  useTheme,
} from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import "../../Styles/main.css";

const HudBlockHeader = ({ toggleSidebar }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const open = Boolean(anchorEl);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleEditUser = () => {
    navigate("");
    handleClose();
  };

  return (
    <nav
      className="navbar navbar-light bg-light px-3 shadow-sm header-nav"
      style={{ position: "sticky", top: 0, zIndex: 1100 }}
    >
      <div
        className="d-flex align-items-center justify-content-between w-100 px-3"
        style={{
          height: isMobile ? "110px" : "155px",
        }}
      >
        {/* Sidebar toggle (mobile) */}
        <div className="d-flex align-items-center gap-2">
          <IconButton
            onClick={toggleSidebar}
            className="d-md-none"
            aria-label="Toggle sidebar"
            sx={{ mr: 1 }}
          >
            <MenuIcon />
          </IconButton>
        </div>

        {/* Left logo */}
        <img
          src="/dph_logo.png"
          alt="Logo 1"
          className="header-logo main-logo"
          style={{
            height: isMobile ? 36 : 90,
            width: "auto",
            transition: "height 0.2s",
          }}
        />

        {/* Center title */}
        <div className="flex-grow-1 text-center header-color header-title-wrap">
          <img
            src="/TN_logo.png"
            alt="TN_logo"
            className="header-logo main-logo"
            style={{
              height: isMobile ? 30 : 90,
              width: "auto",
              marginTop: isMobile ? 4 : 8,
              transition: "all 0.2s",
            }}
          />
          <h3 className="gov-title">
            Directorate of Public Health and Preventive Medicine
          </h3>
          <h4 className="mb-0 dph-title">
          {user?.block_name ? `${user.block_name} ` : ''} Block Dashboard
        </h4>
        </div>

        {/* HUD Info Box + Logo + Avatar */}
        <div className="d-flex align-items-center gap-3">
          {user && (
            <Box
              sx={{
                backgroundColor: "#e3f2fd",
                border: "1px solid #90caf9",
                borderRadius: "6px",
                px: 1.5,
                py: 0.5,
                fontSize: "14px",
                color: "#1976d2",
                whiteSpace: "nowrap",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.3,
              }}
            >
              <span>HUD:{user.hud_name}</span>
            BLOCK: {user.block_name && <span style={{ fontWeight: "bold" }}>{user.block_name}</span>}
            </Box>
          )}
          <img
            src="/nhm.png"
            alt="Logo 1"
            className="header-logo main-logo"
          style={{
                 height: isMobile ? 100 : 100,
                 width: "auto",
                 transition: "height 10.0s",
               }}
          />
          
        </div>
      </div>
    </nav>
  );
};

export default HudBlockHeader;