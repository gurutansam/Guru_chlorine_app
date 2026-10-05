import React, { useEffect, useState } from "react";
import {
  Table,
  Spinner,
  Form,
  Row,
  Col,
  Button as BootstrapButton,
  Pagination,
} from "react-bootstrap";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";

const UserContributionTable = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [districtFilter, setDistrictFilter] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(12); // ✅ default 12 rows per page

  const totalTarget = 50;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:3000/dashboard/datacollection");
        const json = await res.json();

        const districtRes = await fetch("http://localhost:3000/dashboard/mos-district");
        const districts = await districtRes.json();

        const counts = {};

        json.forEach((item) => {
          const username = item.username;
          const userId = item.user_id;
          const districtCode = userId?.substring(0, 7).toUpperCase();
          const districtMatch = districts.find((d) =>
            d.district_code?.toUpperCase().startsWith(districtCode)
          );
          const district = districtMatch?.district_name || "Unknown";

          if (!counts[username]) {
            counts[username] = {
              username,
              count: 1,
              district,
            };
          } else {
            counts[username].count += 1;
          }
        });

        const values = Object.values(counts);
        setData(values);
        setFilteredData(values);
      } catch (err) {
        console.error("Error fetching user contribution data", err);
      }
    };

    fetchData();
  }, []);

  // Filters
  useEffect(() => {
    let filtered = [...data];
    if (districtFilter) {
      filtered = filtered.filter((item) => item.district === districtFilter);
    }
    if (usernameFilter) {
      filtered = filtered.filter((item) => item.username === usernameFilter);
    }
    setFilteredData(filtered);
    setPage(1); // reset to first page when filters change
  }, [districtFilter, usernameFilter, data]);

  useEffect(() => {
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(dateStr);
      }
      if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split("-");
        return new Date(`${year}-${month}-${day}`);
      }
      return new Date(dateStr); // fallback
    };

    let filtered = [...data];

    if (districtFilter) {
      filtered = filtered.filter((item) => item.district === districtFilter);
    }

    if (usernameFilter) {
      filtered = filtered.filter((item) => item.username === usernameFilter);
    }

    if (fromDate || toDate) {
      const from = parseDate(fromDate);
      const to = parseDate(toDate);

      filtered = filtered
        .map((item) => {
          const filteredEntries =
            item.entries?.filter((entry) => {
              const entryDate = new Date(entry);
              return (!from || entryDate >= from) && (!to || entryDate <= to);
            }) || [];

          return {
            ...item,
            entries: filteredEntries,
            count: filteredEntries.length,
          };
        })
        .filter((item) => item.count > 0);
    }

    setFilteredData(filtered);
    setPage(1);
  }, [data, districtFilter, usernameFilter, fromDate, toDate]);

  const downloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("User Contributions");

    worksheet.columns = [
      { header: "S.No", key: "sno", width: 10 },
      { header: "Username", key: "username", width: 25 },
      { header: "District", key: "district", width: 25 },
      { header: "Entries", key: "count", width: 15 },
      { header: "Total Target", key: "totalTarget", width: 15 },
    ];

    filteredData.forEach((item, index) => {
      worksheet.addRow({
        sno: index + 1,
        username: item.username,
        district: item.district,
        count: item.count,
        totalTarget: totalTarget,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, "UserContributionReport.xlsx");
  };

  if (!data.length) return <Spinner animation="border" variant="primary" />;

  const districtOptions = [...new Set(data.map((d) => d.district))].sort();
  const usernameOptions = [...new Set(data.map((d) => d.username))].sort();

  // ✅ Pagination calculations
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  return (
    <div
      className="mt-4"
      style={{
        padding: "24px 32px",
        marginLeft: "100px",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}
    >
      <h5
        style={{
          fontWeight: 700,
          fontFamily: "Nunito, Poppins, sans-serif",
          marginBottom: 16,
        }}
      >
        HOUSES VISITED BY USERS
      </h5>

      {/* Filters + Download Button */}
      <Row className="align-items-end mb-3">
        <Col md={3}>
          <Form.Group controlId="districtSelect">
            <Form.Label>District</Form.Label>
            <Form.Select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
            >
              <option value="">All Districts</option>
              {districtOptions.map((district, idx) => (
                <option key={idx} value={district}>
                  {district}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={3}>
          <Form.Group controlId="usernameSelect">
            <Form.Label>User</Form.Label>
            <Form.Select
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
            >
              <option value="">All Users</option>
              {usernameOptions.map((user, idx) => (
                <option key={idx} value={user}>
                  {user}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={3}>
          <Form.Group controlId="rowsPerPageSelect">
            <Form.Label>Rows per page</Form.Label>
            <Form.Select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(1);
              }}
            >
              {[5, 10, 12, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={3} className="text-end">
          <BootstrapButton
            variant="success"
            onClick={downloadExcel}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
              fontFamily: "Nunito, sans-serif",
              padding: "6px 16px",
              whiteSpace: "nowrap",
            }}
          >
            <DownloadForOfflineIcon style={{ fontSize: "20px" }} />
            Download Excel
          </BootstrapButton>
        </Col>
      </Row>

      {/* Table */}
      <Table
        striped
        bordered
        hover
        responsive
        style={{ fontFamily: "Nunito, Poppins, sans-serif" }}
      >
        <thead>
          <tr>
            <th>S.NO</th>
            <th>Username</th>
            <th>District</th>
            <th>Entries</th>
            <th>Total Target</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((user, idx) => {
            const isTargetMet = user.count >= totalTarget;
            const entryCellStyle = {
              backgroundColor: isTargetMet ? "#d4edda" : "#f8d7da",
              fontWeight: 600,
              textAlign: "center",
            };

            return (
              <tr key={idx}>
                <td>{(page - 1) * rowsPerPage + idx + 1}</td>
                <td>{user.username}</td>
                <td>{user.district}</td>
                <td style={entryCellStyle}>{user.count}</td>
                <td>{totalTarget}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center mt-3">
          <Pagination>
            <Pagination.First
              onClick={() => setPage(1)}
              disabled={page === 1}
            />
            <Pagination.Prev
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            />
            {[...Array(totalPages)].map((_, idx) => (
              <Pagination.Item
                key={idx + 1}
                active={page === idx + 1}
                onClick={() => setPage(idx + 1)}
                style={{
                  color: "#000", // number color
                  fontWeight: 600,
                  backgroundColor: page === idx + 1 ? "#e0e0e0" : "white", // highlight active
                  borderColor: "#ccc",
                }}
              >
                {idx + 1}
              </Pagination.Item>

            ))}
            <Pagination.Next
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            />
            <Pagination.Last
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
            />
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default UserContributionTable;
