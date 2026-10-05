import React, { useEffect, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import "./Dashboard.css";

export default function DeveloperDashboard() {
  const [ppmData, setPpmData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingRange, setDownloadingRange] = useState(null);

  useEffect(() => {
    fetch("http://localhost:3000/dashboard/ppm-summary")
      .then(res => res.json())
      .then(result => {
        if (result.success) setPpmData(result.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="loading-text">Loading dashboard...</p>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Developer Dashboard</h2>
        <p>PPM Image Distribution & Downloads</p>
      </div>

      <div className="ppm-card-grid">
        {ppmData.map((item, index) => (
          <PPMCard
            key={index}
            min={item.min}
            max={item.max}
            range={item.label}
            totalCount={item.totalCount}
            imageCount={item.imageCount}
            downloadingRange={downloadingRange}
            setDownloadingRange={setDownloadingRange}
          />
        ))}
      </div>
    </div>
  );
}

/* ================= PPM CARD ================= */

function PPMCard({
  min,
  max,
  range,
  totalCount,
  imageCount,
  downloadingRange,
  setDownloadingRange
}) {
  const isDownloading = downloadingRange === `${min}-${max}`;
  const canDownload = imageCount > 0;

  const handleDownload = async () => {
    if (!canDownload || isDownloading) return;

    try {
      setDownloadingRange(`${min}-${max}`);
      const limit = Math.min(imageCount, 1200);

      const res = await fetch(
        `http://localhost:3000/dashboard/ppm-summary?download=true&min=${min}&max=${max}&limit=${limit}`
      );

      const result = await res.json();
      if (!result.success || !result.images?.length) return;

      const zip = new JSZip();
      const folder = zip.folder(`${min}_to_${max}_PPM`);

      for (let i = 0; i < result.images.length; i++) {
        const img = await fetch(result.images[i]);
        if (img.ok) {
          folder.file(`image_${i + 1}.jpg`, await img.blob());
        }
      }

      saveAs(
        await zip.generateAsync({ type: "blob" }),
        `${min}_to_${max}_PPM.zip`
      );
    } finally {
      setDownloadingRange(null);
    }
  };

  return (
    <div className="ppm-card">
      <div className="ppm-card-header">
        <h4>{range} PPM</h4>
        <span className="ppm-badge">
          {imageCount > 0 ? "Images Ready" : "No Images"}
        </span>
      </div>

      <div className="ppm-range-status">
        <span className="ppm-range-label">PPM VALUE RANGE</span>
        <strong className="ppm-range-value">
          {min} – {max}
        </strong>
      </div>

      <div className="ppm-stats">
        <div>
          <span>Total Samples</span>
          <strong>{totalCount.toLocaleString()}</strong>
        </div>
        <div>
          <span>Images</span>
          <strong>{imageCount.toLocaleString()}</strong>
        </div>
      </div>

      <button
        className="ppm-download-btn"
        disabled={!canDownload || isDownloading}
        onClick={handleDownload}
      >
        {isDownloading ? "Downloading..." : "Download Images"}
      </button>
    </div>
  );
}
