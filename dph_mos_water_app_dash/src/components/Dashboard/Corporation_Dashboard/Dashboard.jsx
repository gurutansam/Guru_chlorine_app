import React, { useState } from "react";
import DashboardLayout from "./DashboardLayout";
import TamilNaduMap from "./TamilNadu";

// const dataBoxes = [
//   { title: "Overall Report", number: 200 },
//   { title: "DHP Report", number: 300 },
//   { title: "Monthly Report", number: 20 },
//   { title: "Feedback", number: 48 },
// ];

const Corp_Dashboard = () => {
  const today = new Date();

  const formatDate = (date) => date.toISOString().split("T")[0];

  const nextMonthDate = new Date(today);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

  // State for 'From' and 'To' dates
  const [fromDate, setFromDate] = useState("");  
  const [toDate, setToDate] = useState(formatDate(nextMonthDate));

  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false);

  const toggleDownloadDropdown = () =>
    setDownloadDropdownOpen((prev) => !prev);

  const handleDownload = (format) => {
    setDownloadDropdownOpen(false);
    alert(`Downloading as ${format.toUpperCase()} for range ${fromDate || "N/A"} to ${toDate}`);
  };

  return (
    <DashboardLayout>
      <div className="row mb-4">
        {/* {dataBoxes.map(({ title, number }, idx) => (
          <div key={idx} className="col-12 col-sm-6 col-md-3 mb-3 d-flex">
            <div
              className="card text-center w-100"
              style={{
                height: "148px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                borderRadius: "18px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                transition: "box-shadow 0.2s, transform 0.2s",
                fontFamily: "Nunito, Poppins, sans-serif",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(25, 118, 210, 0.18)";
                e.currentTarget.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                e.currentTarget.style.transform = "none";
              }}
            >
              <div className="card-body d-flex flex-column justify-content-center align-items-center p-2">
                <h5 className="card-title" style={{ fontWeight: 700, color: "steelblue", marginBottom: 8 }}>
                  {title}
                </h5>
                <p className="card-text fs-3 fw-bold" style={{ color: "#007556", margin: 0 }}>
                  {number}
                </p>
              </div>
            </div>
          </div>
        ))} */}
      </div>

     <div
  className="mb-4"
  style={{
    height: "400px",
    overflow: "hidden",
    borderRadius: "18px", 
  }}
>
       <TamilNaduMap />
     </div>

      
      <div className="d-flex align-items-center mb-4 gap-3 flex-wrap">
        {/* From Date */}
        <div>
          <label htmlFor="fromDate" className="form-label me-2" style={{ fontWeight: 600, color: "#425466", fontFamily: "Nunito, Poppins, sans-serif" }}>
            From:
          </label>
          <input
            type="date"
            id="fromDate"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="form-control"
            style={{
              maxWidth: "180px",
              borderRadius: "8px",
              border: "1px solid #b3c6e0",
              fontFamily: "Nunito, Poppins, sans-serif",
              background: "#f5f7fa",
              color: "#425466",
              fontWeight: 500,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
            }}
          />
        </div>

        {/* To Date */}
        <div>
          <label htmlFor="toDate" className="form-label me-2" style={{ fontWeight: 600, color: "#425466", fontFamily: "Nunito, Poppins, sans-serif" }}>
            To:
          </label>
          <input
            type="date"
            id="toDate"
            value={toDate}
            min={fromDate || undefined}
            max={formatDate(nextMonthDate)}
            onChange={(e) => setToDate(e.target.value)}
            className="form-control"
            style={{
              maxWidth: "180px",
              borderRadius: "8px",
              border: "1px solid #b3c6e0",
              fontFamily: "Nunito, Poppins, sans-serif",
              background: "#f5f7fa",
              color: "#425466",
              fontWeight: 500,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
            }}
          />
        </div>

        {/* Download Dropdown */}
        <div className="dropdown mt-4">
          <button
            className="btn dropdown-toggle"
            style={{
              height: "47px",
              paddingTop: "3px",
              paddingBottom: "2px",
              fontSize: "1rem",
              fontWeight: 700,
              fontFamily: "Nunito, Poppins, sans-serif",
              background: "linear-gradient(90deg, #5b8def 0%, #b3e0ff 1000%)",
              color: "#fff",
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 2px 12px 0 rgba(255,255,255,0.18)", // Very light white shadow
              transition: "background 0.2s, box-shadow 0.2s"
            }}
            onClick={toggleDownloadDropdown}
            aria-expanded={downloadDropdownOpen}
          >
            Download Report
          </button>
          {downloadDropdownOpen && (
            <ul
              className="dropdown-menu dropdown-menu-end show"
              style={{
                position: "absolute",
                borderRadius: "8px",
                boxShadow: "0 4px 16px rgba(70,130,180,0.10)",
                fontFamily: "Nunito, Poppins, sans-serif"
              }}
            >
              {["csv", "pdf", "excel", "doc"].map((format) => (
                <li key={format}>
                  <button
                    className="dropdown-item"
                    style={{
                      fontWeight: 600,
                      color: "#425466",
                      fontFamily: "Nunito, Poppins, sans-serif"
                    }}
                    onClick={() => handleDownload(format)}
                  >
                    {format.toUpperCase()}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Corp_Dashboard;
