import React from "react";
import logo from "../../../assets/tansamoldlogo.png";
import "./Sidebar.css";

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <img
          src={logo}
          alt="Dev Panel Logo"
          className="sidebar-logo"
        />
        <h4 className="sidebar-title">Dev Panel</h4>
      </div>

      <ul className="sidebar-menu">
        <li>Dashboard</li>
        <li>Applications</li>
      </ul>
    </div>
  );
}
