import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import DataCollectionChart from "./DataCollectionChart";
import TamilNaduMap from "./TamilNadu";
import DownloadIcon from '@mui/icons-material/Download';
import * as XLSX from "xlsx";
import { Box } from "@mui/material";
import PpmSummaryTable from "./PpmOverviewTable";
import jsPDF from "jspdf";

// CSV Export
function exportToCSV(data, filename = "data.csv") {
  if (!data.length) return;
  const csvRows = [];
  const headers = Object.keys(data[0]);
  csvRows.push(headers.join(","));
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
    });
    csvRows.push(values.join(","));
  }
  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Excel Export
function exportToExcel(data, filename = "data.xlsx") {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}

// PDF Export
function exportToPDF(data, filename = "data.pdf") {
  const doc = new jsPDF();
  const headers = Object.keys(data[0] || {});
  let y = 10;
  doc.setFontSize(10);
  doc.text(headers.join(" | "), 10, y);
  y += 8;
  data.forEach(row => {
    const rowString = headers.map(h => row[h]).join(" | ");
    doc.text(rowString, 10, y);
    y += 8;
    if (y > 280) {
      doc.addPage();
      y = 10;
    }
  });
  doc.save(filename);
}

// DOC Export (simple text)
function exportToDoc(data, filename = "data.doc") {
  const headers = Object.keys(data[0] || {});
  let docContent = headers.join("\t") + "\n";
  data.forEach(row => {
    docContent += headers.map(h => row[h]).join("\t") + "\n";
  });
  const blob = new Blob([docContent], { type: "application/msword" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
const Hud_Block_Dashboard = () => {
  const today = new Date();
  const formatDate = (date) => date.toISOString().split("T")[0];
  const nextMonthDate = new Date(today);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(formatDate(nextMonthDate));
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false);
  const [filteredRows, setFilteredRows] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/chl_hud_datacollection");
        const result = await res.json();
        if (Array.isArray(result)) {
          const formatted = result.map((item, index) => ({
            id: index + 1,
            ...item,
          }));
          setFilteredRows(formatted);
        } else {
          console.error("Invalid data format:", result);
        }
      } catch (err) {
        console.error("Failed to fetch chlorination data:", err);
      }
    };
    fetchData();
  }, []);

  const toggleDownloadDropdown = () =>
    setDownloadDropdownOpen((prev) => !prev);

  const handleDownload = (format) => {
    setDownloadDropdownOpen(false);
    let filteredData = filteredRows;
    // Optionally filter by date here if needed
    if (!filteredData.length) {
      alert("No data to download.");
      return;
    }
    switch (format) {
      case "csv":
        exportToCSV(filteredData, "chlorination_data.csv");
        break;
      case "excel":
        exportToExcel(filteredData, "chlorination_data.xlsx");
        break;
      case "pdf":
        exportToPDF(filteredData, "chlorination_data.pdf");
        break;
      case "doc":
        exportToDoc(filteredData, "chlorination_data.doc");
        break;
      default:
        alert("Unknown format");
    }
  };
  return (
    <DashboardLayout>
      {/* Tamil Nadu Map */}
      <div
        className="mb-5"
        style={{
          marginTop: "150px",
          marginLeft: "50px", // or whatever spacing you want
          height: "400px",
          overflow: "hidden",
          borderRadius: "18px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      >
        <TamilNaduMap />
      </div>

      {/* PPM Chart */}
      <div className="mb-5">
        <DataCollectionChart rows={filteredRows} />
      </div>

      {/* Filters & Download Controls */}


      <div
        className="d-flex align-items-end mb-4 gap-3 flex-wrap"
        style={{
          marginTop: "32px", // Use a smaller, more reasonable margin
          padding: "20px 24px",
          borderRadius: "14px",
          background: "#F5F7FA",
          boxShadow: "0 2px 8px rgba(13,71,161,0.08)",
          justifyContent: "flex-start",
        }}
      >
      </div>
      <Box sx={{ mt: 6, ml: 5, mr: 5 }}>
        <PpmSummaryTable rows={filteredRows} />
      </Box>
    </DashboardLayout>
  );
};

export default Hud_Block_Dashboard;
