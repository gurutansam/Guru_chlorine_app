import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import "./Layout.css";

export default function DeveloperLayout() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));

  useEffect(() => {
    if (!user) {
      window.location.href = "/";
    }
  }, [user]);

  if (!user) return null;

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar />

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Header user={user} />
        <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
