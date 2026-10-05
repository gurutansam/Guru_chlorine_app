import React from "react";

export default function Header({ user }) {
  const handleLogout = () => {
    localStorage.removeItem("loggedInUser");
    window.location.href = "/login";
  };

  return (
    <div className="top-header">
      <h3>TANSAM DEVELOPER DASHBOARD</h3>

      <div className="header-right">
        <span>{user.username}</span>
        <button onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}
