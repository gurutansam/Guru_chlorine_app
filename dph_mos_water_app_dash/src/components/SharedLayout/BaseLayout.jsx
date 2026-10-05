import React, { useState, useRef, useEffect } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import UnifiedSidebar from "./UnifiedSidebar";
import UnifiedHeader from "./UnifiedHeader";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const SIDEBAR_WIDTH = 290;
const SIDEBAR_COLLAPSED_WIDTH = 64;

/**
 * BaseLayout
 *
 * Props:
 *   role     – drives sidebar nav items (e.g. "mosquito-admin")
 *   children – page content
 */
const BaseLayout = ({ role = "mosquito-admin", children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(68);
  const headerRef = useRef(null);
  const isMobile = useMediaQuery("(max-width:767px)");

  // Measure actual header height so main content starts right below it
  useEffect(() => {
    const measure = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (headerRef.current) observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);
  const toggleCollapse = () => setSidebarCollapsed((prev) => !prev);

  const effectiveWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f7", display: "flex", position: "relative" }}>

      {/* ── Dynamic Background for DPH & PM Campus (Chlorination Admin) ── */}
      {!isMobile && role === "chlorination-admin" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
          {/* Aurora glow blobs */}
          <div style={{
            position: "absolute",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0) 70%)",
            top: "-200px",
            right: "-100px",
            filter: "blur(80px)",
          }} />
          <div style={{
            position: "absolute",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, rgba(99,102,241,0) 70%)",
            bottom: "-150px",
            left: "20%",
            filter: "blur(60px)",
          }} />
          {/* Faint TN watermark logo */}
          <img
            src="/TN_logo.png"
            alt="Watermark"
            style={{
              position: "absolute",
              bottom: "40px",
              right: "40px",
              width: "320px",
              height: "auto",
              opacity: 0.03,
              filter: "grayscale(100%)",
            }}
          />
        </div>
      )}

      {/* ── Desktop Sidebar (Floating Left Card) ────────────── */}
      {!isMobile && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            width: effectiveWidth,
            height: "calc(100vh - 32px)",
            zIndex: 1200,
            transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
            overflow: "visible", // To allow toggle button to spill over
            background: "#ffffff",
            borderRadius: "20px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            border: "1px solid #e5e7eb",
          }}
        >
          {/* Inner wrapper with overflow: hidden to clip the sidebar content to rounded corners */}
          <div style={{ width: "100%", height: "100%", borderRadius: "20px", overflow: "hidden" }}>
            <UnifiedSidebar role={role} collapsed={sidebarCollapsed} isMobile={false} />
          </div>

          {/* Collapse toggle */}
          <div
            onClick={toggleCollapse}
            title={sidebarCollapsed ? "Expand" : "Collapse"}
            style={{
              position: "absolute",
              bottom: 70,
              right: -14,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 10,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              transition: "transform 0.2s",
            }}
          >
            {sidebarCollapsed
              ? <ChevronRightIcon sx={{ color: "#374151", fontSize: 18 }} />
              : <ChevronLeftIcon sx={{ color: "#374151", fontSize: 18 }} />}
          </div>
        </div>
      )}

      {/* ── Main Content Area (Right Side) ─────────────────── */}
      <div 
        style={{ 
          flex: 1, 
          marginLeft: !isMobile ? effectiveWidth + 32 : 0, 
          transition: "margin-left 0.3s cubic-bezier(0.4,0,0.2,1)",
          minWidth: 0,
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* ── Floating Header ────────────────────────────────── */}
        <div 
          ref={headerRef} 
          style={{ 
            position: "fixed", 
            top: isMobile ? 0 : 16, 
            left: !isMobile ? effectiveWidth + 32 : 0, 
            width: !isMobile ? `calc(100% - ${effectiveWidth + 48}px)` : "100%", 
            zIndex: 1100,
            transition: "left 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s cubic-bezier(0.4,0,0.2,1)",
            background: isMobile ? "#ffffff" : "rgba(255, 255, 255, 0.8)",
            backdropFilter: isMobile ? "none" : "blur(16px)",
            WebkitBackdropFilter: isMobile ? "none" : "blur(16px)",
            borderRadius: isMobile ? 0 : "20px",
            boxShadow: isMobile ? "0 1px 3px rgba(0,0,0,0.05)" : "0 4px 20px rgba(0,0,0,0.03)",
            border: isMobile ? "none" : "1px solid rgba(229, 231, 235, 0.8)",
            overflow: "hidden"
          }}
        >
          <UnifiedHeader toggleSidebar={toggleSidebar} role={role} />
        </div>

        {/* ── Main Content Container ─────────────────────────── */}
        <main
          style={{
            marginTop: isMobile ? headerHeight : headerHeight + 32,
            padding: isMobile ? 16 : "24px 0",
            marginRight: isMobile ? 0 : 16,
            flex: 1,
            background: "transparent",
          }}
        >
          {children}
        </main>
      </div>

      {/* ── Mobile Drawer ──────────────────────────────────── */}
      {isMobile && (
        <UnifiedSidebar role={role} isOpen={sidebarOpen} closeSidebar={closeSidebar} isMobile={true} />
      )}
    </div>
  );
};

export default BaseLayout;
