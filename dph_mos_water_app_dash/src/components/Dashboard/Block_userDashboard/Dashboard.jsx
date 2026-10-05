import React, { useState } from "react";
import DashboardLayout from "./DashboardLayout";
import TamilNaduMap from "./TamilNadu";
import BlockUserContributionTable from "./UserContributionTable";
import BlockHiSupervisionMap from "./HiSupervisionMap";
// const dataBoxes = [
//   { title: "Overall Report", number: 200 },
//   { title: "DHP Report", number: 300 },
//   { title: "Monthly Report", number: 20 },
//   { title: "Feedback", number: 48 },
// ];

const MosBlock_Dashboard = () => {
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

      <BlockHiSupervisionMap />
      
      {/* <BlockUserContributionTable/> */}
    </DashboardLayout>
  );
};

export default MosBlock_Dashboard;
