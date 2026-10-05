import React from "react";
import { useTheme, useMediaQuery } from "@mui/material";
import "../Styles/Authentication/AuthHeader.css";

const Header = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <header className={`custom-header ${isMobile ? "mobile" : "desktop"}`}>
       <img
               src="/dph_logo.png"
               alt="Logo 1"
               className="header-logo main-logo"
               style={{
                 paddingLeft: isMobile ? "10px" : "20px",
                 height: isMobile ? 36 : 90,
                 width: "auto",
                 transition: "height 0.2s",
               }}
             />

    <div
  className="center-content"

>
  <img
    src="/TN_logo.png"
    alt="TN_logo"
    className="header-logo main-logo"
    style={{
      height: "90px",
    }}
  />
  <h1
    className="header-title"
    style={{ paddingLeft: isMobile ? "10px" : "20px" }}
  >
    Directorate of Public Health and Preventive Medicine
  </h1>
</div>


     <div className="logo-section">
      <img
        src="/nhm.png"
        alt="DPH Logo Right"
        className="header-logo main-logo logo_1"
       style={{
                 height: isMobile ? 100 : 100,
                 width: "auto",
                 transition: "height 10.0s",
               }}
      />
    </div>

    </header>
  );
};

export default Header;