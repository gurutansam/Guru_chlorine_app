import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconButton,
  Box,
  Typography,
  Menu,
  MenuItem,
  Avatar,
  useMediaQuery,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";


const UnifiedHeader = ({ toggleSidebar, subtitle = "", badgeLabel = "DPH & PM Campus", role = "" }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const isMobile = useMediaQuery("(max-width:767px)");

  const displaySubtitle = (() => {
    if (subtitle) return subtitle;
    if (user?.module) {
      if (user.module === "mosquito") return "Mosquito Dashboard";
      if (user.module === "chlorination" || user.module === "hud") return "Chlorine Dashboard";
    }
    if (role) {
      if (role.startsWith("mosquito-")) return "Mosquito Dashboard";
      if (role.startsWith("chlorination-")) return "Chlorine Dashboard";
    }
    return "";
  })();

  useEffect(() => {
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch (_) {}
    }
  }, []);

  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleLogout = () => {
    localStorage.removeItem("loggedInUser");
    navigate("/");
  };

  return (
    <header
      style={{
        width: "100%",
        background: "transparent",
        zIndex: 1200,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: isMobile ? 64 : 155,
          paddingLeft: 16,
          paddingRight: 24,
          gap: 12,
        }}
      >
        {/* ── Left Edge: Hamburger (Mobile) or Search (Desktop) ── */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <IconButton
            onClick={toggleSidebar}
            sx={{
              display: { xs: "flex", md: "none" },
              color: "#374151",
              p: 0.75,
            }}
            aria-label="Toggle sidebar"
          >
            <MenuIcon />
          </IconButton>
        </div>

        {/* ── Centre Group: DPH Logo + TN Text + NHM Logo ── */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: isMobile ? 2 : 4, // Space between logos and centre text
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* DPH Logo (Left of centre text) */}
          <img
            src="/dph_logo.png"
            alt="DPH Logo"
            style={{
              height: isMobile ? 36 : 80,
              width: "auto",
              objectFit: "contain",
              flexShrink: 0,
            }}
          />

          {/* Centre TN Text Stack */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.2,
              textAlign: "center",
            }}
          >
            <img
              src="/TN_logo.png"
              alt="TN Logo"
              style={{
                height: isMobile ? 32 : 66,
                width: "auto",
                objectFit: "contain",
                flexShrink: 0,
                marginTop:33,
                marginBottom: 2,
              }}
            />
            {!isMobile && (
              <>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    color: "#4b5563",
                    letterSpacing: "0.03em",
                    lineHeight: 1.1,
                  }}
                >
                  Govt. of Tamil Nadu
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: "1.05rem",
                    color: "#111827",
                    lineHeight: 1.2,
                    marginBottom: 0.2,
                  }}
                >
                  Directorate of Public Health & PM
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: "0.72rem",
                    color: "#6b7280",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    lineHeight: 1.1,
                    marginBottom: 0.5,
                  }}
                >
                  Communicable Disease (CD)
                </Typography>
              </>
            )}
          </Box>

          {/* NHM Logo (Right of centre text) */}
          <img
            src="/nhm.png"
            alt="NHM Logo"
            style={{
              height: isMobile ? 32 : 86,
              width: "auto",
              objectFit: "contain",
              display: isMobile ? "none" : "block",
              flexShrink: 0,
            }}
          />
        </Box>

        {/* ── Right Edge: Badge + Search/Notifications + Profile Group ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 16, flexShrink: 0 }}>

          {/* displaySubtitle before the Avatar */}
          {!isMobile && displaySubtitle && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.8,
                px: 1.6,
                py: 0.55,
                borderRadius: "999px",
                background: "linear-gradient(135deg, rgba(2,132,199,0.08), rgba(99,102,241,0.08))",
                border: "1px solid rgba(2,132,199,0.2)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                boxShadow: "0 2px 12px rgba(2,132,199,0.08)",
              }}
            >
              {/* Live indicator dot */}
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 6px rgba(34,197,94,0.7)",
                  animation: "subtitlePulse 2s infinite",
                  flexShrink: 0,
                  "@keyframes subtitlePulse": {
                    "0%, 100%": { opacity: 1 },
                    "50%": { opacity: 0.4 },
                  },
                }}
              />
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  background: "linear-gradient(135deg, #0284c7, #6366f1)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                }}
              >
                {displaySubtitle}
              </Typography>
            </Box>
          )}

          {/* User profile group */}
          <Box
            onClick={handleMenuOpen}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              cursor: "pointer",
              p: 0.5,
              borderRadius: "12px",
              transition: "background 0.2s",
              "&:hover": {
                background: "#f3f4f6",
              }
            }}
          >
            <Avatar
              sx={{
                width: isMobile ? 30 : 40,
                height: isMobile ? 30 : 40,
                background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                fontSize: "0.9rem",
                fontWeight: 700,
                boxShadow: "0 2px 8px rgba(99,102,241,0.25)",
              }}
            >
              {user?.username?.charAt(0)?.toUpperCase() || <PersonIcon sx={{ fontSize: 20 }} />}
            </Avatar>
            {!isMobile && (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", mr: 1 }}>
                <Typography sx={{ fontSize: "0.83rem", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                  {user?.username || "Guest User"}
                </Typography>
                <Typography sx={{ fontSize: "0.68rem", fontWeight: 500, color: "#6b7280", lineHeight: 1 }}>
                  {user?.email || (user?.role ? `${user.role}@dph.tn` : "user@dph.tn.gov.in")}
                </Typography>
              </Box>
            )}
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 180,
                background: "#ffffff",
                color: "#111827",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
              },
            }}
          >
            {user && (
              <MenuItem disabled sx={{ opacity: "1 !important", pb: 0.5 }}>
                <Box>
                  <Typography sx={{ color: "#111827", fontWeight: 600, fontSize: "0.85rem" }}>
                    {user.username || "User"}
                  </Typography>
                  <Typography sx={{ color: "#6b7280", fontSize: "0.72rem" }}>
                    {badgeLabel}
                  </Typography>
                </Box>
              </MenuItem>
            )}
            <MenuItem
              onClick={handleLogout}
              sx={{
                color: "#f87171",
                gap: 1,
                fontSize: "0.85rem",
                "&:hover": { background: "rgba(239,68,68,0.1)" },
              }}
            >
              <LogoutIcon sx={{ fontSize: 17 }} />
              Logout
            </MenuItem>
          </Menu>
        </div>
      </div>
    </header>
  );
};

export default UnifiedHeader;
