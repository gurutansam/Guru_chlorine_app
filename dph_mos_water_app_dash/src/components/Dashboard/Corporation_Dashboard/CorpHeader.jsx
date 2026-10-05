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
} from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import "../../Styles/main.css";

const CorpHeader = ({ toggleSidebar }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const open = Boolean(anchorEl);
  const isMobile = useMediaQuery("(max-width:600px)");

  useEffect(() => {
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  // const handleEditUser = () => {
  //   navigate("/edit-user");
  //   handleClose();
  // };

  return (
    <nav className="navbar navbar-light bg-light px-3 shadow-sm header-nav">
      <div
             className="d-flex align-items-center justify-content-between w-100 px-3"
             style={{
               height: isMobile ? "110px" : "160px",
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
                Domestic Breeding Checker Corporation Dashboard
               </h4>
             </div>
        {/* District Box + DPH Logo + Avatar */}
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
              }}
            >
             Corporation
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
          {/* <Tooltip title="Account settings">
            <IconButton
              onClick={handleClick}
              sx={{
                ml: 2,
                p: 0.3,
                background: "rgba(255,255,255,0.25)",
                backdropFilter: "blur(6px)",
                border: "2px solid #1976d2",
                boxShadow: "0 4px 24px 0 rgba(25, 118, 210, 0.15)",
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": {
                  background: "rgba(33,150,243,0.15)",
                  transform: "scale(1.10)",
                  boxShadow: "0 8px 32px 0 rgba(25, 118, 210, 0.25)",
                },
              }}
            >
              <Avatar
                sx={{
                  bgcolor: "transparent",
                  width: isMobile ? 26 : 32,
                  height: isMobile ? 26 : 32,
                  fontSize: isMobile ? 18 : 22,
                  color: "#1976d2",
                  transition: "all 0.2s"
                }}
              >
                <AccountCircleIcon fontSize="inherit" />
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem onClick={handleEditUser}>Profile</MenuItem>
          </Menu> */}
        </div>
      </div>
    </nav>
  );
};

export default CorpHeader;