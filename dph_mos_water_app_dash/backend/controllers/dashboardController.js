import dbPromise from '../utils/db.js';
import fs from "fs";                 // sync + callback methods
import fsPromises from "fs/promises"; // async/await methods

import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
// import haversine from 'haversine-distance';
// import sendMail from '../utils/sendMail.js';
import sharp from "sharp";

export const getDashboardData = async (req, res) => {
  const db = await dbPromise;
  const { username } = req.body;

  const adminUser = [
    { username: 'mosadmin@example.com', password: 'Mosquito@123' }
  ];

  const user = adminUser.find(u => u.username === username);

  if (!user) {
    return res.status(403).json({ message: 'Access denied. Admin credentials required.' });
  }

  try {
    const [rows] = await db.execute('SELECT * FROM datacollection');
    return res.json(rows);
  } catch (err) {
    console.error("getDashboardData error:", err);
    return res.status(500).json({ message: 'Server error' });
  }

};
export const getDistrictData = async (req, res) => {
  try {
    const db = await dbPromise; // still await because createConnection returns a promise

    const [rows] = await db.execute(
      'SELECT * FROM district_table ORDER BY district_name ASC'
    );

    return res.json(rows); // always array
  } catch (err) {
    console.error("getDistrictData error:", err);
    return res.json([]); // prevent frontend map() crash
  }
};

export const addDistrictOfficer = async (req, res) => {
  const db = await dbPromise;
  const {
    username,
    password,
    district_code,
    phone_number,
    email,
    status = "Active",
    role = 'district_user',
    module = 'mosquito',
  } = req.body;

  console.log("Incoming addDistrictOfficer request body:", req.body);

  // Basic validation
  if (!username || !password || !district_code || !email) {
    return res.status(400).json({
      message: 'Username, password, district code, and email are required'
    });
  }

  try {
    // 1. Check if district exists
    const [districtRows] = await db.execute(
      `SELECT district_name FROM mosquito_district_master WHERE district_code = ?`,
      [district_code]
    );

    const district = districtRows[0];
    console.log("Matching district in DB:", district);

    if (!district) {
      const [availableDistricts] = await db.execute(
        `SELECT district_code, district_name FROM mosquito_district_master`
      );
      return res.status(400).json({
        message: 'Invalid district code',
        availableDistricts
      });
    }

    // 2. Count existing officers in this district
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM district_officer_table WHERE district_code = ?`,
      [district_code]
    );
    const count = countRows?.total || 0;

    // 3. Generate user_id
    const districtPrefix = district.district_name.substring(0, 4).toUpperCase();
    const user_id = `HUD${districtPrefix}USR${String(count + 1).padStart(3, '0')}`;
    console.log("Generated user_id:", user_id);


    const cleanedPhone = phone_number ? phone_number.replace(/\D/g, '') : null;
    if (cleanedPhone && cleanedPhone.length < 10) {
      return res.status(400).json({ message: 'Phone number must be at least 10 digits' });
    }

    // 5. Check if username exists
    const [existingRows] = await db.execute(
      `SELECT username FROM district_officer_table WHERE username = ?`,
      [username]
    );
    if (existingRows.length > 0) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    // 6. Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 7. Insert new officer
    await db.execute(
      `INSERT INTO district_officer_table (
        user_id, username, password, district_code, district_name,
        phone_number, status, role, module, email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        username,
        hashedPassword,
        district_code,
        district.district_name,
        cleanedPhone || null,
        status,
        req.body.role || "district_user",
        req.body.module || "mosquito",
        email
      ]
    );

    // Return success JSON response
    return res.status(201).json({
      message: 'District officer added successfully',
      user_id,
      district_name: district.district_name,
      phone_number: cleanedPhone || null,
      status,
      role: req.body.role || "district_user",
      module: req.body.module || "mosquito",
      email
    });

  } catch (err) {
    console.error("addDistrictOfficer error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getDistrictOfficers = async (req, res) => {
  const db = await dbPromise;
  try {
    const query = `
      SELECT
        d_off.user_id,
        d_off.username,
        d_off.district_code,
        d_off.status,
        m.district_name,
        d_off.password,
        d_off.phone_number,
        d_off.role,
        d_off.module,
        d_off.email
      FROM
        district_officer_table d_off
      JOIN
        mosquito_district_master m
      ON
        d_off.district_code = m.district_code
    `;

    const [rows] = await db.execute(query);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getHudChlorineDataPaginated = async (req, res) => {
  try {
    const db = await dbPromise;
    const { page, limit, hud_id, block_id, address, fromDate, toDate } = req.query;

    const pageNumber = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10;
    const offset = (pageNumber - 1) * pageSize;

    let activeFromDate = fromDate;
    let activeToDate = toDate;

    if (!activeFromDate && !activeToDate) {
      const today = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      activeFromDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      activeToDate = activeFromDate;
    }

    let filterConditions = "";
    const params = [];

    if (hud_id) {
      filterConditions += ` AND hud_id = ?`;
      params.push(hud_id);
    }
    if (block_id) {
      filterConditions += ` AND block_id = ?`;
      params.push(block_id);
    }
    if (address) {
      filterConditions += ` AND TRIM(address) = ?`;
      params.push(address.trim());
    }
    if (activeFromDate && activeToDate) {
      filterConditions += ` AND DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) BETWEEN ? AND ?`;
      params.push(activeFromDate, activeToDate);
    } else if (activeFromDate) {
      filterConditions += ` AND DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) >= ?`;
      params.push(activeFromDate);
    } else if (activeToDate) {
      filterConditions += ` AND DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) <= ?`;
      params.push(activeToDate);
    }

    const baseQuery = `
      SELECT * FROM chlorine_hud_data_collection WHERE 1=1 ${filterConditions}
      UNION ALL
      SELECT * FROM chlorine_hud_data_collection_new WHERE 1=1 ${filterConditions}
    `;

    // For ordering properly, we can parse timestamp or just rely on id if possible, but parsing is safer:
    const dataQuery = `
      SELECT *, DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) as parsed_date 
      FROM (
        ${baseQuery}
      ) AS filtered
      ORDER BY parsed_date DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countQuery = `SELECT COUNT(*) as total FROM ( ${baseQuery} ) AS c`;

    const [rows] = await db.execute(dataQuery, [...params, ...params]);
    const [countResult] = await db.execute(countQuery, [...params, ...params]);

    return res.status(200).json({
      data: rows,
      total: countResult[0].total,
      page: pageNumber,
      limit: pageSize
    });

  } catch (err) {
    console.error("getHudChlorineDataPaginated error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};


export const getHudDashboardSummary = async (req, res) => {
  try {
    const db = await dbPromise;
    const { hud_name, block_name, ppm_status, fromDate, toDate } = req.query;

    let filterConditions = "";
    const params = [];

    if (hud_name && hud_name !== 'All') {
      filterConditions += ` AND hud_name = ?`;
      params.push(hud_name);
    }

    if (block_name && block_name !== 'All') {
      filterConditions += ` AND block_name = ?`;
      params.push(block_name);
    }

    let activeFromDate = fromDate;
    let activeToDate = toDate;

    if (!activeFromDate && !activeToDate) {
      const today = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      activeFromDate = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
      activeToDate = activeFromDate;
    }

    if (activeFromDate && activeToDate) {
      filterConditions += ` AND DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y')`;
      params.push(activeFromDate, activeToDate);
    } else if (activeFromDate) {
      filterConditions += ` AND DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) >= STR_TO_DATE(?, '%d/%m/%Y')`;
      params.push(activeFromDate);
    } else if (activeToDate) {
      filterConditions += ` AND DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) <= STR_TO_DATE(?, '%d/%m/%Y')`;
      params.push(activeToDate);
    }

    let baseQuery = `
      SELECT *,
        CASE
          WHEN UPPER(samplingPoint) IN ('TAIL', 'MID') THEN
            CASE WHEN CAST(NULLIF(ppm, '') AS DECIMAL(10,1)) = 0 THEN 'Nil'
                 WHEN CAST(NULLIF(ppm, '') AS DECIMAL(10,1)) < 0.2 THEN 'Inadequate'
                 ELSE 'Adequate' END
          WHEN UPPER(samplingPoint) IN ('OHT', 'GLR', 'SUMP') THEN
            CASE WHEN CAST(NULLIF(ppm, '') AS DECIMAL(10,1)) = 0 THEN 'Nil'
                 WHEN CAST(NULLIF(ppm, '') AS DECIMAL(10,1)) < 1 THEN 'Inadequate'
                 ELSE 'Adequate' END
          ELSE
            CASE WHEN CAST(NULLIF(ppm, '') AS DECIMAL(10,1)) = 0 THEN 'Nil' ELSE 'Adequate' END
        END AS calculated_status
      FROM (
        SELECT * FROM chlorine_hud_data_collection WHERE 1=1 ${filterConditions}
        UNION ALL
        SELECT * FROM chlorine_hud_data_collection_new WHERE 1=1 ${filterConditions}
      ) AS combined_data
    `;

    let outerQuery = `SELECT * FROM (${baseQuery}) AS sub`;
    let outerParams = [...params, ...params];

    if (ppm_status && ppm_status !== 'All') {
      outerQuery += ` WHERE calculated_status = ?`;
      outerParams.push(ppm_status);
    }

    const countsQuery = `
      SELECT calculated_status, COUNT(*) as count 
      FROM (${outerQuery}) AS filtered 
      GROUP BY calculated_status
    `;
    const [countsResult] = await db.execute(countsQuery, outerParams);

    const counts = { Adequate: 0, Inadequate: 0, Nil: 0, Total: 0 };
    countsResult.forEach(row => {
      if (counts[row.calculated_status] !== undefined) {
        counts[row.calculated_status] = row.count;
        counts.Total += row.count;
      }
    });

    const rowsQuery = `${outerQuery} ORDER BY STR_TO_DATE(timestamp, '%d/%m/%Y, %h:%i:%s') DESC LIMIT 5000`;
    const [rows] = await db.execute(rowsQuery, outerParams);

    const [hudsResult] = await db.execute("SELECT DISTINCT hud_name FROM hud_master WHERE hud_name IS NOT NULL");
    const [blocksResult] = await db.execute("SELECT DISTINCT block_name, hud_name FROM hud_block_master WHERE block_name IS NOT NULL");

    return res.status(200).json({
      success: true,
      counts,
      rows,
      huds: hudsResult.map(h => h.hud_name),
      blocks: blocksResult.map(b => ({ block_name: b.block_name, hud_name: b.hud_name }))
    });
  } catch (err) {
    console.error('getHudDashboardSummary error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT /dashboard/update-district-officer/:user_id
export const updateDistrictOfficer = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;
  const { username, phone_number, password, status, email } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    let query = "UPDATE district_officer_table SET ";
    const params = [];

    if (username !== undefined) {
      query += "username = ?, ";
      params.push(username);
    }

    if (email !== undefined) {
      query += "email = ?, ";
      params.push(email);
    }

    if (phone_number !== undefined) {
      query += "phone_number = ?, ";
      params.push(phone_number);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += "password = ?, ";
      params.push(hashedPassword);
    }

    if (status !== undefined) {
      query += "status = ?, ";
      params.push(status);
    }

    // Remove trailing comma and space
    query = query.replace(/, $/, " ");
    query += "WHERE user_id = ?";
    params.push(user_id);

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Officer updated successfully" });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const deleteDistrictOfficer = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Use db.execute for parameterized queries in MySQL
    const [result] = await db.execute(
      "DELETE FROM district_officer_table WHERE user_id = ?",
      [user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Officer deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//Coporation User Management
export const addCorpUser = async (req, res) => {
  const db = await dbPromise;

  const {
    username,
    password,
    corp_name,
    email,
    phone_number,
    district_name,
    block_name,
    status = "Active",
    role = "corp_user",
    module = "mosquito",
  } = req.body;

  // Validation
  if (!username || !password || !corp_name || !email) {
    return res.status(400).json({
      message:
        "Username, password, corporation name, and email are required.",
    });
  }

  try {
    // -------------------------------
    // 1Ã¯Â¸ÂÃ¢Æ’Â£ COUNT USERS BY CORPORATION
    // -------------------------------
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM mosquito_corp_users WHERE corp_name = ?`,
      [corp_name]
    );

    const total = countRows[0]?.total || 0;

    // Generate ID: MOSCORPCOIMUSR001
    const corpPrefix = corp_name.substring(0, 4).toUpperCase();
    const user_id = `MOSCORP${corpPrefix}USR${String(total + 1).padStart(
      3,
      "0"
    )}`;

    // -------------------------------
    // 2Ã¯Â¸ÂÃ¢Æ’Â£ CLEAN PHONE NUMBER
    // -------------------------------
    const cleanedPhone = phone_number ? phone_number.replace(/\D/g, "") : null;

    if (cleanedPhone && cleanedPhone.length < 10) {
      return res
        .status(400)
        .json({ message: "Phone number must be at least 10 digits." });
    }

    // -------------------------------
    // 3Ã¯Â¸ÂÃ¢Æ’Â£ CHECK IF USERNAME EXISTS
    // -------------------------------
    const [existingRows] = await db.execute(
      `SELECT username FROM mosquito_corp_users WHERE username = ?`,
      [username]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({ message: "Username already exists" });
    }

    // -------------------------------
    // 4Ã¯Â¸ÂÃ¢Æ’Â£ HASH PASSWORD
    // -------------------------------
    const hashedPassword = await bcrypt.hash(password, 10);

    // -------------------------------
    // 5Ã¯Â¸ÂÃ¢Æ’Â£ INSERT INTO DATABASE
    // -------------------------------
    await db.execute(
      `INSERT INTO mosquito_corp_users (
        user_id, username, password, email, corp_name, district_name,
        block_name, phone_number, status, role, module
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        username,
        hashedPassword,
        email,
        corp_name,
        district_name,
        block_name,
        cleanedPhone || null,
        status,
        role,
        module,
      ]
    );

    res.status(201).json({
      message: "Corporation user added successfully",
      user_id,
      corp_name,
      phone_number: cleanedPhone || null,
      status,
      role,
      module,
    });
  } catch (err) {
    console.error("addCorpUser error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /dashboard/corp-users
export const getCorpUsers = async (req, res) => {
  const db = await dbPromise;
  try {
    const [rows] = await db.execute(`
      SELECT * FROM mosquito_corp_users
    `);

    res.json(rows);   // Ã¢Å“â€¦ send only rows, not [rows, fields]
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /dashboard/update-corp-user/:user_id
export const updateCorpUser = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;
  const { phone_number, password, status, email } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    let query = "UPDATE mosquito_corp_users SET ";
    const params = [];

    if (email !== undefined) {
      query += "email = ?, ";
      params.push(email);
    }
    if (phone_number !== undefined) {
      query += "phone_number = ?, ";
      params.push(phone_number);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += "password = ?, ";
      params.push(hashedPassword);
    }
    if (status !== undefined) {
      query += "status = ?, ";
      params.push(status);
    }

    // remove trailing comma
    query = query.replace(/, $/, " ");
    query += "WHERE user_id = ?";
    params.push(user_id);

    // Run query in MySQL
    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Corporation user updated successfully" });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /dashboard/delete-corp-user/:user_id
export const deleteCorpUser = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const [result] = await db.execute(
      "DELETE FROM mosquito_corp_users WHERE user_id = ?",
      [user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Corporation user deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


export const addDataCollection = async (req, res) => {
  try {
    const db = await dbPromise;
    console.log("Ã°Å¸â€œÂ¥ Incoming body:", req.body);

    const {
      user_id,
      username,
      district_name,
      block_name,
      areaType,
      monitoringArea,
      geolocation,
      date,
      time,
      address,
      user_geolocation,
      image_base64,
    } = req.body;

    if (!user_id || !username) {
      return res
        .status(400)
        .json({ message: "Missing user_id or username" });
    }

    // Convert DD-MM-YYYY Ã¢â€ â€™ YYYY-MM-DD
    const convertToMySQLDate = (d) => {
      if (!d) return null;
      const parts = d.split("-");
      if (parts.length !== 3) return null;
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };

    const mysqlDate = convertToMySQLDate(date);

    const geo =
      typeof geolocation === "string"
        ? JSON.parse(geolocation)
        : geolocation || {};

    const userGeo =
      typeof user_geolocation === "string"
        ? JSON.parse(user_geolocation)
        : user_geolocation || {};

    // Save image if exists
    let imagePath = null;
    if (image_base64) {
      const buffer = Buffer.from(image_base64, "base64");
      const filename = `image-${Date.now()}.jpg`;
      const dir = path.join(process.cwd(), "uploads");

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      imagePath = `/uploads/${filename}`;
      fs.writeFileSync(path.join(process.cwd(), imagePath), buffer);
    }

    const insertQuery = `
      INSERT INTO datacollection
      (
        user_id,
        username,
        district_name,
        block_name,
        areaType,
        monitoringArea,
        geolocation,
        address,
        date,
        time,
        user_geolocation,
        image_base64
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(insertQuery, [
      user_id,
      username,
      district_name,
      block_name,
      areaType,
      monitoringArea || "Unknown",
      JSON.stringify(geo),
      address,
      mysqlDate, // Ã¢Å“â€¦ MySQL date format
      time,
      JSON.stringify(userGeo),
      imagePath,
    ]);

    return res
      .status(201)
      .json({ message: "Data inserted successfully" });
  } catch (err) {
    console.error("Ã°Å¸â€™Â¥ addDataCollection error:", err);
    return res.status(500).json({
      message: err.message || "Server error",
    });
  }
};

export const addHiMonitoring = async (req, res) => {
  console.log("Ã°Å¸â€œÂ¥ Incoming HI Monitoring body:", req.body);

  try {
    const {
      hi_name,
      block_name,
      district_name,
      phc_name,         // <-- NEW
      village_name,     // <-- NEW
      num_dbcs,
      dbc_data,
      photos,
      total_visited,
      total_target,
      verified,
      timestamp,
      user_id,
    } = req.body;

    if (!hi_name) {
      return res.status(400).json({ message: "Missing hi_name" });
    }

    // Convert timestamp Ã¢â€ â€™ MySQL
    let mysqlTimestamp = new Date(timestamp)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    const dir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    // Prepare 10 images
    const photoCols = Array.from({ length: 10 }, (_, i) => {
      const item = photos?.[i] || {};

      if (item.base64) {
        const base64Data = item.base64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const filename = `photo-${Date.now()}-${i}.jpg`;
        fs.writeFileSync(path.join(dir, filename), buffer);

        return {
          uri: `/uploads/${filename}`,
          lat: item.latitude || null,
          long: item.longitude || null,
        };
      }

      return { uri: null, lat: null, long: null };
    });

    const flattenedPhotos = photoCols.flatMap(p => [p.uri, p.lat, p.long]);

    // INSERT query updated with phc_name and village_name
    const sql = `
      INSERT INTO dbc_hi_monitoring (
        user_id,
        hi_name,
        block_name,
        district_name,
        phc_name,          -- NEW
        village_name,      -- NEW
        num_dbcs,
        dbc_data,

        photo1, photo1_lat, photo1_long,
        photo2, photo2_lat, photo2_long,
        photo3, photo3_lat, photo3_long,
        photo4, photo4_lat, photo4_long,
        photo5, photo5_lat, photo5_long,
        photo6, photo6_lat, photo6_long,
        photo7, photo7_lat, photo7_long,
        photo8, photo8_lat, photo8_long,
        photo9, photo9_lat, photo9_long,
        photo10, photo10_lat, photo10_long,

        total_visited,
        total_target,
        verified,
        timestamp
      ) VALUES (${Array(42).fill("?").join(", ")})
    `;

    const values = [
      user_id || null,
      hi_name,
      block_name || "",
      district_name || "",
      phc_name || null,              // NEW
      village_name || null,          // NEW
      parseInt(num_dbcs) || 0,
      JSON.stringify(dbc_data || []),

      ...flattenedPhotos,

      parseInt(total_visited) || 0,
      parseInt(total_target) || 0,
      verified ?? null,
      mysqlTimestamp,
    ];

    const db = await dbPromise;
    const [result] = await db.execute(sql, values);

    return res.status(201).json({
      message: "HI Monitoring data saved successfully",
      insertId: result.insertId,
      photos: photoCols,
    });

  } catch (err) {
    console.error("Ã°Å¸â€™Â¥ addHiMonitoring error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

// Add this helper at the top
function safeJSONParse(value, fallback = []) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

export const getHiMonitoring = async (req, res) => {
  try {
    const db = await dbPromise;
    const sql = `
      SELECT *
      FROM dbc_hi_monitoring
      ORDER BY timestamp DESC
    `;

    const [rows] = await db.execute(sql);

    const formatted = rows.map((row) => {
      const photos = [];
      for (let i = 1; i <= 10; i++) {
        const uri = row[`photo${i}`];
        if (uri) {
          photos.push({
            uri,
            latitude: row[`photo${i}_lat`],
            longitude: row[`photo${i}_long`],
          });
        }
      }

      return {
        ...row,
        dbc_data: safeJSONParse(row.dbc_data, []),
        photos,
      };
    });

    res.status(200).json(formatted);
  } catch (err) {
    console.error("Ã°Å¸â€™Â¥ getHiMonitoring error:", err);
    res.status(500).json({ message: "Failed to fetch HI Monitoring records" });
  }
};

export const getHiMonitoringSummary = async (req, res) => {
  try {
    const db = await dbPromise;

    // =====================================================
    // 1Ã¯Â¸ÂÃ¢Æ’Â£ HI COUNTS (ALL DONE IN SQL Ã¢â‚¬â€œ FIXES TODAY ISSUE)
    // =====================================================
    const [[{
      totalCount,
      todayCount,
      thisMonthCount,
      previousMonthCount
    }]] = await db.query(`
      SELECT
        COUNT(*) AS totalCount,
        SUM(DATE(timestamp) = CURDATE()) AS todayCount,
        SUM(DATE_FORMAT(timestamp,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m')) AS thisMonthCount,
        SUM(
          DATE_FORMAT(timestamp,'%Y-%m') =
          DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH),'%Y-%m')
        ) AS previousMonthCount
      FROM dbc_hi_monitoring
    `);

    // =====================================================
    // 2Ã¯Â¸ÂÃ¢Æ’Â£ MASTER COUNTS
    // =====================================================
    const [[{ hud_count }]] = await db.query(`SELECT COUNT(*) hud_count FROM hud_master`);
    const [[{ block_count }]] = await db.query(`SELECT COUNT(*) block_count FROM hud_block_master`);
    const [[{ phc_count }]] = await db.query(`SELECT COUNT(*) phc_count FROM phc_master`);
    const [[{ hsc_count }]] = await db.query(`SELECT COUNT(*) hsc_count FROM hud_village_master`);

    // =====================================================
    // 3Ã¯Â¸ÂÃ¢Æ’Â£ ACTIVE / INACTIVE BLOCKS (TODAY)
    // =====================================================
    const [allBlocksRows] = await db.query(`
      SELECT block_name, hud_id
      FROM hud_block_master
    `);

    const [todayBlocksRows] = await db.query(`
      SELECT DISTINCT block_name
      FROM dbc_hi_monitoring
      WHERE DATE(timestamp) = CURDATE()
    `);

    const todayBlocks = todayBlocksRows.map(
      r => r.block_name?.trim().toLowerCase()
    );

    const activeBlocks = [];
    const inactiveBlocks = [];

    allBlocksRows.forEach(b => {
      if (todayBlocks.includes(b.block_name.trim().toLowerCase())) {
        activeBlocks.push(b.block_name);
      } else {
        inactiveBlocks.push(b.block_name);
      }
    });

    // =====================================================
    // 4Ã¯Â¸ÂÃ¢Æ’Â£ ACTIVE / INACTIVE HUDs (FROM ACTIVE BLOCKS)
    // =====================================================
    const [hudMapRows] = await db.query(`
      SELECT h.hud_name, b.block_name
      FROM hud_master h
      JOIN hud_block_master b ON h.hud_id = b.hud_id
    `);

    const activeHudSet = new Set();

    hudMapRows.forEach(r => {
      if (todayBlocks.includes(r.block_name.trim().toLowerCase())) {
        activeHudSet.add(r.hud_name);
      }
    });

    const [allHudsRows] = await db.query(`SELECT hud_name FROM hud_master`);
    const allHuds = allHudsRows.map(r => r.hud_name);

    const activeHuds = [...activeHudSet];
    const inactiveHuds = allHuds.filter(h => !activeHudSet.has(h));

    // =====================================================
    // 5Ã¯Â¸ÂÃ¢Æ’Â£ ACTIVE / INACTIVE PHCs
    // =====================================================
    const [allPhcsRows] = await db.query(`SELECT phc_name FROM phc_master`);
    const allPhcs = allPhcsRows.map(r => r.phc_name);

    const [todayPhcRows] = await db.query(`
      SELECT DISTINCT phc_name
      FROM dbc_hi_monitoring
      WHERE DATE(timestamp) = CURDATE()
    `);

    const todayPhcs = todayPhcRows.map(r => r.phc_name?.toLowerCase());

    const activePhcs = allPhcs.filter(p =>
      todayPhcs.includes(p.toLowerCase())
    );

    const inactivePhcs = allPhcs.filter(p =>
      !todayPhcs.includes(p.toLowerCase())
    );

    // =====================================================
    // Ã¢Å“â€¦ RESPONSE
    // =====================================================
    res.json({
      totalCount,
      todayCount,
      thisMonthCount,
      previousMonthCount,

      hud_count,
      block_count,
      phc_count,
      hsc_count,

      active_blocks: activeBlocks,
      inactive_blocks: inactiveBlocks,
      active_block_count: activeBlocks.length,
      inactive_block_count: inactiveBlocks.length,

      active_huds: activeHuds,
      inactive_huds: inactiveHuds,
      active_hud_count: activeHuds.length,
      inactive_hud_count: inactiveHuds.length,

      active_phcs: activePhcs,
      inactive_phcs: inactivePhcs,
      active_phc_count: activePhcs.length,
      inactive_phc_count: inactivePhcs.length,
    });

  } catch (error) {
    console.error("Summary fetch failed:", error);
    res.status(500).json({
      message: "HI Monitoring summary failed",
      error: error.message
    });
  }
};


export const addSpecialHiMonitoring = async (req, res) => {
  console.log("ðŸ“¥ Incoming SPECIAL HI Monitoring body:", req.body);

  try {
    const {
      hi_name,
      block_name,
      district_name,
      phc_name,
      village_name,
      num_dbcs,
      dbc_data,
      photos,
      total_visited,
      total_target,
      verified,
      timestamp,
      user_id,
      role               // âœ… EXTRA FIELD (can be null)
    } = req.body;

    if (!hi_name) {
      return res.status(400).json({ message: "Missing hi_name" });
    }

    // =====================================================
    // ðŸ”’ SAFE TIMESTAMP HANDLER (LEGACY + ISO)
    // =====================================================
    const parseLegacyOrISO = (ts) => {
      if (!ts) return null;

      // ISO format â†’ convert normally
      if (ts.includes("T")) {
        return new Date(ts)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
      }

      // Legacy format â†’ DD/MM/YYYY,HH:mm:ss
      if (ts.includes("/") && ts.includes(",")) {
        const [datePart, timePart] = ts.split(",");
        const [dd, mm, yyyy] = datePart.split("/");
        return `${yyyy}-${mm}-${dd} ${timePart}`;
      }

      // Fallback
      const d = new Date(ts);
      if (isNaN(d.getTime())) return null;

      return d.toISOString().slice(0, 19).replace("T", " ");
    };

    const mysqlTimestamp = parseLegacyOrISO(timestamp);
    if (!mysqlTimestamp) {
      return res.status(400).json({ message: "Invalid timestamp format" });
    }

    // =====================================================
    // IMAGE STORAGE (UNCHANGED)
    // =====================================================
    const dir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const photoCols = Array.from({ length: 10 }, (_, i) => {
      const item = photos?.[i] || {};

      if (item.base64) {
        const base64Data = item.base64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const filename = `photo-${Date.now()}-${i}.jpg`;
        fs.writeFileSync(path.join(dir, filename), buffer);

        return {
          uri: `/uploads/${filename}`,
          lat: item.latitude || null,
          long: item.longitude || null,
        };
      }

      return { uri: null, lat: null, long: null };
    });

    const flattenedPhotos = photoCols.flatMap(p => [p.uri, p.lat, p.long]);

    // =====================================================
    // INSERT (ONLY ROLE COLUMN IS EXTRA)
    // =====================================================
    const sql = `
      INSERT INTO dbc_hi_monitoring_special (
        user_id,
        role,
        hi_name,
        block_name,
        district_name,
        phc_name,
        village_name,
        num_dbcs,
        dbc_data,

        photo1, photo1_lat, photo1_long,
        photo2, photo2_lat, photo2_long,
        photo3, photo3_lat, photo3_long,
        photo4, photo4_lat, photo4_long,
        photo5, photo5_lat, photo5_long,
        photo6, photo6_lat, photo6_long,
        photo7, photo7_lat, photo7_long,
        photo8, photo8_lat, photo8_long,
        photo9, photo9_lat, photo9_long,
        photo10, photo10_lat, photo10_long,

        total_visited,
        total_target,
        verified,
        timestamp
      ) VALUES (${Array(43).fill("?").join(", ")})
    `;

    const values = [
      user_id || null,
      role || null,                     // âœ… nullable
      hi_name,
      block_name || "",
      district_name || "",
      phc_name || null,
      village_name || null,
      parseInt(num_dbcs) || 0,
      JSON.stringify(dbc_data || []),

      ...flattenedPhotos,

      parseInt(total_visited) || 0,
      parseInt(total_target) || 0,
      verified ?? null,
      mysqlTimestamp,
    ];

    const db = await dbPromise;
    const [result] = await db.execute(sql, values);

    return res.status(201).json({
      message: "SPECIAL HI Monitoring data saved successfully",
      insertId: result.insertId,
      photos: photoCols,
    });

  } catch (err) {
    console.error("ðŸ’¥ addSpecialHiMonitoring error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};



export const getSpecialHiMonitoring = async (req, res) => {
  try {
    const db = await dbPromise;

    const sql = `
      SELECT *
      FROM dbc_hi_monitoring_special
      ORDER BY timestamp DESC
    `;

    const [rows] = await db.execute(sql);

    const formatted = rows.map((row) => {
      const photos = [];

      for (let i = 1; i <= 10; i++) {
        const uri = row[`photo${i}`];
        if (uri) {
          photos.push({
            uri,
            latitude: row[`photo${i}_lat`],
            longitude: row[`photo${i}_long`],
          });
        }
      }

      return {
        ...row,
        dbc_data: safeJSONParse(row.dbc_data, []),
        photos,
      };
    });

    return res.status(200).json(formatted);

  } catch (err) {
    console.error("ðŸ’¥ getSpecialHiMonitoring error:", err);
    return res
      .status(500)
      .json({ message: "Failed to fetch SPECIAL HI Monitoring records" });
  }
};


export const saveLarvaEntry = async (req, res) => {
  console.log("Full Body Received:", req.body);

  try {
    const {
      user_id,
      hi_name,
      mobile_no,
      block_name,
      district_name,
      phc_name,
      village_name,
      work_type,
      latitude,
      longitude,
      sources,
      active_larval_source_count,
      overallSourceCount,
      image_base64
    } = req.body;

    if (!user_id) return res.status(400).json({ message: "user_id required" });
    if (!work_type) return res.status(400).json({ message: "work_type required" });

    let storedImagePath = null;

    // --- PROCESS IMAGE BASE64 ---
    if (image_base64?.startsWith("data:image") || (image_base64 && image_base64.length > 100)) {
      const cleanedBase64 = image_base64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(cleanedBase64, "base64");

      const uploadsDir = path.join(process.cwd(), "uploads", "larva");

      // Ã¢Å“â€¦ Use fsPromises.mkdir with recursive
      await fsPromises.mkdir(uploadsDir, { recursive: true });

      const filename = `larva_${user_id}_${Date.now()}.jpg`;
      const fullPath = path.join(uploadsDir, filename);

      // Ã¢Å“â€¦ Write the file using fsPromises
      await fsPromises.writeFile(fullPath, buffer);
      storedImagePath = `/uploads/larva/${filename}`;

      scheduleImageDelete(fullPath);

    }

    // --- INSERT INTO DB ---
    const db = await dbPromise;
    const sql = `
      INSERT INTO larva_entries (
        user_id, hi_name, mobile_no, block_name, district_name,
        phc_name, village_name, work_type,
        image_path, latitude, longitude, submitted_at,
        sources, active_larval_source_count, overallSourceCount
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)
    `;

    const params = [
      user_id, hi_name, mobile_no, block_name, district_name,
      phc_name, village_name, work_type,
      storedImagePath, latitude, longitude,
      JSON.stringify(sources), active_larval_source_count, overallSourceCount
    ];

    const [result] = await db.execute(sql, params);

    return res.status(200).json({
      success: true,
      message: "Larva entry saved successfully",
      id: result.insertId,
      stored_image: storedImagePath
    });

  } catch (error) {
    console.error("saveLarvaEntry error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const addSpecialLarvaEntry = async (req, res) => {
  console.log("Full Body Received (SPECIAL):", req.body);

  try {
    const {
      user_id,
      role,                    // OPTIONAL
      hi_name,
      mobile_no,
      block_name,
      district_name,
      phc_name,
      village_name,
      work_type,
      latitude,
      longitude,
      sources,
      active_larval_source_count,
      overallSourceCount,
      image_base64,
      hud_id,
      hud_name
    } = req.body;

    // REQUIRED CHECKS (UNCHANGED except role)
    if (!user_id) {
      return res.status(400).json({ message: "user_id required" });
    }
    if (!work_type) {
      return res.status(400).json({ message: "work_type required" });
    }

    let storedImagePath = null;

    // --- PROCESS IMAGE BASE64 (UNCHANGED) ---
    if (
      image_base64?.startsWith("data:image") ||
      (image_base64 && image_base64.length > 100)
    ) {
      const cleanedBase64 = image_base64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(cleanedBase64, "base64");

      const uploadsDir = path.join(process.cwd(), "uploads", "larva");
      await fsPromises.mkdir(uploadsDir, { recursive: true });

      const filename = `larva_${user_id}_${Date.now()}.jpg`;
      const fullPath = path.join(uploadsDir, filename);

      await fsPromises.writeFile(fullPath, buffer);
      storedImagePath = `/uploads/larva/${filename}`;

      scheduleImageDelete(fullPath);
    }

    // --- INSERT INTO SPECIAL TABLE ---
    const db = await dbPromise;

    const sql = `
      INSERT INTO larva_special_data_collection (
        user_id,
        role,
        hi_name,
        mobile_no,
        block_name,
        district_name,
        phc_name,
        village_name,
        hud_id,
        hud_name,
        work_type,
        image_path,
        latitude,
        longitude,
        submitted_at,
        sources,
        active_larval_source_count,
        overallSourceCount
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)
    `;

    const params = [
      user_id,
      role || null,                 // âœ… NULL SAFE
      hi_name,
      mobile_no,
      block_name,
      district_name,
      phc_name,
      village_name,
      hud_id || null,
      hud_name || null,
      work_type,
      storedImagePath,
      latitude,
      longitude,
      JSON.stringify(sources),
      active_larval_source_count,
      overallSourceCount
    ];

    const [result] = await db.execute(sql, params);

    return res.status(200).json({
      success: true,
      message: "SPECIAL larva entry saved successfully",
      id: result.insertId,
      stored_image: storedImagePath
    });

  } catch (error) {
    console.error("saveSpecialLarvaEntry error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};




export const getLarvaEntries = async (req, res) => {
  try {
    const { user_id, block, district, phc, work_type, start_date, end_date } = req.query;

    let conditions = [];
    let params = [];

    if (user_id) {
      conditions.push("user_id = ?");
      params.push(user_id);
    }
    if (block) {
      conditions.push("block_name = ?");
      params.push(block);
    }
    if (district) {
      conditions.push("district_name = ?");
      params.push(district);
    }
    if (phc) {
      conditions.push("phc_name = ?");
      params.push(phc);
    }
    if (work_type) {
      conditions.push("work_type = ?");
      params.push(work_type);
    }

    if (start_date && end_date) {
      conditions.push("DATE(submitted_at) BETWEEN ? AND ?");
      params.push(start_date, end_date);
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const sql = `
      SELECT *
      FROM larva_entries
      ${whereClause}
      ORDER BY submitted_at DESC
    `;
    const db = await dbPromise;
    const [rows] = await db.execute(sql, params);

    return res.status(200).json(rows);
  } catch (error) {
    console.error("SERVER ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


export const getSpecialLarvaEntries = async (req, res) => {
  try {
    const {
      user_id,
      block,
      district,
      phc,
      work_type,
      start_date,
      end_date
    } = req.query;

    let conditions = [];
    let params = [];

    if (user_id) {
      conditions.push("user_id = ?");
      params.push(user_id);
    }
    if (block) {
      conditions.push("block_name = ?");
      params.push(block);
    }
    if (district) {
      conditions.push("district_name = ?");
      params.push(district);
    }
    if (phc) {
      conditions.push("phc_name = ?");
      params.push(phc);
    }
    if (work_type) {
      conditions.push("work_type = ?");
      params.push(work_type);
    }

    if (start_date && end_date) {
      conditions.push("DATE(submitted_at) BETWEEN ? AND ?");
      params.push(start_date, end_date);
    }

    const whereClause =
      conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const sql = `
      SELECT *
      FROM larva_special_data_collection
      ${whereClause}
      ORDER BY submitted_at DESC
    `;

    const db = await dbPromise;
    const [rows] = await db.execute(sql, params);

    return res.status(200).json(rows);

  } catch (error) {
    console.error("getSpecialLarvaEntries error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


export const getLarvaSummary = async (req, res) => {
  try {
    const db = await dbPromise;

    // 1Ã¯Â¸ÂÃ¢Æ’Â£ Main summary counts
    const summaryQuery = `
      SELECT
        COUNT(*) AS totalEntries,

        COUNT(CASE WHEN action_taken IS NOT NULL THEN 1 END) AS totalActions,
        COUNT(CASE WHEN action_taken IS NOT NULL AND action_image_path IS NOT NULL THEN 1 END) AS completedActions,
        COUNT(CASE WHEN action_taken IS NULL THEN 1 END) AS pendingActions,

        COUNT(CASE WHEN DATE(action_date) = CURDATE() THEN 1 END) AS actionsToday,

        COUNT(CASE WHEN work_type != 'Routine ATP' THEN 1 END) AS totalLarvaeEntries,

        -- Larva positive entries
        SUM(CASE WHEN active_larval_source_count > 0 THEN 1 ELSE 0 END) AS larvaPositiveEntries,

        -- Actions on larva positive
        SUM(CASE
              WHEN active_larval_source_count > 0 AND action_taken IS NOT NULL
              THEN 1 ELSE 0
            END) AS larvaPositiveActionsDone,

        SUM(CASE
              WHEN active_larval_source_count > 0 AND action_taken IS NULL
              THEN 1 ELSE 0
            END) AS larvaPositiveActionsPending
      FROM larva_entries;
    `;
    const [[summary]] = await db.query(summaryQuery);

    // 2Ã¯Â¸ÂÃ¢Æ’Â£ Active District & Block counts (larva-positive only)
    const activeRegionQuery = `
      SELECT
        COUNT(DISTINCT district_name) AS activeDistricts,
        COUNT(DISTINCT block_name) AS activeBlocks
      FROM larva_entries
      WHERE active_larval_source_count > 0;
    `;
    const [[regionStats]] = await db.query(activeRegionQuery);

    // 3Ã¯Â¸ÂÃ¢Æ’Â£ Total sources (sum of all sources[].count)
    const totalSourcesQuery = `
      SELECT
        COALESCE(SUM(CAST(json_extract(value, '$.count') AS UNSIGNED)), 0) AS totalSources
      FROM larva_entries,
           JSON_TABLE(sources, '$[*]' COLUMNS (value JSON PATH '$')) jt;
    `;
    const [[totalSourcesRow]] = await db.query(totalSourcesQuery);

    // 4Ã¯Â¸ÂÃ¢Æ’Â£ Source breakdown
    const breakdownQuery = `
      SELECT
        JSON_UNQUOTE(json_extract(value, '$.sourceName')) AS sourceName,
        SUM(CAST(json_extract(value, '$.count') AS UNSIGNED)) AS totalCount
      FROM larva_entries,
           JSON_TABLE(sources, '$[*]' COLUMNS (value JSON PATH '$')) jt
      GROUP BY sourceName
      ORDER BY totalCount DESC;
    `;
    const [breakdownRows] = await db.query(breakdownQuery);

    const sourceBreakdown = {};
    for (const row of breakdownRows) {
      if (row.sourceName) {
        sourceBreakdown[row.sourceName] = Number(row.totalCount) || 0;
      }
    }

    // Ã¢Å“â€¦ Final response
    return res.json({
      success: true,
      data: {
        totalEntries: Number(summary.totalEntries),

        totalActions: Number(summary.totalActions),
        completedActions: Number(summary.completedActions),
        pendingActions: Number(summary.pendingActions),
        actionsToday: Number(summary.actionsToday),

        totalLarvae: Number(summary.totalLarvaeEntries),

        larvaPositive: Number(summary.larvaPositiveEntries),
        larvaPositiveActionsDone: Number(summary.larvaPositiveActionsDone),
        larvaPositiveActionsPending: Number(summary.larvaPositiveActionsPending),

        activeDistricts: Number(regionStats.activeDistricts),
        activeBlocks: Number(regionStats.activeBlocks),

        totalSources: Number(totalSourcesRow.totalSources),
        sourceBreakdown
      }
    });

  } catch (error) {
    console.error("Larva Summary Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

export const getLarvaSummaryCounts = async (req, res) => {
  try {
    const db = await dbPromise;

    // ---------------------------------------------------
    // SUMMARY
    // ---------------------------------------------------
    const [actionTakenRows] = await db.query(`
      SELECT COUNT(*) AS count
      FROM larva_entries
      WHERE action_taken IS NOT NULL AND TRIM(action_taken) <> ''
    `);

    const [pendingRows] = await db.query(`
      SELECT COUNT(*) AS count
      FROM larva_entries
      WHERE action_taken IS NULL OR TRIM(action_taken) = ''
    `);

    const [totalEntriesRows] = await db.query(`
      SELECT COUNT(*) AS count FROM larva_entries
    `);

    // ---------------------------------------------------
    // GROUP-WISE ANALYTICS (FIXED: NORMALIZED work_type)
    // ---------------------------------------------------
    const [workTypeRows] = await db.query(`
      SELECT
        TRIM(UPPER(work_type)) AS work_type,
        COUNT(*) AS count
      FROM larva_entries
      WHERE work_type IS NOT NULL AND TRIM(work_type) <> ''
      GROUP BY TRIM(UPPER(work_type))
      ORDER BY work_type
    `);

    const [blockRows] = await db.query(`
      SELECT
        district_name AS hud_name,
        block_name,
        COUNT(*) AS count
      FROM larva_entries
      GROUP BY district_name, block_name
      ORDER BY district_name, block_name
    `);

    const [phcRows] = await db.query(`
      SELECT
        district_name AS hud_name,
        block_name,
        phc_name,
        COUNT(*) AS count
      FROM larva_entries
      GROUP BY district_name, block_name, phc_name
      ORDER BY district_name, block_name, phc_name
    `);

    const [villageRows] = await db.query(`
      SELECT
        district_name AS hud_name,
        block_name,
        phc_name,
        village_name AS hsc_name,
        COUNT(*) AS count
      FROM larva_entries
      GROUP BY district_name, block_name, phc_name, village_name
      ORDER BY district_name, block_name, phc_name, village_name
    `);

    const [topHiRows] = await db.query(`
      SELECT hi_name, COUNT(*) AS entries
      FROM larva_entries
      GROUP BY hi_name
      ORDER BY entries DESC
      LIMIT 10
    `);

    // ---------------------------------------------------
    // SAFE JSON PARSER
    // ---------------------------------------------------
    const safeJSONParse = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === "object") return [value];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    };

    // ---------------------------------------------------
    // DISTRICT Ã¢â€ â€™ BlockPHCDetails Ã¢â€ â€™ SOURCES
    // ---------------------------------------------------
    const [sourceRows] = await db.query(`
      SELECT district_name, block_name, phc_name, sources, action_taken
      FROM larva_entries
    `);

    const districtSourceBreakdown = {};

    for (const row of sourceRows) {
      const district = row.district_name || "Unknown";
      const block = row.block_name || "Unknown";
      const phc = row.phc_name || "Unknown";

      const sources = safeJSONParse(row.sources);
      const actions = safeJSONParse(row.action_taken);

      if (!districtSourceBreakdown[district]) {
        districtSourceBreakdown[district] = {
          BlockPHCDetails: [],
        };
      }

      const districtObj = districtSourceBreakdown[district];

      let locationObj = districtObj.BlockPHCDetails.find(
        (item) => item.block_name === block && item.phc_name === phc
      );

      if (!locationObj) {
        locationObj = {
          block_name: block,
          phc_name: phc,
          sources: {},
        };
        districtObj.BlockPHCDetails.push(locationObj);
      }

      for (const src of sources) {
        const sourceName = src.sourceName;
        const count = Number(src.count || 0);

        if (!locationObj.sources[sourceName]) {
          locationObj.sources[sourceName] = {
            total: 0,
            treated: 0,
            destroyed: 0,
            pending: 0,
          };
        }

        locationObj.sources[sourceName].total += count;

        const action = actions.find((a) => a.sourceName === sourceName);

        if (!action) {
          locationObj.sources[sourceName].pending += count;
        } else if (action.action === "Treated") {
          locationObj.sources[sourceName].treated += Number(action.count || 0);
        } else if (action.action === "Destroyed") {
          locationObj.sources[sourceName].destroyed += Number(action.count || 0);
        }
      }
    }

    // ---------------------------------------------------
    // RESPONSE
    // ---------------------------------------------------
    return res.json({
      status: "success",

      summary: {
        total_entries: totalEntriesRows[0].count,
        total_action_taken: actionTakenRows[0].count,
        pending_actions: pendingRows[0].count,
      },

      workTypeSummary: workTypeRows,
      blockSummary: blockRows,
      phcSummary: phcRows,
      villageSummary: villageRows,
      topHi: topHiRows,

      districtSourceBreakdown,
    });
  } catch (error) {
    console.error("Larva Summary Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch larva summary",
      error: error.message,
    });
  }
};

// controllers/larvaIndexController.js

// export const getDateWiseLarvaIndexesWithActions = async (req, res) => {
//   try {
//     const db = await dbPromise;
//     const { from_date, to_date } = req.query;

//     // ---------------------------------------------------
//     // DATE FILTER
//     // ---------------------------------------------------
//     let whereClause = "";
//     const params = [];

//     if (from_date && to_date) {
//       whereClause = "WHERE DATE(le.submitted_at) BETWEEN ? AND ?";
//       params.push(from_date, to_date);
//     }

//     // ---------------------------------------------------
//     // FETCH RAW ENTRIES
//     // ---------------------------------------------------
//     const [entries] = await db.query(
//       `
//       SELECT
//         le.submitted_at,
//         le.district_name,
//         le.block_name,
//         le.phc_name,
//         le.active_larval_source_count,
//         le.overallSourceCount,
//         le.sources,
//         le.action_taken
//       FROM larva_entries le
//       ${whereClause}
//       `,
//       params
//     );

//     // ---------------------------------------------------
//     // PROCESS DATA
//     // ---------------------------------------------------
//     const map = {};

//     entries.forEach(e => {
//       const date = new Date(e.submitted_at).toISOString().split("T")[0];

//       const hud = e.district_name || "UNKNOWN_HUD";
//       const block = e.block_name || "UNKNOWN_BLOCK";
//       const phc = e.phc_name || null;

//       const key = `${date}|${hud}|${block}|${phc ?? "NO_PHC"}`;

//       if (!map[key]) {
//         map[key] = {
//           date,
//           hud_name: hud,
//           block_name: block,
//           phc_name: phc,

//           houses_inspected: 0,
//           positive_houses: 0,
//           containers_examined: 0,
//           positive_containers: 0,
//           treated_sources: 0,
//           destroyed_sources: 0,
//         };
//       }

//       // -----------------------------
//       // HOUSE INDEX
//       // -----------------------------
//       map[key].houses_inspected += 1;

//       if (Number(e.active_larval_source_count) > 0) {
//         map[key].positive_houses += 1;
//       }

//       // -----------------------------
//       // CONTAINER INDEX
//       // -----------------------------
//       map[key].containers_examined += Number(e.overallSourceCount || 0);

//       const sources = Array.isArray(e.sources)
//         ? e.sources
//         : JSON.parse(e.sources || "[]");

//       map[key].positive_containers += sources.reduce(
//         (sum, s) => sum + Number(s.count || 0),
//         0
//       );

//       // -----------------------------
//       // ACTION COUNTS
//       // -----------------------------
//       if (e.action_taken) {
//         const action = JSON.parse(e.action_taken);
//         const sourceActions = action.sourceActions || [];

//         sourceActions.forEach(sa => {
//           const count = Number(sa.count || 0);

//           if (sa.action === "Treated") {
//             map[key].treated_sources += count;
//           }

//           if (sa.action === "Destroyed") {
//             map[key].destroyed_sources += count;
//           }
//         });
//       }
//     });

//     // ---------------------------------------------------
//     // FINAL RESPONSE FORMAT
//     // ---------------------------------------------------
//     const data = Object.values(map).map(d => ({
//       date: d.date,
//       hud_name: d.hud_name,
//       block_name: d.block_name,
//       phc_name: d.phc_name,

//       houses_inspected: d.houses_inspected,
//       positive_houses: d.positive_houses,
//       house_index:
//         d.houses_inspected > 0
//           ? Number(((d.positive_houses / d.houses_inspected) * 100).toFixed(2))
//           : 0,

//       containers_examined: d.containers_examined,
//       positive_containers: d.positive_containers,
//       container_index:
//         d.containers_examined > 0
//           ? Number(
//               ((d.positive_containers / d.containers_examined) * 100).toFixed(2)
//             )
//           : 0,

//       treated_sources: d.treated_sources,
//       destroyed_sources: d.destroyed_sources,
//       total_actioned_sources:
//         d.treated_sources + d.destroyed_sources,
//     }));

//     // ---------------------------------------------------
//     // RESPONSE
//     // ---------------------------------------------------
//     return res.json({
//       status: "success",
//       data,
//     });

//   } catch (error) {
//     console.error("Larva Index Error:", error);

//     return res.status(500).json({
//       status: "error",
//       message: "Failed to fetch date-wise larva indexes with actions",
//       error: error.message,
//     });
//   }
// };

// controllers/larvaIndexController.js
// controllers/larvaIndexController.js
export const getDateWiseLarvaIndexesWithActions = async (req, res) => {
  try {
    const db = await dbPromise;
    const { from_date, to_date } = req.query;

    // ------------------------------
    // DATE FILTER
    // ------------------------------
    let whereClause = "";
    const params = [];

    if (from_date && to_date) {
      whereClause = "WHERE DATE(created_at) BETWEEN ? AND ?";
      params.push(from_date, to_date);
    }

    // ------------------------------
    // FETCH ENTRIES
    // ------------------------------
    const [entries] = await db.query(
      `
      SELECT
        created_at,
        updated_at,
        district_name,
        block_name,
        phc_name,
        latitude,
        longitude,
        work_type,
        active_larval_source_count,
        overallSourceCount,
        sources,
        action_taken
      FROM larva_entries
      ${whereClause}
      `,
      params
    );

    // ------------------------------
    // PROCESS DATA
    // ------------------------------
    const dailyMap = {}; // key = date|HUD|Block|PHC (PHC null handled)

    entries.forEach((e) => {
      const inspectionDate = new Date(e.created_at).toISOString().split("T")[0];
      const phcKey = e.phc_name || "NO_PHC"; // group null PHC
      const key = `${inspectionDate}|${e.district_name}|${e.block_name}|${phcKey}`;

      // Initialize group if not exist
      if (!dailyMap[key]) {
        dailyMap[key] = {
          date: inspectionDate,
          hud_name: e.district_name,
          block_name: e.block_name,
          phc_name: e.phc_name || null,
          houses_inspected: 0,
          positive_houses: 0,
          containers_examined: 0,
          positive_containers: 0,
          treated_sources: 0,
          destroyed_sources: 0,
        };
      }

      // ------------------------------
      // COUNT ALL HOUSES INSPECTED
      // ------------------------------
      dailyMap[key].houses_inspected += 1;

      // POSITIVE HOUSES
      if (Number(e.active_larval_source_count) > 0)
        dailyMap[key].positive_houses += 1;

      // ------------------------------
      // CONTAINERS (ALL HOUSES)
      // ------------------------------
      dailyMap[key].containers_examined += Number(e.overallSourceCount || 0);
      const sources = Array.isArray(e.sources) ? e.sources : JSON.parse(e.sources || "[]");
      dailyMap[key].positive_containers += sources.reduce(
        (sum, s) => sum + Number(s.count || 0),
        0
      );

      // ------------------------------
      // ACTION AGGREGATION
      // ------------------------------
      if (e.action_taken) {
        const actions =
          typeof e.action_taken === "string"
            ? JSON.parse(e.action_taken)
            : e.action_taken;
        const sourceActions = actions.sourceActions || [];

        sourceActions.forEach((sa) => {
          const count = Number(sa.count || 0);
          if (sa.action === "Treated") dailyMap[key].treated_sources += count;
          if (sa.action === "Destroyed") dailyMap[key].destroyed_sources += count;
        });
      }
    });

    // ------------------------------
    // FINAL RESPONSE
    // ------------------------------
    const result = Object.values(dailyMap).map((d) => ({
      date: d.date,
      hud_name: d.hud_name,
      block_name: d.block_name,
      phc_name: d.phc_name,

      houses_inspected: d.houses_inspected,
      positive_houses: d.positive_houses,
      house_index:
        d.houses_inspected > 0
          ? Number(((d.positive_houses / d.houses_inspected) * 100).toFixed(2))
          : 0,

      containers_examined: d.containers_examined,
      positive_containers: d.positive_containers,
      container_index:
        d.containers_examined > 0
          ? Number(((d.positive_containers / d.containers_examined) * 100).toFixed(2))
          : 0,

      treated_sources: d.treated_sources,
      destroyed_sources: d.destroyed_sources,
      total_actioned_sources: d.treated_sources + d.destroyed_sources,
    }));

    return res.json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error("Larva Index Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch date-wise larva indexes with actions",
      error: error.message,
    });
  }
};





export const getDailyCounts = async (req, res) => {
  const db = await dbPromise;
  const { user_id, role, type } = req.query;

  if (!user_id || !role || !type) {
    return res.status(400).json({ message: "Missing user_id, role, or type" });
  }

  try {
    // ---------- MOSQUITO ----------
    if (type === "mosquito") {
      if (!(role === "hi_user" || role === "block_user" || role === "RWAL_hi_user")) {
        return res.status(400).json({ message: "Invalid role/type" });
      }

      const [rows] = await db.query(
        `SELECT date, COUNT(*) as count
         FROM datacollection
         WHERE user_id = ?
         GROUP BY date`,
        [user_id]
      );

      const countsByDate = {};
      rows.forEach((row) => {
        countsByDate[row.date] = row.count;
      });

      return res.json(countsByDate);
    }

    // ---------- CHLORINE ----------
    if (type === "chlorine") {
      let tables = [];

      if (role === "hi_user") {
        tables = ["chlorine_hud_data_collection_new"];
      } else if (role === "RWAL_hi_user") {
        tables = ["chlorine_data_collection"];
      } else if (role === "block_user") {
        tables = [
          "chlorine_data_collection",
          "chlorine_block_data_collection",
        ];
      } else if (role === "chl_admin") {
        tables = ["chlorine_special_data_collection"]; // ? NEW
      } else {
        return res.status(400).json({ message: "Invalid role/type" });
      }

      const countsByDate = {};

      for (const table of tables) {
        const [rows] = await db.query(
          `SELECT timestamp FROM ${table} WHERE user_id = ?`,
          [user_id]
        );
        rows.forEach((row) => {
          const rawTs = row.timestamp;
          const ts =
            typeof rawTs === "string"
              ? rawTs.replace(/\u202F|\u00A0/g, " ").trim()
              : rawTs;

          // ? ONLY special table / chl_admin has dd/mm/yyyy with time
          if ((role === "chl_admin" || role === "RWAL_hi_user") && typeof ts === "string" && ts.includes("/")) {
            const dateOnly = ts.split(" ")[0]; // ?? remove time safely
            const [dd, mm, yyyy] = dateOnly.split("/");

            if (dd && mm && yyyy) {
              const key = `${dd.padStart(2, "0")}-${mm.padStart(2, "0")}-${yyyy}`;
              countsByDate[key] = (countsByDate[key] || 0) + 1;
            }
          }

          else if (
            role === "hi_user" &&
            typeof ts === "string" &&
            ts.includes("/")
          ) {
            const normalizedTs = ts.replace(",", " ").trim(); // 05/02/2026 10:33:19
            const dateOnly = normalizedTs.split(" ")[0];
            const [dd, mm, yyyy] = dateOnly.split("/");

            if (dd && mm && yyyy) {
              const key = `${dd.padStart(2, "0")}-${mm.padStart(2, "0")}-${yyyy}`;
              countsByDate[key] = (countsByDate[key] || 0) + 1;
            }
          }
          // ?? ALL OTHER ROLES — UNTOUCHED
          else {
            const dateObj =
              typeof ts === "string"
                ? new Date(ts.replace(" ", "T"))
                : new Date(ts);

            if (!isNaN(dateObj)) {
              const local = new Date(
                dateObj.getTime() - dateObj.getTimezoneOffset() * 60000
              );

              const dd = String(local.getDate()).padStart(2, "0");
              const mm = String(local.getMonth() + 1).padStart(2, "0");
              const yyyy = local.getFullYear();

              const key = `${dd}-${mm}-${yyyy}`;
              countsByDate[key] = (countsByDate[key] || 0) + 1;
            }
          }
        });

      }

      return res.json(countsByDate);
    }

    // ---------- HI MONITORING ----------
    if (type === "hi") {
      if (!(role === "hi_user" || role === "block_user" || role === "RWAL_hi_user" || role === "special_user" || role === "mos_admin")) {
        return res.status(400).json({ message: "Invalid role/type" });
      }

      // ?? Decide table based on role
      const tableName =
        role === "block_user" || role === "mos_admin" || role === "special_user"
          ? "dbc_hi_monitoring_special"
          : "dbc_hi_monitoring";

      const [rows] = await db.query(
        `SELECT timestamp FROM ${tableName} WHERE user_id = ?`,
        [user_id]
      );

      const countsByDate = {};

      rows.forEach((row) => {
        const dateObj = new Date(row.timestamp);
        if (!isNaN(dateObj)) {
          const dd = String(dateObj.getDate()).padStart(2, "0");
          const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
          const yyyy = dateObj.getFullYear();
          const key = `${dd}-${mm}-${yyyy}`;
          countsByDate[key] = (countsByDate[key] || 0) + 1;
        }
      });

      return res.json(countsByDate);
    }

    // ---------- LARVAL MONITORING ----------
    if (type === "larval") {
      if (
        !(
          role === "hi_user" ||
          role === "block_user" ||
          role === "RWAL_hi_user" ||
          role === "special_user" ||
          role === "mos_admin"
        )
      ) {
        return res.status(400).json({ message: "Invalid role/type" });
      }

      const tableName =
        role === "block_user" || role === "mos_admin" || role === "special_user"
          ? "larva_special_data_collection"
          : "larva_entries";

      const [rows] = await db.query(
        `SELECT created_at FROM ${tableName} WHERE user_id = ?`,
        [user_id]
      );

      const countsByDate = {};

      rows.forEach((row) => {
        const dateObj = new Date(row.created_at);
        if (!isNaN(dateObj)) {
          const dd = String(dateObj.getDate()).padStart(2, "0");
          const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
          const yyyy = dateObj.getFullYear();
          const key = `${dd}-${mm}-${yyyy}`;
          countsByDate[key] = (countsByDate[key] || 0) + 1;
        }
      });

      return res.json(countsByDate);
    }

    // ---------- INVALID TYPE ----------
    return res.status(400).json({ message: "Invalid type" });

  } catch (err) {
    console.error("Error fetching daily counts:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


export const getDataCollection = async (req, res) => {
  const db = await dbPromise;
  try {
    // Query MySQL for all datacollection rows

    const [rows] = await db.execute(`
      SELECT
              user_id,
        username,
        district_name,
        block_name,
        areaType,
        monitoringArea,
        geolocation,
        date,
        time,
        address,
        user_geolocation,
        image_base64
      FROM datacollection
    `);

    // Parse JSON fields and format response
    const formatted = rows.map((row) => {
      let geo = {};
      let userGeo = {};

      try {
        geo = JSON.parse(row.geolocation || "{}");
        userGeo = JSON.parse(row.user_geolocation || "{}");
      } catch (e) {
        console.error("JSON parse error", e);
      }

      return {
        ...row,
        geolocation: geo,
        user_geolocation: userGeo,
        image_url: row.image_base64 ? `http://localhost:3000${row.image_base64}` : null,
      };
    });

    res.status(200).json(formatted);
  } catch (err) {
    console.error("Error fetching datacollection:", err);
    res.status(500).json({ message: "Failed to fetch data collection" });
  }
};

export const getDatewiseCountByUser = async (req, res) => {
  const db = await dbPromise;
  try {
    const { user_id } = req.query;

    // Execute the query with user_id parameter
    const [rows] = await db.execute(
      `SELECT date FROM datacollection WHERE user_id = ?`,
      [user_id]
    );

    const counts = {};

    rows.forEach(({ date }) => {
      if (!date || typeof date !== 'string') return;

      const parts = date.split('-'); // expecting DD-MM-YYYY
      if (parts.length === 3) {
        const key = date; // keep DD-MM-YYYY as is
        counts[key] = (counts[key] || 0) + 1;
      } else {
        counts['invalid'] = (counts['invalid'] || 0) + 1;
      }
    });

    res.status(200).json(counts);
  }
  catch (err) {
    console.error('ÃƒÂ¢ Ã…â€™ Error fetching datewise count:', err);
    res.status(500).json({ message: 'Failed to fetch counts' });
  }
};


// Add to your controller (e.g., in dashboardController.js)
export const getDatewiseUserCountDetails = async (req, res) => {
  const db = await dbPromise;
  const { user_id, date } = req.query;

  if (!user_id || !date) {
    return res.status(400).json({ message: 'Missing user_id or date' });
  }

  try {

    const [rows] = await db.execute(
      `
      SELECT COUNT(*) AS count
      FROM datacollection
      WHERE user_id = ? AND date = ?
      `,
      [user_id, date]
    );

    const row = rows[0] || { count: 0 };

    res.status(200).json({ count: row.count });
  } catch (err) {
    console.error('Error in getDatewiseUserCountDetails:', err);
    res.status(500).json({ message: 'Failed to fetch count details' });
  }
};

async function generateHubId() {
  const db = await dbPromise;
  const [rows] = await db.execute(
    "SELECT hub_id FROM chlorination_hubs ORDER BY hub_id DESC LIMIT 1"
  );
  console.log("Rows from SELECT:", rows);

  if (!rows.length) return "HUB001";
  const lastRow = rows[0].hub_id;
  const lastId = parseInt(lastRow.replace("HUB", ""), 10);
  if (isNaN(lastId)) throw new Error("Bad hub_id in DB: " + lastRow);
  return `HUB${String(lastId + 1).padStart(3, "0")}`;
}


export const addMosquitoBlock = async (req, res) => {
  try {
    const { block_id, block_name, district_code, district_name } = req.body;

    if (!block_id || !block_name || !district_code || !district_name) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const db = await dbPromise; // get MySQL connection
    const [result] = await db.execute(
      `INSERT INTO mosquito_blocks_master
       (block_id, block_name, district_code, district_name)
       VALUES (?, ?, ?, ?)`,
      [block_id, block_name, district_code, district_name]
    );


    res.status(201).json({ message: "Block added successfully", block_id });
  } catch (err) {
    console.error("Error adding mosquito block:", err);
    if (err.code === "SQLITE_CONSTRAINT") {
      res.status(409).json({ message: "Block ID already exists" });
    } else {
      res.status(500).json({ message: "Failed to add block" });
    }
  }
};

export const getMosquitoBlocks = async (req, res) => {
  try {
    const db = await dbPromise; // get MySQL connection

    const [rows] = await db.execute(`
      SELECT * FROM mosquito_blocks_master
      ORDER BY district_name, block_name
    `);

    res.json(rows);
  } catch (err) {
    console.error("Error fetching mosquito blocks:", err);
    res.status(500).send("Failed to fetch mosquito blocks");
  }
};
export const updateMosquitoBlockName = async (req, res) => {
  const { block_id } = req.params;
  const { block_name } = req.body;

  if (!block_id || !block_name) {
    return res.status(400).json({ message: "Block ID and new name are required" });
  }

  try {
    const db = await dbPromise; // get MySQL connection

    const query = `
      UPDATE mosquito_blocks_master
      SET block_name = ?
      WHERE block_id = ?
    `;

    const [result] = await db.execute(query, [block_name, block_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Block not found" });
    }

    res.status(200).json({ message: "Block name updated successfully" });
  } catch (err) {
    console.error("Block update error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


export const getMosquitoBlockById = async (req, res) => {
  const { block_id } = req.params;
  if (!block_id) {
    return res.status(400).json({ message: "Block ID required" });
  }

  try {
    const db = await dbPromise; // get MySQL connection

    const query = `SELECT * FROM mosquito_blocks_master WHERE block_id = ?`;
    const [rows] = await db.execute(query, [block_id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Block not found" });
    }

    return res.json(rows[0]); // return first row
  } catch (err) {
    console.error("Error fetching mosquito block by ID:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/mosquito-blocks/:block_id
export const deleteMosquitoBlockById = async (req, res) => {
  const { block_id } = req.params;
  if (!block_id) {
    return res.status(400).json({ message: "Block ID required" });
  }

  try {
    const db = await dbPromise; // get MySQL connection

    const [result] = await db.execute(
      `DELETE FROM mosquito_blocks_master WHERE block_id = ?`,
      [block_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Block not found or already deleted" });
    }

    return res.json({ message: "Block deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


async function generateCorporationCode(district_name) {
  const prefix = 'MOSCORP';
  const distPrefix = district_name.slice(0, 4).toUpperCase();
  const likePattern = `${prefix}${distPrefix}%`;
  const db = await dbPromise; // Get DB connection
  // Use execute() for MySQL
  const [rows] = await db.execute(
    `SELECT corporation_code FROM corporation_master
     WHERE corporation_code LIKE ?
     ORDER BY corporation_code DESC
     LIMIT 1`,
    [likePattern]
  );

  let number = 1;
  if (rows.length && rows[0].corporation_code) {
    const lastNumber = parseInt(rows[0].corporation_code.slice(-3));
    if (!isNaN(lastNumber)) number = lastNumber + 1;
  }

  return `${prefix}${distPrefix}${String(number).padStart(3, "0")}`;
}

// POST - Create corporation
export const addCorporation = async (req, res) => {
  const db = await dbPromise;
  try {
    const { district_name, corporation_name } = req.body;

    if (!district_name || !corporation_name) {
      return res.status(400).json({ message: "District and Corporation name required" });
    }

    // Ã¢Å“â€¦ Await the code generator if it returns a Promise
    const corporation_code = await generateCorporationCode(district_name);

    // Now corporation_code is a string, not a Promise
    const [result] = await db.execute(
      `INSERT INTO corporation_master (
        district_name, corporation_name, corporation_code
      ) VALUES (?, ?, ?)`,
      [district_name, corporation_name, corporation_code]
    );

    res.status(201).json({
      message: "Corporation added",
      corporation_code,
      corporation: { district_name, corporation_name, corporation_code }
    });
  } catch (err) {
    console.error("Create error:", err);
    res.status(500).json({ message: "Failed to create corporation" });
  }
};

export const getCorporations = async (req, res) => {
  try {
    const db = await dbPromise;
    const [rows] = await db.execute("SELECT * FROM corporation_master ORDER BY district_name");
    res.json(rows);
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ message: "Failed to fetch corporations" });
  }
};

// PUT - Update corporation name
export const updateCorporation = async (req, res) => {
  const { corporation_code } = req.params;
  const { corporation_name, district_name } = req.body;

  if (!corporation_name || !district_name) {
    return res.status(400).json({ message: "Corporation name and district name are required" });
  }

  console.log(`updateCorporation: code=${corporation_code}, newName=${corporation_name}, newDistrict=${district_name}`);

  try {
    const db = await dbPromise;

    const [result] = await db.execute(
      `UPDATE corporation_master
       SET corporation_name = ?, district_name = ?
       WHERE corporation_code = ?`,
      [corporation_name, district_name, corporation_code]
    );

    console.log("updateCorporation result:", result);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Corporation not found" });
    }

    return res.status(200).json({ message: "Corporation updated" });
  } catch (err) {
    console.error("Update error:", err);
    return res.status(500).json({ message: "Failed to update corporation" });
  }
};

export const deleteCorporation = async (req, res) => {
  const { corporation_code } = req.params;

  if (!corporation_code) {
    return res.status(400).json({ message: 'corporation_code parameter required' });
  }

  try {
    const db = await dbPromise;

    const [result] = await db.execute(
      "DELETE FROM corporation_master WHERE corporation_code = ?",
      [corporation_code]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Corporation not found" });
    }

    return res.status(200).json({ message: "Corporation deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ message: "Failed to delete corporation" });
  }
};


// ADD - Municipality
// Ã¢Å“â€¦ your MySQL connection pool (mysql2/promise)

export const addMosMunicipality = async (req, res) => {
  const db = await dbPromise; // Ã¢Å“â€¦ Get DB connection
  try {
    const { corporation_code, municipality_name } = req.body;

    if (!corporation_code || !municipality_name) {
      return res.status(400).json({ message: "Corporation code and Municipality name are required" });
    }

    // Ã¢Å“â€¦ Get corporation info by code
    const [corpRows] = await db.execute(
      `SELECT district_name, corporation_name
       FROM corporation_master
       WHERE corporation_code = ?`,
      [corporation_code]
    );

    if (corpRows.length === 0) {
      return res.status(404).json({ message: "Corporation not found" });
    }

    const { district_name, corporation_name } = corpRows[0];
    const module = "mosquito";

    // Ã¢Å“â€¦ Generate ID parts
    const cleanCorp = corporation_name.replace(/\s+/g, '').substring(0, 4).toUpperCase();
    const cleanMuni = municipality_name.replace(/\s+/g, '').substring(0, 4).toUpperCase();
    const prefix = `MOSCORP${cleanCorp}MUN${cleanMuni}`;

    // Ã¢Å“â€¦ Count how many IDs already exist with this prefix
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS count
       FROM mos_mun_master_table
       WHERE municipality_id LIKE ?`,
      [`${prefix}%`]
    );

    const sequence = String(countRows[0].count + 1).padStart(3, '0');
    const municipality_id = `${prefix}${sequence}`;

    // Ã¢Å“â€¦ Insert into DB
    await db.execute(
      `INSERT INTO mos_mun_master_table (
        district_name, corporation_name, corporation_code,
        municipality_name, module, municipality_id
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [district_name, corporation_name, corporation_code, municipality_name, module, municipality_id]
    );

    res.status(201).json({
      message: "Municipality added successfully",
      municipality_id
    });

  } catch (err) {
    console.error("Add error:", err);
    res.status(500).json({ message: "Failed to add municipality" });
  }
};


// GET - All Municipalities
// GET all
export const getMosMunicipalities = async (req, res) => {
  try {
    const db = await dbPromise;
    const [rows] = await db.execute("SELECT * FROM mos_mun_master_table ORDER BY district_name, municipality_name");
    res.json(rows);
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ message: "Failed to fetch municipalities" });
  }
};

// UPDATE name
export const updateMosMunicipality = async (req, res) => {
  const { municipality_id } = req.params;
  const { municipality_name } = req.body;

  if (!municipality_name) {
    return res.status(400).json({ message: "Municipality name required" });
  }

  try {
    const db = await dbPromise;
    const [stmt] = db.execute("UPDATE mos_mun_master_table SET municipality_name = ? WHERE municipality_id = ?", [municipality_name, municipality_id]);

    if (stmt.affectedRows === 0) {
      return res.status(404).json({ message: "Municipality not found" });
    }

    res.status(200).json({ message: "Municipality updated" });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Failed to update municipality" });
  }
};

// DELETE


export const deleteMosMunicipality = async (req, res) => {
  const { municipality_id } = req.params;

  if (!municipality_id) {
    return res.status(400).json({ message: "Municipality ID is required" });
  }

  try {
    const db = await dbPromise;

    const [result] = await db.execute(
      "DELETE FROM mos_mun_master_table WHERE municipality_id = ?",
      [municipality_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Municipality not found" });
    }

    res.status(200).json({ message: "Municipality deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Failed to delete municipality" });
  }
};

// GET - Fetch all municipality users()
export const getMosMunMasterUsers = async (req, res) => {
  try {
    const db = await dbPromise; // if dbPromise is a pool/connection promise
    const [rows] = await db.execute("SELECT * FROM mos_mun_master_users");

    res.status(200).json(rows);
  } catch (err) {
    console.error("getMosMunMasterUsers error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};


/*

export const addMosMunMasterUser = async (req, res) => {
  try {
    const {
      username,
      password,
      phone_number,
      email,
      corporation_name,
      corporation_code,
      district_name,
      municipality_name,
      municipality_id,
      role = "municipality_user",
      status = "Active",
    } = req.body;

    const module = "mosquito";
   const db = await dbPromise;
    const [countStmt] = db.execute(`
      SELECT COUNT(*) AS count FROM mos_mun_master_users
      WHERE municipality_id = ?
    `);
    const { count } = countStmt.get(municipality_id);

   
    const nextUserNum = (count + 1).toString().padStart(3, "0");
    const user_id = `${municipality_id}USR${nextUserNum}`;

   
    const hashedPassword = await bcrypt.hash(password, 10);

    const insertStmt = db.execute(`
      INSERT INTO mos_mun_master_users (
        user_id,
        username,
        password,
        phone_number,
        email,
        corporation_name,
        corporation_code,
        district_name,
        municipality_name,
        municipality_id,
        role,
        module,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,[ username,
      hashedPassword,
      phone_number,
      email,
      corporation_name,
      corporation_code,
      district_name,
      municipality_name,
      municipality_id,
      role,
      module,
      status]);

   


    res.status(201).json({
      user_id,
      username,
      phone_number,
      email,
      corporation_name,
      corporation_code,
      district_name,
      municipality_name,
      municipality_id,
      role,
      module,
      status,
    });
  } catch (err) {
    console.error("addMosMunMasterUser error:", err);
    if (err.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
      return res.status(409).json({ message: "User ID already exists" });
    }
    res.status(500).json({ message: "Failed to add user" });
  }
};*/

export const addMosMunMasterUser = async (req, res) => {
  try {
    const {
      username,
      password,
      phone_number,
      email,
      corporation_name,
      corporation_code,
      district_name,
      municipality_name,
      municipality_id,
      role = "municipality_user",
      status = "Active",
    } = req.body;

    if (!username || !password || !email || !municipality_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const module = "mosquito";
    const db = await dbPromise;

    // Count existing users in this municipality
    const [rows] = await db.execute(
      `SELECT COUNT(*) AS count FROM mos_mun_master_users WHERE municipality_id = ?`,
      [municipality_id]
    );
    const count = rows[0].count;

    // Generate user_id
    const nextUserNum = (count + 1).toString().padStart(3, "0");
    const user_id = `${municipality_id}USR${nextUserNum}`;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Helper to convert undefined to null
    function safe(value) {
      return value === undefined ? null : value;
    }

    // Insert new user with all parameters safely handled
    const [stmt] = await db.execute(
      `INSERT INTO mos_mun_master_users (
        user_id,
        username,
        password,
        phone_number,
        email,
        corporation_name,
        corporation_code,
        district_name,
        municipality_name,
        municipality_id,
        role,
        module,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        safe(user_id),
        safe(username),
        safe(hashedPassword),
        safe(phone_number),
        safe(email),
        safe(corporation_name),
        safe(corporation_code),
        safe(district_name),
        safe(municipality_name),
        safe(municipality_id),
        safe(role),
        safe(module),
        safe(status),
      ]
    );

    console.log("Insert Params:", [
      safe(user_id),
      safe(username),
      safe(hashedPassword),
      safe(phone_number),
      safe(email),
      safe(corporation_name),
      safe(corporation_code),
      safe(district_name),
      safe(municipality_name),
      safe(municipality_id),
      safe(role),
      safe(module),
      safe(status),
    ]);

    // Respond with success and user details (except password)
    return res.status(201).json({
      user_id,
      username,
      phone_number,
      email,
      corporation_name,
      corporation_code,
      district_name,
      municipality_name,
      municipality_id,
      role,
      module,
      status,
    });
  } catch (err) {
    console.error("addMosMunMasterUser error:", err.stack || err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "User already exists" });
    }

    return res.status(500).json({ message: "Failed to add user", error: err.message });
  }
};

export const updateMosMunMasterUser = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;
  const { password, phone_number, email, status } = req.body;

  try {
    let query, params;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `
        UPDATE mos_mun_master_users
        SET password = ?, phone_number = ?, email = ?, status = ?
        WHERE user_id = ?
      `;
      params = [hashedPassword, phone_number, email, status, user_id];
    } else {
      query = `
        UPDATE mos_mun_master_users
        SET phone_number = ?, email = ?, status = ?
        WHERE user_id = ?
      `;
      params = [phone_number, email, status, user_id];
    }

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User updated successfully" });
  } catch (err) {
    console.error("updateMosMunMasterUser error:", err);
    res.status(500).json({ message: "Failed to update user" });
  }
};


export const deleteMosMunMasterUser = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;

  try {
    const [result] = await db.execute(
      "DELETE FROM mos_mun_master_users WHERE user_id = ?",
      [user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("deleteMosMunMasterUser error:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
};

export const getCorpMasterUsers = async (req, res) => {
  try {
    const db = await dbPromise;
    const [rows] = await db.execute("SELECT * FROM mosquito_corp_master_users");
    res.json(rows);
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// POST - Add new user
export const addCorpMasterUser = async (req, res) => {
  try {
    const {
      user_id, username, password, phone_number, email,
      corporation_code, corporation_name, district_name,
      role, module, status
    } = req.body;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // INSERT query (no need to store output)
    await db.execute(
      `
      INSERT INTO mosquito_corp_master_users (
        user_id, username, password, phone_number, email,
        corporation_code, corporation_name, district_name,
        role, module, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        user_id,
        username,
        hashedPassword,
        phone_number,
        email,
        corporation_code,
        corporation_name,
        district_name,
        role,
        module,
        status,
      ]
    );

    return res.status(201).json({
      user_id,
      username,
      phone_number,
      corporation_code,
      corporation_name,
      district_name,
      role,
      module,
      status,
      email,
    });
  } catch (err) {
    console.error("addCorpMasterUser error:", err);

    // Replace SQLite error with MySQL error code
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "User ID already exists" });
    }

    return res.status(500).json({ message: "Failed to add user" });
  }
};



// PUT - Update user
export const updateCorpMasterUser = async (req, res) => {
  const { user_id } = req.params;
  const { username, password, phone_number, status, email } = req.body;

  try {
    let sql, params;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      sql = `
        UPDATE mosquito_corp_master_users
        SET username = ?, password = ?, phone_number = ?, status = ?, email = ?
        WHERE user_id = ?
      `;
      params = [username, hashedPassword, phone_number, status, email, user_id];
    } else {
      sql = `
        UPDATE mosquito_corp_master_users
        SET username = ?, phone_number = ?, status = ?, email = ?
        WHERE user_id = ?
      `;
      params = [username, phone_number, status, email, user_id];
    }

    const [result] = await db.execute(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User updated successfully" });
  } catch (err) {
    console.error("updateCorpMasterUser error:", err);
    res.status(500).json({ message: "Failed to update user" });
  }
};

// DELETE - Remove user
export const deleteCorpMasterUser = async (req, res) => {
  const { user_id } = req.params;

  try {
    // MySQL returns an object with affectedRows
    const [result] = await db.execute(
      "DELETE FROM mosquito_corp_master_users WHERE user_id = ?",
      [user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("deleteCorpMasterUser error:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
};


export const addMosquitoBlockUser = async (req, res) => {
  const db = await dbPromise;

  try {
    const {
      username,
      password,
      email,
      phone_number,
      district_code,
      block_id,
      block_name,
      status = "Active",
      module = "mosquito",
      role = "block_user",
    } = req.body;

    // ---------------------------------------
    // 1Ã¯Â¸ÂÃ¢Æ’Â£   Validate district
    // ---------------------------------------
    const [districtRows] = await db.execute(
      `SELECT district_name FROM mosquito_district_master WHERE district_code = ?`,
      [district_code]
    );

    if (districtRows.length === 0) {
      return res.status(400).json({ message: "Invalid district code" });
    }

    const district_name = districtRows[0].district_name;

    const distPrefix = district_name.slice(0, 4).toUpperCase();
    const blockPrefix = block_name.slice(0, 4).toUpperCase();

    // ---------------------------------------
    // 2Ã¯Â¸ÂÃ¢Æ’Â£   Find the last user_id for this block
    // ---------------------------------------
    const [lastUserRows] = await db.execute(
      `
      SELECT user_id FROM mosquito_block_users
      WHERE district_code = ? AND block_id = ?
      ORDER BY LENGTH(user_id) DESC, user_id DESC
      LIMIT 1
      `,
      [district_code, block_id]
    );

    let nextNumber = 1;

    if (lastUserRows.length > 0) {
      const lastId = lastUserRows[0].user_id;
      const match = lastId.match(/USR(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // ---------------------------------------
    // 3Ã¯Â¸ÂÃ¢Æ’Â£   Generate UNIQUE user_id
    // ---------------------------------------
    let user_id;
    let exists;

    do {
      user_id = `MOS${distPrefix}BLK${blockPrefix}USR${String(
        nextNumber
      ).padStart(3, "0")}`;

      const [existRows] = await db.execute(
        `SELECT 1 FROM mosquito_block_users WHERE user_id = ?`,
        [user_id]
      );

      exists = existRows.length > 0;

      if (exists) nextNumber++;

    } while (exists);

    // ---------------------------------------
    // 4Ã¯Â¸ÂÃ¢Æ’Â£   Hash password
    // ---------------------------------------
    const hashedPassword = await bcrypt.hash(password, 10);

    // ---------------------------------------
    // 5Ã¯Â¸ÂÃ¢Æ’Â£   Insert new block user
    // ---------------------------------------
    const [insertResult] = await db.execute(
      `
      INSERT INTO mosquito_block_users (
        user_id, username, password, email, phone_number,
        district_code, district_name, block_id, block_name,
        status, module, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        user_id,
        username,
        hashedPassword,
        email,
        phone_number,
        district_code,
        district_name,
        block_id,
        block_name,
        status,
        module,
        role,
      ]
    );

    if (insertResult.affectedRows === 0) {
      return res.status(500).json({ message: "Failed to insert user" });
    }

    console.log("Ã¢Å“â€¦ block user created:", {
      user_id,
      username,
      district_code,
      block_id,
      block_name,
    });

    return res.status(201).json({
      message: "Block user created",
      user_id,
    });

  } catch (err) {
    console.error("Ã¢ÂÅ’ Create error:", err);
    return res.status(500).json({ message: "Failed to create user" });
  }
};


export const getMosquitoBlockUsers = async (req, res) => {
  const db = await dbPromise;
  try {

    const [stmt] = await db.execute("SELECT * FROM mosquito_block_users ORDER BY district_name, block_name");

    res.json(stmt);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};
// PUT /dashboard/update-mosquito-block-user/:user_id
export const updateMosquitoBlockUser = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;
  const { email, phone_number, password, status } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    let query = "UPDATE mosquito_block_users SET ";
    const params = [];

    if (email !== undefined) {
      query += "email = ?, ";
      params.push(email);
    }
    if (phone_number !== undefined) {
      query += "phone_number = ?, ";
      params.push(phone_number);
    }
    if (status !== undefined) {
      query += "status = ?, ";
      params.push(status);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += "password = ?, ";
      params.push(hashedPassword);
    }

    // Ã¢Ââ€” Make sure at least one field was provided
    if (params.length === 0) {
      return res.status(400).json({ message: "No fields provided for update" });
    }

    // Remove the trailing comma and space, then add WHERE
    query = query.replace(/, $/, " ");
    query += "WHERE user_id = ?";
    params.push(user_id);

    // Ã¢Å“â€¦ Execute with params
    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Block user updated successfully" });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// DELETE /dashboard/mosquito-block-user/:user_id
export const deleteMosquitoBlockUser = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const stmt = await db.execute("DELETE FROM mosquito_block_users WHERE user_id = ?", [user_id]);


    if (stmt.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Block user deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// mysql2/promise connection

export const addMosBlockCollector = async (req, res) => {
  try {
    const {
      username,
      password,
      email,
      phone_number,
      district_id,
      district_name,
      block_id,
      block_name,
    } = req.body;


    if (
      !username ||
      !password ||
      !email ||
      !phone_number ||
      !district_id ||
      !district_name ||
      !block_id ||
      !block_name
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const passwordRegex =
      /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{};':"\\|,.<>/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 chars, include 1 uppercase, 1 number, 1 special character",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!/^\d{10}$/.test(phone_number)) {
      return res.status(400).json({ message: "Phone number must be 10 digits" });
    }


    const distPrefix = district_name.slice(0, 4).toUpperCase();
    const blockPrefix = block_name.slice(0, 4).toUpperCase();
    const db = await dbPromise; // Ã¢Å“â€¦ Get DB connection
    const [countRows] = await db.execute(
      `
        SELECT COUNT(*) as total
        FROM mosquito_block_datacollector
        WHERE district_id = ? AND block_id = ?
      `,
      [district_id, block_id]
    );
    const count = countRows[0]?.total || 0;

    const user_id = `MOS${distPrefix}BLK${blockPrefix}USR${String(
      count + 1
    ).padStart(3, "0")}`;

    const hashedPassword = await bcrypt.hash(password, 10);

    const [insertResult] = await db.execute(
      `
        INSERT INTO mosquito_block_datacollector (
          user_id, username, password, email, phone_number,
          district_id, district_name, block_id, block_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        user_id,
        username,
        hashedPassword,
        email,
        phone_number,
        district_id,
        district_name,
        block_id,
        block_name,
      ]
    );

    if (insertResult.affectedRows === 0) {
      return res.status(500).json({ message: "Failed to add collector" });
    }

    console.log("Ã¢Å“â€¦ New mosquito block collector added:", {
      user_id,
      username,
      block_name,
      district_name,
    });

    res.status(201).json({ message: "Block collector added", user_id });
  } catch (err) {
    console.error("Ã¢ÂÅ’ Collector add error:", err);
    res.status(500).json({ message: "Failed to add collector" });
  }
};


export const updateMosBlockCollector = async (req, res) => {
  try {
    const db = await dbPromise; // Ã¢Å“â€¦ MySQL connection
    const { user_id } = req.params;
    const {
      username,
      email,
      phone_number,
      district_id,
      district_name,
      block_id,
      block_name
    } = req.body;

    // Ã¢Å“â€¦ Input validations
    if (
      !username || !email || !phone_number ||
      !district_id || !district_name || !block_id || !block_name
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!/^\d{10}$/.test(phone_number)) {
      return res.status(400).json({ message: "Phone number must be 10 digits" });
    }

    // Ã¢Å“â€¦ Update query for MySQL
    const [result] = await db.execute(
      `UPDATE mosquito_block_datacollector
       SET username = ?, email = ?, phone_number = ?,
           district_id = ?, district_name = ?,
           block_id = ?, block_name = ?
       WHERE user_id = ?`,
      [
        username,
        email,
        phone_number,
        district_id,
        district_name,
        block_id,
        block_name,
        user_id
      ]
    );

    // Ã¢Å“â€¦ MySQL result check
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Block collector updated successfully" });
  } catch (err) {
    console.error("Ã¢ÂÅ’ Update error:", err);
    res.status(500).json({ message: "Failed to update collector" });
  }
};


export const getMosBlockCollectorById = async (req, res) => {
  const db = await dbPromise;
  try {
    const { user_id } = req.params;

    const [rows] = await dbPromise.execute(
      `
      SELECT user_id, username, email, phone_number,
             district_id, district_name,
             block_id, block_name
      FROM mosquito_block_datacollector
      WHERE user_id = ?
      `,
      [user_id]
    );

    const user = rows[0]; // Get first row if exists

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("Get by ID error:", err);
    res.status(500).json({ message: "Failed to fetch collector" });
  }
};

export const deleteMosBlockCollector = async (req, res) => {
  const db = await dbPromise;
  try {
    const { user_id } = req.params;

    const deleteStmt = await db.execute(`
      DELETE FROM mosquito_block_datacollector
      WHERE user_id = ?
    `, [user_id]);



    if (deleteStmt.affectedRows === 0) {
      return res.status(404).json({ message: "User not found or already deleted" });
    }

    res.status(200).json({ message: "Block collector deleted successfully" });
  } catch (err) {
    console.error("ÃƒÂ¢ Ã…â€™ Delete error:", err);
    res.status(500).json({ message: "Failed to delete collector" });
  }
};

export const getMosBlockCollectors = async (req, res) => {
  try {
    const db = await dbPromise; // Ã¢Å“â€¦ Get DB connection
    const [rows] = await db.execute(`SELECT * FROM mosquito_block_datacollector`);
    res.status(200).json(rows);
  } catch (err) {
    console.error("ÃƒÂ¢ Ã…â€™ Collector fetch error:", err);
    res.status(500).json({ message: "Failed to fetch collectors" });
  }
};

export const addChlorinationHub = async (req, res) => {
  const db = await dbPromise;
  const { hub_name, latitude, longitude } = req.body;

  if (!hub_name || latitude == null || longitude == null) {
    return res.status(400).json({ message: 'Missing hub_name, latitude or longitude' });
  }
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return res.status(400).json({ message: 'Latitude/longitude must be numbers' });
  }

  try {
    const hub_id = await generateHubId();
    console.log({ hub_id, hub_name, latitude, longitude });

    await db.execute(
      "INSERT INTO chlorination_hubs (hub_id, hub_name, latitude, longitude) VALUES (?, ?, ?, ?)",
      [hub_id, hub_name, latitude, longitude]
    );

    return res.status(201).json({ message: 'Hub created successfully', hub_id });
  } catch (err) {
    console.error('addChlorinationHub error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message, stack: err.stack });
  }
};

async function generateDistrictCode(districtName, hub_id) {
  const db = await dbPromise; // Ã¢Å“â€¦ Get DB connection
  const prefix = districtName.trim().substring(0, 5).toUpperCase();

  const [rows] = await db.execute(
    'SELECT COUNT(*) AS total FROM chlorination_districts WHERE hub_id = ?',
    [hub_id]
  );

  const number = rows[0].total + 1;
  return `${prefix}${String(number).padStart(3, '0')}`;
}
export const addChlorinationDistrict = async (req, res) => {
  const db = await dbPromise;
  const { district_name, hub_id } = req.body;

  if (!district_name || !hub_id) {
    return res.status(400).json({ message: 'Missing district data' });
  }

  try {
    // Ã¢Å“â€¦ Await the async function
    const district_code = await generateDistrictCode(district_name, hub_id);

    const [result] = await db.execute(
      `INSERT INTO chlorination_districts (district_code, district_name, hub_id)
       VALUES (?, ?, ?)`,
      [district_code, district_name, hub_id]
    );

    return res.status(201).json({
      message: 'District added successfully',
      district_code,
      insertId: result.insertId
    });

  } catch (err) {
    console.error('addChlorinationDistrict error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};


export const getAllHubsWithDistricts = async (req, res) => {
  try {
    const db = await dbPromise; // Ã¢Å“â€¦ Get DB connection

    // Destructure to get only data rows from MySQL2 responses
    const [hubRows] = await db.execute(`SELECT * FROM chlorination_hubs`);
    const [districtRows] = await db.execute(`SELECT * FROM chlorination_districts`);

    // Attach related districts to each hub
    const result = hubRows.map(hub => ({
      ...hub,
      districts: districtRows.filter(d => d.hub_id === hub.hub_id)
    }));

    // Send structured response exactly like your frontend expects
    return res.json(result);

  } catch (err) {
    console.error('getAllHubsWithDistricts error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};


export const createInspectionTester = async (req, res) => {
  const db = await dbPromise; // Ã¢Å“â€¦ Get DB connection
  const { tester_name, hub_id } = req.body;

  if (!tester_name || !hub_id) {
    return res.status(400).json({ message: 'Missing tester_name or hub_id' });
  }

  try {
    const count = await db.execute(`
      SELECT COUNT(*) AS total FROM chlorination_inspection_testers WHERE hub_id = ?
    `, [hub_id]);

    if (count.total >= 4) {
      return res.status(400).json({ message: 'Maximum 4 testers allowed per hub' });
    }

    const tester_id = uuidv4();
    await db.execute(`
      INSERT INTO chlorination_inspection_testers (tester_id, tester_name, hub_id)
      VALUES (?, ?, ?)`, [tester_id, tester_name, hub_id]
    );

    return res.status(201).json({ message: 'Inspection tester created', tester_id });
  } catch (err) {
    console.error('createInspectionTester error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const addChlorinationUser = async (req, res) => {

  const {
    username,
    email,
    password,
    hub_id,
    phone_number,
    address,
    status,
    role = 'hub_officer',
    module = 'chlorination'
  } = req.body;

  if (!username || !email || !password || !hub_id) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const db = await dbPromise;
    // 1. Check if hub exists
    const [hubRows] = await db.execute(
      `SELECT hub_name FROM chlorination_hubs WHERE hub_id = ?`,
      [hub_id]
    );

    if (hubRows.length === 0) {
      return res.status(400).json({ message: 'Invalid hub_id. No such hub exists.' });
    }
    const hubName = hubRows[0].hub_name;

    // 2. Count existing users
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM chlorination_hub_users WHERE hub_id = ?`,
      [hub_id]
    );
    const userNumber = String(countRows[0].total + 1).padStart(3, '0');

    // 3. Create user_id and hash password
    const user_id = `${hub_id}USR${userNumber}`;
    const hashedPassword = bcrypt.hashSync(password, 10);
    // ensures connection is ready
    // 4. Insert new user
    // Ã¢Å“â€¦ Get DB connection
    await db.execute(
      `INSERT INTO chlorination_hub_users
       (user_id, username, email, hashedPassword, hub_id, hub_name, phone_number, address, status, role, module)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, username, email, hashedPassword, hub_id, hubName, phone_number, address, status, role, module]
    );

    return res.status(201).json({ message: 'User added successfully', user_id });
  } catch (err) {
    console.error('addChlorinationUser error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};


export const getChlorinationUsers = async (req, res) => {
  try {
    const db = await dbPromise; // ensures connection is ready
    const [rows] = await db.execute(`SELECT * FROM chlorination_hub_users`);
    res.json(rows);
  } catch (err) {
    console.error("getChlorinationUsers error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
/* const [rows] = await db.execute('SELECT district_code, district_name FROM mosquito_district_master');*/


export const addChlorinationDataCollector = async (req, res) => {
  const { username, email, password, hub_id, phone_number, role = 'RWAL_hi_user', module = 'chlorination' } = req.body;

  if (!username || !email || !password || !hub_id) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Ã¢Å“â€¦ Get DB connection
    const db = await dbPromise;

    // Ã¢Å“â€¦ Get hub name
    const [hubRows] = await db.execute(
      `SELECT hub_name FROM chlorination_hubs WHERE hub_id = ?`,
      [hub_id]
    );
    const hub = hubRows[0];
    if (!hub) {
      return res.status(400).json({ message: "Invalid hub_id" });
    }

    const hubPrefix = hub.hub_name.substring(0, 3).toUpperCase();
    let sequence = 1;
    let user_id;

    // Ã¢Å“â€¦ Loop to generate unique user_id
    while (true) {
      const paddedSeq = String(sequence).padStart(3, "0");
      user_id = `${hub_id}${hubPrefix}USE${paddedSeq}`;

      const [existingRows] = await db.execute(
        `SELECT 1 FROM chlorination_data_collectors WHERE user_id = ?`,
        [user_id]
      );

      if (existingRows.length === 0) break; // Ã¢Å“â€¦ no conflict
      sequence += 1;
    }

    // Ã¢Å“â€¦ Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Ã¢Å“â€¦ Insert collector
    await db.execute(
      `INSERT INTO chlorination_data_collectors
        (user_id, username, email, hashedPassword, hub_id, hub_name, phone_number, role, module)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        username,
        email,
        hashedPassword,
        hub_id,
        hub.hub_name,
        phone_number || null,
        role,
        module
      ]
    );

    return res.status(201).json({
      message: "Data collector added successfully",
      user_id,
    });
  } catch (err) {
    console.error("addChlorinationDataCollector error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
export const getChlorinationDataCollectors = async (req, res) => {
  try {
    const db = await dbPromise; // Ã¢Å“â€¦ Get DB connection
    const [stmt] = await db.execute(`SELECT * FROM chlorination_data_collectors`);
    res.json(stmt);
  } catch (err) {
    console.error("getChlorinationDataCollectors error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
export const getChlorinationDataCollection = async (req, res) => {
  try {
    let { fromDate, toDate } = req.query;
    const db = await dbPromise;

    if (!fromDate && !toDate) {
      const today = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      fromDate = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
      toDate = fromDate;
    }

    let query = `SELECT * FROM chlorine_data_collection WHERE 1=1`;
    const params = [];

    if (fromDate && toDate) {
      query += ` AND DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y')`;
      params.push(fromDate, toDate);
    } else if (fromDate) {
      query += ` AND DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) >= STR_TO_DATE(?, '%d/%m/%Y')`;
      params.push(fromDate);
    } else if (toDate) {
      query += ` AND DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) <= STR_TO_DATE(?, '%d/%m/%Y')`;
      params.push(toDate);
    }

    const [stmt] = await db.execute(query, params);
    const enhancedResults = stmt.map(entry => {
      const samplingPoint = (entry.samplingPoint || '').toUpperCase();
      const ppm = parseFloat(entry.ppm);
      const actual = parseFloat(entry.actualPPM);

      let color_ppm = "inherit";
      let color_actual = "inherit";

      if (samplingPoint === 'TAIL') {
        color_ppm = ppm === 0 ? "red" : ppm < 0.2 ? "orange" : "green";
        color_actual = actual === 0 ? "red" : actual < 0.2 ? "orange" : "green";
      } else if (samplingPoint === 'MID') {
        color_ppm = ppm === 0 ? "red" : ppm < 0.2 ? "orange" : "green";
        color_actual = actual === 0 ? "red" : actual < 0.2 ? "orange" : "green";
      }
      else if (samplingPoint === 'OHT') {
        color_ppm = ppm === 0 ? "red" : ppm < 1 ? "orange" : "green";
        color_actual = actual === 0 ? "red" : actual < 1 ? "orange" : "green";
      }


      return {
        ...entry,
        color_ppm,
        color_actual
      };
    });

    res.json(enhancedResults);
  } catch (err) {
    console.error("Error fetching chlorination data:", err);
    res.status(500).json({ error: "Database error" });
  }
};

export const getChlorineDataByHubId = async (req, res) => {
  const { hub_id } = req.query;

  if (!hub_id) {
    return res.status(400).json({ message: "Hub ID is required" });
  }

  try {
    const db = await dbPromise; // Ã¢Å“â€¦ Get DB connection
    const [rows] = await db.execute(
      `SELECT * FROM chlorine_data_collection WHERE UPPER(hub_id) = UPPER(?)`,
      [hub_id]
    );

    return res.status(200).json({ status: "success", data: rows });
  } catch (err) {
    console.error("getChlorineDataByHubId error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

async function generateMosDistrictCode(district_name) {
  const prefix = district_name.trim().substring(0, 4).toUpperCase();
  const codePrefix = `MOS${prefix}`;

  const db = await dbPromise;

  const [rows] = await db.execute(`SELECT COUNT(*) AS total FROM mosquito_district_master`);
  console.log('Rows from COUNT query:', rows);

  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  console.log('Extracted total count:', total);

  const nextNumber = String(total + 1).padStart(3, '0');
  return `${codePrefix}${nextNumber}`;
}


export const addMosquitoDistrict = async (req, res) => {
  const { district_name } = req.body;

  if (!district_name) {
    return res.status(400).json({ message: 'District name is required' });
  }

  try {
    // Await in case generateMosDistrictCode is async
    const district_code = await generateMosDistrictCode(district_name);

    const db = await dbPromise;

    await db.execute(
      `INSERT INTO mosquito_district_master (district_code, district_name) VALUES (?, ?)`,
      [district_code, district_name]
    );

    return res.status(201).json({ message: 'District added', district_code });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'District already exists' });
    }
    console.error('addMosquitoDistrict error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};



export const getMosquitoDistricts = async (req, res) => {
  try {
    const db = await dbPromise;
    const [rows] = await db.execute('SELECT district_code, district_name FROM mosquito_district_master');

    // Ã¢Å“â€¦ Return just the array - no wrapping
    return res.json(rows);
  } catch (err) {
    console.error('getMosquitoDistricts error:', err);
    return res.json([]); // Empty array on error
  }
};


// Updated generateHUDCode function
export async function generateHUDCode(hud_name) {
  const prefix = hud_name.trim().substring(0, 4).toUpperCase(); // First 4 letters
  const codePrefix = `HUD${prefix}`;

  const db = await dbPromise; // Ã¢Å“â€¦ Await the DB connection

  // Ã¢Å“â€¦ Only take rows, ignore MySQL2 metadata to avoid Buffers
  const [rows] = await db.execute(`SELECT COUNT(*) AS total FROM hud_master`);
  const total = rows[0].total;

  const nextNumber = String(total + 1).padStart(3, '0');
  return `${codePrefix}${nextNumber}`;
}

export const addHUD = async (req, res) => {
  const { hud_name, hub_id, hub_name } = req.body;

  // Log incoming request body
  console.log('[addHUD] Incoming data from frontend:', { hud_name, hub_id, hub_name });

  // Validate inputs


  try {
    // Generate HUD ID if not provided
    const hud_id = await generateHUDCode(hud_name);
    console.log('[addHUD] Generated HUD ID:', hud_id);

    // Insert into MySQL
    console.log('[addHUD] Inserting into hud_master table...');
    await db.execute(
      `INSERT INTO hud_master (hud_id, hud_name, hub_id, Hub_name)
       VALUES (?, ?, ?, ?)`,
      [hud_id, hud_name, hub_id, hub_name]
    );

    console.log('[addHUD] Insert successful:', { hud_id, hud_name, hub_id, hub_name });

    // Return success response
    return res.status(201).json({ message: 'HUD added', hud_id });

  } catch (err) {
    // MySQL duplicate entry
    if (err.code === 'ER_DUP_ENTRY') {
      console.warn('[addHUD] Duplicate entry detected for HUD:', hud_name);
      return res.status(409).json({ message: 'HUD already exists' });
    }

    // Unexpected error
    console.error('[addHUD] Error inserting HUD:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getHUDs = async (req, res) => {
  try {
    const { hub_id } = req.query;
    const db = await dbPromise; // Ã¢Å“â€¦ Get MySQL2 connection/pool (Promise API)

    let rows;
    if (hub_id) {
      // Ã¢Å“â€¦ Filter HUDs by hub_id
      [rows] = await db.execute(
        `SELECT hud_id, hud_name, hub_id, hub_name
         FROM hud_master
         WHERE hub_id = ?`,
        [hub_id]
      );
    } else {
      // Ã¢Å“â€¦ Get all HUDs
      [rows] = await db.execute(
        `SELECT hud_id, hud_name, hub_id, hub_name
         FROM hud_master`
      );
    }

    // Ã¢Å“â€¦ Wrap in object with `rows` key so frontend can use response.data.rows
    return res.json(rows);
  } catch (err) {
    console.error("getHUDs error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// PUT /dashboard/hud/:hud_id
export const updateHUD = async (req, res) => {
  const { hud_id } = req.params;
  const { hud_name } = req.body;

  if (!hud_name) {
    return res.status(400).json({ message: 'HUD name is required' });
  }

  try {
    const db = await dbPromise;
    const [stmt] = await db.execute("UPDATE hud_master SET hud_name = ? WHERE hud_id = ?", [hud_name, hud_id]);


    if (stmt.affectedRows === 0) {
      return res.status(404).json({ message: "HUD not found" });
    }

    return res.json({ message: "HUD updated" });
  } catch (err) {
    console.error("updateHUD error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// DELETE /dashboard/hud/:hud_id
export const deleteHUD = async (req, res) => {
  const { hud_id } = req.params;

  try {
    const db = await dbPromise;
    const [stmt] = await db.execute("DELETE FROM hud_master WHERE hud_id = ?", [hud_id]);


    if (stmt.affectedRows === 0) {
      return res.status(404).json({ message: "HUD not found" });
    }

    return res.json({ message: "HUD deleted" });
  } catch (err) {
    console.error("deleteHUD error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

async function generateBlockId(blockName) {
  const namePrefix = blockName
    .replace(/\s+/g, "")
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, "X");

  const db = await dbPromise;

  const [rows] = await db.query(
    `
    SELECT block_id
    FROM hud_block_master
    WHERE block_id LIKE CONCAT('HUDBLK', ?, '%')
    ORDER BY CAST(SUBSTRING(block_id, -3) AS UNSIGNED) DESC
    LIMIT 1
    `,
    [namePrefix]
  );

  let nextNumber = 1;

  if (rows.length > 0) {
    const lastNumber = parseInt(rows[0].block_id.slice(-3), 10);
    nextNumber = lastNumber + 1;
  }

  return `HUDBLK${namePrefix}${String(nextNumber).padStart(3, "0")}`;
}

// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Add block
export const addHudBlock = async (req, res) => {
  try {
    const { block_name, hud_id, hud_name } = req.body;

    if (!block_name || !hud_id || !hud_name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Await the async block ID generator
    const block_id = await generateBlockId(block_name);

    const db = await dbPromise;
    await db.execute(
      `
      INSERT INTO hud_block_master (block_id, block_name, hud_id, hud_name)
      VALUES (?, ?, ?, ?)
      `,
      [block_id, block_name, hud_id, hud_name]
    );

    res.status(201).json({ message: "HUD block added successfully", block_id });
  } catch (err) {
    console.error("Error adding HUD block:", err);
    res.status(500).json({ message: "Failed to add HUD block" });
  }
};

// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Get all blocks


export const getHudBlocks = async (req, res) => {
  try {
    const db = await dbPromise;
    const [rows] = await db.execute(
      `SELECT * FROM hud_block_master ORDER BY hud_name, block_name`
    );

    // Ã°Å¸â€Â¹ Convert Buffers to strings
    const cleanRows = rows.map(row => {
      Object.keys(row).forEach(key => {
        if (Buffer.isBuffer(row[key])) {
          row[key] = row[key].toString();
        }
      });
      return row;
    });

    res.json(cleanRows);
  } catch (err) {
    console.error("Error fetching HUD blocks:", err);
    res.status(500).send("Failed to fetch HUD blocks");
  }
};


// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Update block
export const updateHudBlock = async (req, res) => {
  try {
    const { block_id } = req.params;
    const { block_name, hud_id, hud_name } = req.body;

    if (!block_id || !block_name || !hud_id || !hud_name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const db = await dbPromise;
    const [result] = await db.execute(
      `UPDATE hud_block_master
       SET block_name = ?, hud_id = ?, hud_name = ?
       WHERE block_id = ?`,
      [block_name, hud_id, hud_name, block_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Block not found" });
    }

    res.json({ message: "Block updated successfully" });
  } catch (err) {
    console.error("Error updating HUD block:", err);
    res.status(500).json({ message: "Failed to update block" });
  }
};

// Ã¢Å“â€¦ Delete block (MySQL version)
export const deleteHudBlock = async (req, res) => {
  try {
    const { block_id } = req.params;

    const db = await dbPromise;
    const [result] = await db.execute(
      `DELETE FROM hud_block_master WHERE block_id = ?`,
      [block_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Block not found" });
    }

    res.json({ message: "Block deleted successfully" });
  } catch (err) {
    console.error("Error deleting HUD block:", err);
    res.status(500).json({ message: "Failed to delete block" });
  }
};


async function generateVillageCode(village_name) {
  const prefix = village_name.trim().toUpperCase().slice(0, 4); // First 4 letters
  const codePrefix = `VILL${prefix}`;

  const db = await dbPromise;

  // Ã¢Å“â€¦ MySQL version of query
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM hud_village_master
     WHERE village_id LIKE ?`,
    [`${codePrefix}%`]
  );

  const total = rows[0].total || 0;
  const nextNumber = String(total + 1).padStart(3, '0');
  return `${codePrefix}${nextNumber}`;
}

export const addVillage = async (req, res) => {
  const { hud_id, hud_name, block_id, block_name, phc_id, phc_name, village_name } = req.body;

  if (!hud_id || !hud_name || !block_id || !block_name || !phc_id || !phc_name || !village_name?.trim()) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const village_id = await generateVillageCode(village_name);
    const db = await dbPromise;

    await db.execute(`
      INSERT INTO hud_village_master (
        hud_id, hud_name, block_id, block_name, phc_id, phc_name, village_id, village_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [hud_id, hud_name, block_id, block_name, phc_id, phc_name, village_id, village_name]);

    return res.status(201).json({ message: 'Village added', village_id });
  } catch (err) {
    console.error('addVillage error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Update village
export const updateVillage = async (req, res) => {
  const { village_id } = req.params;
  const { village_name, phc_id, phc_name, block_id, block_name } = req.body;

  if (!village_name?.trim() || !phc_id || !phc_name) {
    return res.status(400).json({ message: 'Fields are missing' });
  }

  try {
    const db = await dbPromise;  // <-- ADD THIS LINE

    const [existing] = await db.execute(
      `SELECT * FROM hud_village_master WHERE village_id = ?`,
      [village_id]
    );

    if (!existing.length)
      return res.status(404).json({ message: 'Village not found' });

    await db.execute(
      `UPDATE hud_village_master
      SET village_name = ?, phc_id = ?, phc_name = ?, block_id = ?, block_name = ?
      WHERE village_id = ?`,
      [village_name, phc_id, phc_name, block_id, block_name, village_id]
    );

    return res.json({ message: 'Village updated successfully' });

  } catch (err) {
    console.error('updateVillage error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Delete village
export const deleteVillage = async (req, res) => {
  const { village_id } = req.params;

  try {
    const [existing] = await db.execute(`SELECT * FROM hud_village_master WHERE village_id = ?`, [village_id]);
    if (!existing.length) {
      return res.status(404).json({ message: 'Village not found' });
    }

    await db.execute(`DELETE FROM hud_village_master WHERE village_id = ?`, [village_id]);

    return res.json({ message: 'Village deleted successfully' });
  } catch (err) {
    console.error('deleteVillage error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getVillages = async (req, res) => {
  try {
    const db = await dbPromise;
    const [villages] = await db.execute(`SELECT * FROM hud_village_master`);
    return res.json(villages);
  } catch (err) {
    console.error('getVillages error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// HUD HI
export const addVillageUser = async (req, res) => {
  const {
    username,
    email,
    password,
    block_id,
    phone_number,
    module = "chlorination",
    role = "hi_user",
    hud_id,
    hud_name,
  } = req.body;

  if (!username || !email || !password || !block_id || !hud_id || !hud_name) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const db = await dbPromise;

    // Trim IDs
    const cleanHudId = hud_id.replace(/\s+/g, "");
    const cleanBlockId = block_id.replace(/\s+/g, "");

    // 1Ã¯Â¸ÂÃ¢Æ’Â£ Fetch block name
    const [blockRows] = await db.execute(
      `SELECT block_name FROM hud_block_master WHERE block_id = ?`,
      [cleanBlockId]
    );

    if (blockRows.length === 0) {
      return res.status(400).json({ message: "Invalid block_id" });
    }

    const blockName = blockRows[0].block_name;
    const blockPrefix = blockName.substring(0, 3).toUpperCase();

    // 2Ã¯Â¸ÂÃ¢Æ’Â£ Get last user for HUD + BLOCK
    const [lastUserRows] = await db.execute(
      `SELECT user_id FROM village_users
       WHERE hud_id = ? AND block_id = ?
       ORDER BY user_id DESC LIMIT 1`,
      [cleanHudId, cleanBlockId]
    );

    // 3Ã¯Â¸ÂÃ¢Æ’Â£ Generate sequence
    let sequence = "001";

    if (lastUserRows.length > 0) {
      const lastUserId = lastUserRows[0].user_id;
      const match = lastUserId.match(/(\d{3})$/);

      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        sequence = String(nextNum).padStart(3, "0");
      }
    }

    // 4Ã¯Â¸ÂÃ¢Æ’Â£ Construct User ID
    let user_id = `${cleanHudId}${cleanBlockId}${blockPrefix}${sequence}${blockPrefix}VIL${sequence}`;

    // 5Ã¯Â¸ÂÃ¢Æ’Â£ Ensure uniqueness
    const [existsRows] = await db.execute(
      `SELECT 1 FROM village_users WHERE user_id = ?`,
      [user_id]
    );

    if (existsRows.length > 0) {
      user_id = `${cleanHudId}${cleanBlockId}${blockPrefix}${Date.now()}`; // fallback
    }

    // 6Ã¯Â¸ÂÃ¢Æ’Â£ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 7Ã¯Â¸ÂÃ¢Æ’Â£ Insert user
    await db.execute(
      `INSERT INTO village_users
      (user_id, username, email, hashedPassword,
       block_id, block_name, phone_number,
       module, role, hud_id, hud_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        username,
        email,
        hashedPassword,
        cleanBlockId,
        blockName,
        phone_number,
        module,
        role,
        cleanHudId,
        hud_name
      ]
    );

    return res.status(201).json({
      message: "Village officer added successfully",
      user_id,
    });
  } catch (err) {
    console.error("addVillageUser error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getVillageUsers = async (req, res) => {
  const { block_id } = req.query;

  try {
    const db = await dbPromise;
    let rows;

    if (block_id) {
      const [result] = await db.execute(
        `SELECT * FROM village_users WHERE block_id = ?`,
        [block_id]
      );
      rows = result;
    } else {
      const [result] = await db.execute(`SELECT * FROM village_users`);
      rows = result;
    }

    return res.json(rows);
  } catch (err) {
    console.error("getVillageUsers error:", err.message, err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

async function generateUserId(hudId) {
  const prefix = `${hudId}USR`;
  const db = await dbPromise;
  const likePattern = `${prefix}%`;

  const [rows] = await db.execute(
    `
    SELECT user_id FROM hud_master_users
    WHERE user_id LIKE ?
    ORDER BY user_id DESC
    LIMIT 1
    `,
    [likePattern]
  );

  let nextNumber = 1;
  if (rows.length > 0) {
    const lastUserId = rows[0].user_id;
    const match = lastUserId.match(/(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
}



export const updateVillageUser = async (req, res) => {
  const { user_id } = req.params;
  const {
    username,
    email,
    phone_number,
    block_id,
    password,
    module = "chlorination",
    role = "hi_user",
    hud_id,
    hud_name,
  } = req.body;

  if (!user_id || !username || !email || !block_id || !hud_id || !hud_name) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const db = await dbPromise;

    // Fetch block info
    const [blockRows] = await db.execute(
      `SELECT block_name FROM hud_block_master WHERE block_id = ?`,
      [block_id]
    );

    if (blockRows.length === 0) {
      return res.status(400).json({ message: "Invalid block ID" });
    }

    const blockName = blockRows[0].block_name;

    // Build update query dynamically
    let updateQuery = `
      UPDATE village_users SET
        username = ?,
        email = ?,
        phone_number = ?,
        block_id = ?,
        block_name = ?,
        module = ?,
        role = ?,
        hud_id = ?,
        hud_name = ?`;
    const updateValues = [
      username,
      email,
      phone_number,
      block_id,
      blockName,
      module,
      role,
      hud_id,
      hud_name,
    ];

    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += `, hashedPassword = ?`;
      updateValues.push(hashedPassword);
    }

    updateQuery += ` WHERE user_id = ?`;
    updateValues.push(user_id);

    const [result] = await db.execute(updateQuery, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Village officer not found" });
    }

    return res.status(200).json({ message: "Village officer updated successfully" });

  } catch (err) {
    console.error("updateVillageUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteVillageUser = async (req, res) => {
  const { user_id } = req.params;

  try {
    const db = await dbPromise;

    const [result] = await db.query(
      "DELETE FROM village_users WHERE user_id = ?",
      [user_id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Village officer not found" });
    }

    return res.status(200).json({
      message: "Village officer deleted successfully",
    });
  } catch (err) {
    console.error("deleteVillageUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Add HUD User

export const addHudMasterUser = async (req, res) => {
  try {
    const db = await dbPromise;
    const {
      username, password, email, phone_number,
      hud_id, hud_name,
    } = req.body;

    if (!username || !password || !email || !phone_number || !hud_id || !hud_name) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Hash the password securely
    const hashedPassword = await bcrypt.hash(password, 10); // 10 salt rounds

    const user_id = await generateUserId(hud_id);
    const role = 'DHO';
    const module = 'chlorination';
    const status = 'Active';

    // Make sure this is the resolved MySQL connection

    // MySQL insert with parameterized query Ã¢â‚¬â€ no prepare/run like sqlite
    await db.execute(
      `INSERT INTO hud_master_users (
        user_id, username, password, email, phone_number,
        hud_id, hud_name,
        role, module, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, username, hashedPassword, email, phone_number, hud_id, hud_name, role, module, status]
    );

    res.status(201).json({ message: 'HUD user added successfully', user_id });
  } catch (err) {
    console.error('Error adding HUD user:', err);
    res.status(500).json({ message: 'Failed to add HUD user' });
  }
};


// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Get all HUD users
export const getHudMasterUsers = async (req, res) => {
  try {
    const db = await dbPromise;
    const [stmt] = await db.execute(`SELECT * FROM hud_master_users ORDER BY hud_name, username`);

    res.json(stmt);
  } catch (err) {
    console.error('Error fetching HUD users:', err);
    res.status(500).send('Failed to fetch HUD users');
  }
};

// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Update HUD User
export const updateHudMasterUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    const {
      username,
      password,
      email,
      phone_number,
      hud_id,
      hud_name,
      role = "DHO",
      module = "mosquito",
      status = "Active",
    } = req.body;

    if (
      !user_id ||
      !username ||
      !password ||
      !email ||
      !phone_number ||
      !hud_id ||
      !hud_name
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const db = await dbPromise;

    const [stmt] = await db.execute(
      `UPDATE hud_master_users
       SET username = ?,
           password = ?,
           email = ?,
           phone_number = ?,
           hud_id = ?,
           hud_name = ?,
           role = ?,
           module = ?,
           status = ?
       WHERE user_id = ?`,
      [
        username,
        hashedPassword,
        email,
        phone_number,
        hud_id,
        hud_name,
        role,
        module,
        status,
        user_id,
      ]
    );

    if (stmt.affectedRows === 0) {
      return res.status(404).json({ message: "HUD user not found" });
    }

    res.json({ message: "HUD user updated successfully" });
  } catch (err) {
    console.error("Error updating HUD user:", err);
    res.status(500).json({ message: "Failed to update HUD user" });
  }
};


// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Delete HUD User
export const deleteHudMasterUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    const db = await dbPromise;
    const [stmt] = await db.execute(`DELETE FROM hud_master_users WHERE user_id = ?`, [user_id]);


    if (stmt.changes === 0) {
      return res.status(404).json({ message: 'HUD user not found' });
    }

    res.json({ message: 'HUD user deleted successfully' });
  } catch (err) {
    console.error('Error deleting HUD user:', err);
    res.status(500).json({ message: 'Failed to delete HUD user' });
  }
};
// add division default =chlorine; role =  default hi
// Convert timestamp properly
// Convert timestamp Ã¢â€ â€™ dd/mm/yyyy HH:mm:ss
function formatToDDMMYYYY(dateString) {
  // Expected input formats:
  //  "12/01/2025 20:10:00"
  //  "12-01-2025 20:10:00"
  //  "2025-01-12T20:10:00.000Z"
  //  "2025-01-12 20:10:00"

  let d, m, y, hh, min, ss;

  // If input is like DD/MM/YYYY
  if (dateString.includes("/")) {
    const [day, month, yearAndTime] = dateString.split("/");
    const [year, time] = yearAndTime.split(" ");
    [hh, min, ss] = time.split(":");

    d = day;
    m = month;
    y = year;
  }

  // If input is ISO or yyyy-mm-dd
  else if (dateString.includes("-")) {
    const [datePart, timePart] = dateString.split(" ");
    const [year, month, day] = datePart.split("-");
    [hh, min, ss] = timePart.split(":");

    d = day;
    m = month;
    y = year;
  }

  else {
    return null;
  }

  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y} ${hh}:${min}:${ss}`;
}


export const addHudChlorineDataEntry = async (req, res) => {
  console.log("Incoming HUD chlorine data:", req.body);

  try {
    const db = await dbPromise;

    const {
      ppm,
      actualPPM,
      base64Image,
      latitude,
      longitude,
      timestamp,
      samplingPoint,
      user_id,
      username,
      block_id,
      block_name,
      hud_id,
      hud_name,
      address
    } = req.body;

    // Validate required fields
    if (
      !ppm || !base64Image || !latitude || !longitude || !timestamp ||
      !samplingPoint || !block_id || !block_name || !hud_id ||
      !hud_name || !user_id || !username || !address
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Normalize sampling point
    const normalizedSamplingPoint = samplingPoint.trim().toUpperCase();
    if (!['TAIL', 'MID', 'OHT', 'GLR', 'SUMP'].includes(normalizedSamplingPoint)) {
      return res.status(400).json({
        message: 'Invalid samplingPoint. Use TAIL, MID, OHT, GLR, or SUMP.'
      });
    }

    const ppmValue = String(ppm).replace(/\s+/g, '');

    const actual = actualPPM
      ? String(actualPPM).replace(/\s+/g, '')
      : null;

    // ====================================================
    //  UPDATED FUNCTION PART ONLY (LEGACY SAFE)
    // Format: DD/MM/YYYY,HH:mm:ss
    // ====================================================

    const formatToDDMMYYYY = (ts) => {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return null;

      const pad = (n) => String(n).padStart(2, "0");

      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()},` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const mysqlTimestamp = formatToDDMMYYYY(String(timestamp));
    if (!mysqlTimestamp) {
      return res.status(400).json({ message: "Invalid timestamp format" });
    }

    // ====================================================
    //  FIX BASE64 IMAGE (REMOVE PREFIX IF PRESENT)
    // ====================================================
    const cleanedBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "").trim();
    const buffer = Buffer.from(cleanedBase64, "base64");

    // ====================================================
    // IMAGE COMPRESSION & CORRUPTION FIX USING SHARP
    // ====================================================
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    const filename = `chlorine_image_${Date.now()}.jpg`;
    const fullPath = path.join(uploadsDir, filename);
    const storedPath = `/uploads/${filename}`;

    let quality = 80;
    let compressedBuffer;

    while (quality > 10) {
      try {
        compressedBuffer = await sharp(buffer, { failOnError: false })
          .rotate()
          .toFormat("jpeg", { quality })
          .toBuffer();
      } catch (err) {
        console.error("Sharp conversion failed:", err);
        return res.status(400).json({
          message: "Invalid or unsupported image format",
          error: err.message,
        });
      }

      if (compressedBuffer.length <= 150 * 1024) break;
      quality -= 10;
    }

    fs.writeFileSync(fullPath, compressedBuffer);

    // ====================================================
    // ðŸ—‘ AUTO DELETE IMAGE AFTER 1 WEEK
    // ====================================================
    setTimeout(() => {
      if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, () => {
          console.log(`ðŸ—‘ Auto-deleted old HUD chlorine image: ${filename}`);
        });
      }
    }, 7 * 24 * 60 * 60 * 1000);

    // ====================================================
    //  INSERT INTO DATABASE
    // ====================================================
    const query = `
      INSERT INTO chlorine_hud_data_collection_new
      (ppm, actualPPM, samplingPoint, image_path, latitude, longitude, timestamp,
       block_id, block_name, hud_id, hud_name, user_id, username, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      ppmValue,
      actual,
      normalizedSamplingPoint,
      storedPath,
      latitude,
      longitude,
      mysqlTimestamp,
      block_id,
      block_name,
      hud_id,
      hud_name,
      user_id,
      username,
      address
    ];

    await db.execute(query, values);

    return res.status(201).json({
      message: "HUD chlorine data stored successfully",
      compressedImageSize: compressedBuffer.length
    });

  } catch (err) {
    console.error("addHudChlorineDataEntry error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};


export const getHudChlorineData = async (req, res) => {
  try {
    const db = await dbPromise;

    const { block_id, samplingPoint, date, address, fromDate, toDate } = req.query;

    let activeFromDate = fromDate;
    let activeToDate = toDate;

    if (!activeFromDate && !activeToDate) {
      const today = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      activeFromDate = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
      activeToDate = activeFromDate;
    }

    let filterConditions = "";
    const params = [];

    if (activeFromDate && activeToDate) {
      filterConditions += ` AND DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y')`;
      params.push(activeFromDate, activeToDate);
    } else if (activeFromDate) {
      filterConditions += ` AND DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) >= STR_TO_DATE(?, '%d/%m/%Y')`;
      params.push(activeFromDate);
    } else if (activeToDate) {
      filterConditions += ` AND DATE(STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')) <= STR_TO_DATE(?, '%d/%m/%Y')`;
      params.push(activeToDate);
    }

    if (block_id) {
      filterConditions += ` AND block_id = ?`;
      params.push(block_id);
    }

    if (samplingPoint) {
      filterConditions += ` AND samplingPoint = ?`;
      params.push(samplingPoint.toUpperCase().trim());
    }

    if (date) {
      filterConditions += ` AND DATE(timestamp) = ?`;
      params.push(date);
    }

    if (address) {
      filterConditions += ` AND address = ?`;
      params.push(address);
    }

    let query = `
    SELECT * FROM (
      SELECT * FROM chlorine_hud_data_collection WHERE 1=1 ${filterConditions}
      UNION ALL
      SELECT * FROM chlorine_hud_data_collection_new WHERE 1=1 ${filterConditions}
    ) AS combined_data
    `;

    const [rows] = await db.execute(query, [...params, ...params]);

    const enhancedResults = rows.map(entry => {
      const point = (entry.samplingPoint || '').toUpperCase();
      const ppm = parseFloat(entry.ppm);
      const actual = parseFloat(entry.actualPPM);

      let color_ppm = "inherit";
      let color_actual = "inherit";

      if (point === 'TAIL' || point === 'MID') {
        color_ppm = ppm === 0 ? "red" : ppm < 0.2 ? "orange" : "green";
        color_actual = actual === 0 ? "red" : actual < 0.2 ? "orange" : "green";
      } else if (['OHT', 'GLR', 'SUMP'].includes(point)) {
        color_ppm = ppm === 0 ? "red" : ppm === 1 ? "green" : "orange";
        color_actual = actual === 0 ? "red" : actual === 1 ? "green" : "orange";
      }

      return {
        ...entry,
        color_ppm,
        color_actual
      };
    });

    return res.status(200).json(enhancedResults);

  } catch (err) {
    console.error('getHudChlorineData error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};


export const getOfficerCount = async (req, res) => {
  const { district } = req.query;

  if (!district) {
    return res.status(400).json({ message: 'District code is required' });
  }

  try {
    const db = await dbPromise;

    // Pass the parameter as an array
    const [result] = await db.execute(
      `
      SELECT COUNT(*) as count FROM district_officer_table
      WHERE district_code = ?
      `,
      [district] // <-- important: parameter in array
    );

    // result is an array with one object: { count: ... }
    // Access the count via result[0].count
    const officerCount = result[0]?.count || 0;

    return res.json({ count: officerCount });
  } catch (err) {
    console.error('Error getting officer count:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
;

export const addChlorineUserDataEntry = async (req, res) => {
  console.log("Incoming chlorine data:", req.body);

  try {
    const db = await dbPromise;

    const {
      ppm,
      actualPPM,
      base64Image,
      latitude,
      longitude,
      timestamp,
      samplingPoint,
      address,
      user_id,
      username,
      hub_id,
      hub_name,
    } = req.body;

    if (!ppm || !base64Image || !latitude || !longitude || !timestamp || !samplingPoint || !address) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const normalizedSamplingPoint = samplingPoint.trim().toUpperCase();
    if (!['TAIL', 'MID', 'OHT', 'GLR', 'SUMP'].includes(normalizedSamplingPoint)) {
      return res.status(400).json({ message: 'Invalid samplingPoint' });
    }

    const ppmValue = String(ppm).replace(/\s+/g, '');

    const actual = actualPPM
      ? String(actualPPM).replace(/\s+/g, '')
      : null;

    // -----------------------------
    // Convert timestamp to MySQL
    // -----------------------------
    const convertToMySQLDatetime = (ts) => {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return null;

      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    // Convert timestamp Ã¢â€ â€™ MySQL format
    const mysqlTimestamp = formatToDDMMYYYY(String(timestamp));
    if (!mysqlTimestamp) {
      return res.status(400).json({ message: "Invalid timestamp format" });
    }
    // =====================================================
    //  Ã°Å¸â€Â¥ PROPER BASE64 IMAGE HANDLING & CLEANING
    // =====================================================
    const cleanedBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "").trim();
    const buffer = Buffer.from(cleanedBase64, "base64");

    // =====================================================
    //  Ã°Å¸â€Â¥ FIX FOR EXPO IMAGES Ã¢â‚¬â€ ALWAYS CONVERT INPUT Ã¢â€ â€™ JPEG
    //     failOnError: false prevents corrupt marker crashes
    // =====================================================
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    const filename = `chlorine_image_${Date.now()}.jpg`;
    const fullPath = path.join(uploadsDir, filename);
    const storedPath = `/uploads/${filename}`;

    let quality = 80;
    let compressedBuffer;

    while (quality > 10) {
      try {
        compressedBuffer = await sharp(buffer, { failOnError: false })
          .rotate() // Fix orientation from mobile
          .toFormat("jpeg", { quality }) // Convert ANY input format Ã¢â€ â€™ JPEG
          .toBuffer();

      } catch (err) {
        console.error("Sharp error:", err.message);

        return res.status(400).json({
          message: "Invalid image input. Sharp could not process the file.",
          error: err.message
        });
      }

      if (compressedBuffer.length <= 150 * 1024) break; // Target 150KB
      quality -= 10;
    }

    fs.writeFileSync(fullPath, compressedBuffer);

    // =====================================================
    //  AUTO DELETE AFTER 1 WEEK
    // =====================================================
    setTimeout(() => {
      if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, () => console.log(`Ã°Å¸â€”â€˜ Deleted old chlorine image: ${filename}`));
      }
    }, 7 * 24 * 60 * 60 * 1000);

    // =====================================================
    //  INSERT DATA INTO MYSQL
    // =====================================================""

    const safeHubId = hub_id ?? "";
    const safeHubName = hub_name ?? "";

    const query = `
      INSERT INTO chlorine_data_collection
      (ppm, actualPPM, samplingPoint, image_path, latitude, longitude, timestamp,
       hub_id, hub_name, user_id, username, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.execute(query, [
      ppmValue,
      actual,
      normalizedSamplingPoint,
      storedPath,
      latitude,
      longitude,
      mysqlTimestamp,
      safeHubId,
      safeHubName,
      user_id,
      username,
      address
    ]);

    return res.status(201).json({
      message: "Data stored successfully",
      compressedImageSize: compressedBuffer.length
    });

  } catch (err) {
    console.error("Ã°Å¸â€™Â¥ addChlorineUserDataEntry error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};


export const getChlorinationHubUserById = async (req, res) => {
  const { user_id } = req.params;
  try {
    const [stmt] = await db.execute(`
      SELECT user_id, username, email, hub_id, hub_name, phone_number, address, status, role, module
      FROM chlorination_hub_users
      WHERE user_id = ?
    `);
    const user = stmt.get(user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
export const getChlorinationDistrictsByHub = async (req, res) => {
  const { hub_id } = req.query;

  if (!hub_id) {
    return res.status(400).json({ error: 'Missing hub_id in query' });
  }

  try {
    const db = await dbPromise;

    // MySQL2 returns an array: [rows, fields]
    const [rows] = await db.execute(
      `SELECT district_code, district_name
       FROM chlorination_districts
       WHERE hub_id = ?`,
      [hub_id] // Pass the parameter here
    );

    res.json(rows);
  } catch (err) {
    console.error("DB error fetching districts:", err);
    res.status(500).json({ error: "Database error" });
  }
};


export const getChlorineSummary = async (req, res) => {
  try {
    const db = await dbPromise;

    const getRange = (type) => {
      const now = new Date();
      let start, end;

      if (type === "current") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }

      if (type === "previous") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      }

      return { start, end };
    };

    const toDDMMYYYY = (d) => {
      const pad = (n) => String(n).padStart(2, "0");
      return (
        `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      );
    };

    const dateFormat = "%d/%m/%Y, %H:%i:%s";

    const queryCountInOldTable = async (start, end) => {
      const startStr = toDDMMYYYY(start);
      const endStr = toDDMMYYYY(end);
      const [rows] = await db.query(
        `SELECT COUNT(*) AS cnt
         FROM chlorine_hud_data_collection
         WHERE STR_TO_DATE(timestamp, ?)
         BETWEEN STR_TO_DATE(?, ?) AND STR_TO_DATE(?, ?)`,
        [dateFormat, startStr, dateFormat, endStr, dateFormat]
      );
      return rows[0].cnt;
    };

    const queryCountInNewTable = async (start, end) => {
      const startStr = toDDMMYYYY(start);
      const endStr = toDDMMYYYY(end);
      const [rows] = await db.query(
        `SELECT COUNT(*) AS cnt
         FROM chlorine_hud_data_collection_new
         WHERE STR_TO_DATE(timestamp, ?)
         BETWEEN STR_TO_DATE(?, ?) AND STR_TO_DATE(?, ?)`,
        [dateFormat, startStr, dateFormat, endStr, dateFormat]
      );
      return rows[0].cnt;
    };

    const queryActiveBlocks = async () => {
      const [rows] = await db.query(
        `SELECT DISTINCT block_name
         FROM chlorine_hud_data_collection_new`
      );
      return rows.map((r) => r.block_name);
    };

    // Date Ranges
    const currentRange = getRange("current");
    const previousRange = getRange("previous");

    // SQL for Cumulative RWAL status counting
    const rwalSql = `
      SELECT 
        CASE
          WHEN ppm IS NULL OR TRIM(ppm) = '' OR TRIM(ppm) = 'Nil' OR CAST(ppm AS DECIMAL(10,2)) = 0 OR (CAST(ppm AS DECIMAL(10,2)) > 0 AND CAST(ppm AS DECIMAL(10,2)) < 0.1) THEN 'Nil'
          ELSE
            CASE
              WHEN UPPER(TRIM(samplingPoint)) IN ('TAIL', 'MID') THEN
                CASE 
                  WHEN ROUND(CAST(ppm AS DECIMAL(10,2)), 1) < 0.2 THEN 'Inadequate'
                  ELSE 'Adequate'
                END
              WHEN UPPER(TRIM(samplingPoint)) IN ('OHT', 'GLR', 'SUMP') THEN
                CASE 
                  WHEN ROUND(CAST(ppm AS DECIMAL(10,2)), 1) < 1.0 THEN 'Inadequate'
                  ELSE 'Adequate'
                END
              ELSE 'Adequate'
            END
        END AS status,
        COUNT(*) AS count
      FROM (
        SELECT ppm, samplingPoint FROM chlorine_hud_data_collection
        UNION ALL
        SELECT ppm, samplingPoint FROM chlorine_hud_data_collection_new
      ) t
      GROUP BY status
    `;

    // SQL for Today's RWAL status counting (entire daily table)
    const todayRwalSql = `
      SELECT 
        CASE
          WHEN ppm IS NULL OR TRIM(ppm) = '' OR TRIM(ppm) = 'Nil' OR CAST(ppm AS DECIMAL(10,2)) = 0 OR (CAST(ppm AS DECIMAL(10,2)) > 0 AND CAST(ppm AS DECIMAL(10,2)) < 0.1) THEN 'Nil'
          ELSE
            CASE
              WHEN UPPER(TRIM(samplingPoint)) IN ('TAIL', 'MID') THEN
                CASE 
                  WHEN ROUND(CAST(ppm AS DECIMAL(10,2)), 1) < 0.2 THEN 'Inadequate'
                  ELSE 'Adequate'
                END
              WHEN UPPER(TRIM(samplingPoint)) IN ('OHT', 'GLR', 'SUMP') THEN
                CASE 
                  WHEN ROUND(CAST(ppm AS DECIMAL(10,2)), 1) < 1.0 THEN 'Inadequate'
                  ELSE 'Adequate'
                END
              ELSE 'Adequate'
            END
        END AS status,
        COUNT(*) AS count
      FROM chlorine_hud_data_collection_new
      GROUP BY status
    `;

    // Execute all base queries concurrently using Promise.all
    const [
      [[oldTotal]],
      [[newTotal]],
      currentOld,
      currentNew,
      previousCount,
      [[firstRow]],
      activeBlocks,
      [allBlocksRows],
      [rwalRows],
      [todayRwalRows]
    ] = await Promise.all([
      db.query(`SELECT COUNT(*) AS cnt FROM chlorine_hud_data_collection`),
      db.query(`SELECT COUNT(*) AS cnt FROM chlorine_hud_data_collection_new`),
      queryCountInOldTable(currentRange.start, currentRange.end),
      queryCountInNewTable(currentRange.start, currentRange.end),
      queryCountInOldTable(previousRange.start, previousRange.end),
      db.query(
        `SELECT MIN(entry_date) AS first_date
         FROM (
           SELECT STR_TO_DATE(timestamp, ?) AS entry_date FROM chlorine_hud_data_collection
           UNION ALL
           SELECT STR_TO_DATE(timestamp, ?) AS entry_date FROM chlorine_hud_data_collection_new
         ) t`,
        [dateFormat, dateFormat]
      ),
      queryActiveBlocks(),
      db.query(`SELECT DISTINCT block_name FROM hud_block_master`),
      db.query(rwalSql),
      db.query(todayRwalSql)
    ]);

    const total = oldTotal.cnt + newTotal.cnt;
    const todayCount = newTotal.cnt; // Safe to reuse newTotal.cnt as it represents the current daily table's count
    const currentCount = currentOld + currentNew;

    const firstEntryDate = firstRow.first_date ? new Date(firstRow.first_date) : null;

    const allBlocks = allBlocksRows.map((r) => r.block_name.trim());
    const allBlocksLower = allBlocks.map((b) => b.toLowerCase());

    const activeBlocksMap = new Map();
    allBlocks.forEach((b) => {
      activeBlocksMap.set(b.toLowerCase(), b);
    });

    const activeBlocksNormalizedSet = new Set();
    activeBlocks.forEach((rawBlock) => {
      if (rawBlock) {
        const trimmedLower = rawBlock.trim().toLowerCase();
        if (allBlocksLower.includes(trimmedLower)) {
          activeBlocksNormalizedSet.add(activeBlocksMap.get(trimmedLower));
        }
      }
    });

    const finalActiveBlocks = Array.from(activeBlocksNormalizedSet);
    const finalInactiveBlocks = allBlocks.filter((b) => !activeBlocksNormalizedSet.has(b));

    // Parse cumulative RWAL results
    const rwalCounts = { Adequate: 0, Inadequate: 0, Nil: 0 };
    rwalRows.forEach((row) => {
      rwalCounts[row.status] = row.count;
    });

    // Parse today RWAL results
    const todayRwal = { Adequate: 0, Inadequate: 0, Nil: 0 };
    todayRwalRows.forEach((row) => {
      todayRwal[row.status] = row.count;
    });

    return res.json({
      total,
      today: todayCount,
      currentMonth: currentCount,
      previousMonth: previousCount,

      todayAdequate: todayRwal.Adequate,
      todayInadequate: todayRwal.Inadequate,
      todayNil: todayRwal.Nil,

      adequate: rwalCounts.Adequate,
      inadequate: rwalCounts.Inadequate,
      nil: rwalCounts.Nil,

      activeBlocks: finalActiveBlocks,
      inactiveBlocks: finalInactiveBlocks,

      activeBlocksCount: finalActiveBlocks.length,
      inactiveBlocksCount: finalInactiveBlocks.length,

      totalBlocks: allBlocks.length,
      firstEntryDate,
    });
  } catch (error) {
    console.error("Summary Error:", error);
    return res.status(500).json({
      error: "Failed to fetch summary",
    });
  }
};

export const getChlorineSummaryByHudId = async (req, res) => {
  try {
    const db = await dbPromise;
    const { hud_id } = req.query;

    if (!hud_id) {
      return res.status(400).json({ error: "hud_id is required" });
    }

    const getRange = (type) => {
      const now = new Date();
      let start, end;

      if (type === "current") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }

      if (type === "previous") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      }

      return { start, end };
    };

    const toDDMMYYYY = (d) => {
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const dateFormat = "%d/%m/%Y, %H:%i:%s";

    // 1?? Get blocks under this HUD
    const [blockRows] = await db.query(
      `SELECT block_id, block_name
       FROM hud_block_master
       WHERE hud_id = ?`,
      [hud_id]
    );

    const blockIds = blockRows.map(b => b.block_id);
    const blockNames = blockRows.map(b => b.block_name);

    if (blockIds.length === 0) {
      return res.json({
        total: 0,
        today: 0,
        currentMonth: 0,
        previousMonth: 0,
        todayAdequate: 0,
        todayInadequate: 0,
        todayNil: 0,
        activeBlocks: [],
        inactiveBlocks: [],
        totalBlocks: 0,
        firstEntryDate: null,
      });
    }

    // Helper queries (Scoped to Block IDs)
    const queryCountInOldTable = async (start, end) => {
      const [rows] = await db.query(
        `SELECT COUNT(*) AS cnt
         FROM chlorine_hud_data_collection
         WHERE block_id IN (?)
         AND STR_TO_DATE(timestamp, ?)
         BETWEEN STR_TO_DATE(?, ?) AND STR_TO_DATE(?, ?)`,
        [
          blockIds,
          dateFormat,
          toDDMMYYYY(start),
          dateFormat,
          toDDMMYYYY(end),
          dateFormat,
        ]
      );
      return rows[0].cnt;
    };

    const queryCountInNewTable = async (start, end) => {
      const [rows] = await db.query(
        `SELECT COUNT(*) AS cnt
         FROM chlorine_hud_data_collection_new
         WHERE block_id IN (?)
         AND STR_TO_DATE(timestamp, ?)
         BETWEEN STR_TO_DATE(?, ?) AND STR_TO_DATE(?, ?)`,
        [
          blockIds,
          dateFormat,
          toDDMMYYYY(start),
          dateFormat,
          toDDMMYYYY(end),
          dateFormat,
        ]
      );
      return rows[0].cnt;
    };

    const queryActiveBlocks = async () => {
      const [rows] = await db.query(
        `SELECT DISTINCT block_name
         FROM chlorine_hud_data_collection_new
         WHERE block_id IN (?)`,
        [blockIds]
      );
      return rows.map(r => r.block_name);
    };

    const currentRange = getRange("current");
    const previousRange = getRange("previous");

    // SQL for Today's RWAL counting (Scoped to HUD's block IDs, entire daily table)
    const todayRwalSql = `
      SELECT 
        CASE
          WHEN ppm IS NULL OR TRIM(ppm) = '' OR TRIM(ppm) = 'Nil' OR CAST(ppm AS DECIMAL(10,2)) = 0 OR (CAST(ppm AS DECIMAL(10,2)) > 0 AND CAST(ppm AS DECIMAL(10,2)) < 0.1) THEN 'Nil'
          ELSE
            CASE
              WHEN UPPER(TRIM(samplingPoint)) IN ('TAIL', 'MID') THEN
                CASE 
                  WHEN ROUND(CAST(ppm AS DECIMAL(10,2)), 1) < 0.2 THEN 'Inadequate'
                  ELSE 'Adequate'
                END
              WHEN UPPER(TRIM(samplingPoint)) IN ('OHT', 'GLR', 'SUMP') THEN
                CASE 
                  WHEN ROUND(CAST(ppm AS DECIMAL(10,2)), 1) < 1.0 THEN 'Inadequate'
                  ELSE 'Adequate'
                END
              ELSE 'Adequate'
            END
        END AS status,
        COUNT(*) AS count
      FROM chlorine_hud_data_collection_new
      WHERE block_id IN (?)
      GROUP BY status
    `;

    // Run HUD-scoped queries concurrently using Promise.all
    const [
      [[oldTotal]],
      [[newTotal]],
      currentOld,
      currentNew,
      previousCount,
      [[firstRow]],
      activeBlocks,
      [todayRwalRows]
    ] = await Promise.all([
      db.query(`SELECT COUNT(*) AS cnt FROM chlorine_hud_data_collection WHERE block_id IN (?)`, [blockIds]),
      db.query(`SELECT COUNT(*) AS cnt FROM chlorine_hud_data_collection_new WHERE block_id IN (?)`, [blockIds]),
      queryCountInOldTable(currentRange.start, currentRange.end),
      queryCountInNewTable(currentRange.start, currentRange.end),
      queryCountInOldTable(previousRange.start, previousRange.end),
      db.query(
        `SELECT MIN(entry_date) AS first_date
         FROM (
           SELECT STR_TO_DATE(timestamp, ?) AS entry_date FROM chlorine_hud_data_collection WHERE block_id IN (?)
           UNION ALL
           SELECT STR_TO_DATE(timestamp, ?) AS entry_date FROM chlorine_hud_data_collection_new WHERE block_id IN (?)
         ) t`,
        [dateFormat, blockIds, dateFormat, blockIds]
      ),
      queryActiveBlocks(),
      db.query(todayRwalSql, [blockIds])
    ]);

    const total = oldTotal.cnt + newTotal.cnt;
    const todayCount = newTotal.cnt; // Safe to reuse newTotal.cnt as it represents the current daily table's count
    const currentCount = currentOld + currentNew;

    const firstEntryDate = firstRow.first_date ? new Date(firstRow.first_date) : null;

    const blockNamesLower = blockNames.map((b) => b.toLowerCase());
    const activeBlocksMap = new Map();
    blockNames.forEach((b) => {
      activeBlocksMap.set(b.toLowerCase(), b);
    });

    const activeBlocksNormalizedSet = new Set();
    activeBlocks.forEach((rawBlock) => {
      if (rawBlock) {
        const trimmedLower = rawBlock.trim().toLowerCase();
        if (blockNamesLower.includes(trimmedLower)) {
          activeBlocksNormalizedSet.add(activeBlocksMap.get(trimmedLower));
        }
      }
    });

    const finalActiveBlocks = Array.from(activeBlocksNormalizedSet);
    const finalInactiveBlocks = blockNames.filter((b) => !activeBlocksNormalizedSet.has(b));

    // Parse today RWAL results
    const todayRwal = { Adequate: 0, Inadequate: 0, Nil: 0 };
    todayRwalRows.forEach(row => {
      todayRwal[row.status] = row.count;
    });

    return res.json({
      total,
      today: todayCount,
      currentMonth: currentCount,
      previousMonth: previousCount,

      todayAdequate: todayRwal.Adequate,
      todayInadequate: todayRwal.Inadequate,
      todayNil: todayRwal.Nil,

      activeBlocks: finalActiveBlocks,
      inactiveBlocks: finalInactiveBlocks,
      activeBlocksCount: finalActiveBlocks.length,
      inactiveBlocksCount: finalInactiveBlocks.length,

      totalBlocks: blockIds.length,
      firstEntryDate,
    });

  } catch (err) {
    console.error("HUD Summary Error:", err);
    return res.status(500).json({ error: "Failed to fetch HUD summary" });
  }
};

export const saveAction = async (req, res) => {
  console.log("Incoming action data:", req.body);

  try {
    const db = await dbPromise;

    const {
      rowId,
      selectedActions = [],
      sourceActions = [],
      location,
      image_base64,
      role
    } = req.body;

    if (!rowId) {
      return res.status(400).json({ message: "rowId is required" });
    }

    if (!Array.isArray(selectedActions) || selectedActions.length === 0) {
      return res.status(400).json({ message: "selectedActions must be non-empty" });
    }

    // âœ… ROLE â†’ TABLE MAPPING
    const useSpecialTable = ["block_user", "dho", "special_user", "mos_admin"].includes(role);

    const tableName = useSpecialTable
      ? "larva_special_data_collection"
      : "larva_entries";

    let storedPath;

    // SAVE IMAGE (only if present)
    if (image_base64 && image_base64.startsWith("data:image")) {
      const cleanedBase64 = image_base64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(cleanedBase64, "base64");

      const uploadsDir = path.join(process.cwd(), "uploads", "actions");
      await fs.promises.mkdir(uploadsDir, { recursive: true });

      const filename = `action_${rowId}_${Date.now()}.jpg`;
      const fullPath = path.join(uploadsDir, filename);
      storedPath = `/uploads/actions/${filename}`;

      await fs.promises.writeFile(fullPath, buffer);
      scheduleImageDelete(fullPath);
    }

    const actionTakenData = {
      selectedActions,
      sourceActions
    };

    // BUILD UPDATE QUERY (avoid null overwrite)
    let sql = `
      UPDATE ${tableName}
      SET
        action_taken = ?,
        action_location = ?,
        action_date = NOW()
    `;

    const params = [
      JSON.stringify(actionTakenData),
      JSON.stringify(location)
    ];

    if (storedPath) {
      sql += `, action_image_path = ?`;
      params.push(storedPath);
    }

    sql += ` WHERE id = ?`;
    params.push(rowId);

    const [result] = await db.execute(sql, params);

    console.log("Rows updated:", result.affectedRows);

    return res.json({
      message: "Action saved successfully",
      rowId,
      role,
      table: tableName,
      stored_image: storedPath || null
    });

  } catch (error) {
    console.error("saveAction error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


// Optional: delete image after 7 days
function scheduleImageDelete(filePath) {
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

  setTimeout(() => {
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (!err) {
          console.log("Image auto-deleted after 7 days Ã¢â€ â€™", filePath);
        }
      });
    }
  }, ONE_WEEK);
}



export const addCorporationMaster = async (req, res) => {
  const {
    hub_id,
    hub_name,
    district_id,
    district_name,
    corporation_name,
    latitude,
    longitude,
  } = req.body;

  if (!hub_id || !hub_name || !district_id || !district_name || !corporation_name || !latitude || !longitude) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const stmt = await db.execute(`
      INSERT INTO chlorination_corporation_master  
        (hub_id, hub_name, district_id, district_name, corporation_name, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [hub_id, hub_name, district_id, district_name, corporation_name, latitude, longitude]);





    res.status(201).json({ message: "Corporation added", id: stmt.lastInsertRowid });;
  } catch (err) {
    console.error("Error inserting corporation master:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateChlorinationHubUser = async (req, res) => {
  const { user_id } = req.params;
  const { email, password, phone_number } = req.body;

  if (!user_id || !email || !password || !phone_number) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10); // Hash the password

    const stmt = await db.execute(`
      UPDATE chlorination_hub_users
      SET email = ?, hashedPassword = ?, phone_number = ?
      WHERE user_id = ?
    `, [email, hashedPassword, phone_number, user_id]);

    if (stmt.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getCorporationMaster = async (req, res) => {
  const { hub_id } = req.query;

  try {
    const db = await dbPromise;
    let data;

    if (hub_id) {
      const [rows] = await db.execute(
        `
        SELECT id, hub_id, hub_name, district_id, district_name, corporation_name, latitude, longitude, created_at
        FROM chlorination_corporation_master
        WHERE hub_id = ?
        ORDER BY district_name, corporation_name
        `,
        [hub_id]
      );
      data = rows;
    } else {
      const [rows] = await db.execute(
        `
        SELECT id, hub_id, hub_name, district_id, district_name, corporation_name, latitude, longitude, created_at
        FROM chlorination_corporation_master
        ORDER BY district_name, corporation_name
        `
      );
      data = rows;
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching corporation master:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getChlorinationDataCollectorById = async (req, res) => {
  const { user_id } = req.params;

  try {
    const db = await dbPromise;
    const [rows] = await db.execute(
      "SELECT * FROM chlorination_data_collectors WHERE user_id = ?",
      [user_id]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateChlorinationDataCollector = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;
  const { email, phone_number, password } = req.body; // input password, to be hashed if present

  if (!user_id || !email || !phone_number) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Start building query
    let query = `
      UPDATE chlorination_data_collectors
      SET email = ?, phone_number = ?
    `;
    const params = [email, phone_number];

    // Only hash and update password if provided
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, hashedPassword = ?`; // column name must match your table
      params.push(hashedPassword);
    }

    query += ` WHERE user_id = ?`;
    params.push(user_id);

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

export const deleteChlorinationDataCollector = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;

  try {

    const stmt = await db.execute("DELETE FROM chlorination_data_collectors WHERE user_id = ?", [user_id]);


    if (stmt.changes === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Deletion error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const deleteChlorinationHubUser = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;

  try {
    const [stmt] = await db.execute(`DELETE FROM chlorination_hub_users WHERE user_id = ?`, [user_id]);

    if (stmt.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET - All Users
export const getMosquitoMunicipalityUsers = async (req, res) => {
  const db = await dbPromise;
  try {
    const [users] = await db.execute("SELECT * FROM mosquito_municipality_users");
    res.json(users);
  } catch (err) {
    console.error("getMosquitoMunicipalityUsers error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};


export const addMosquitoMunicipalityUser = async (req, res) => {
  const db = await dbPromise;
  try {
    const {
      username,
      password,
      phone_number,
      email,
      municipality_name,
      district_name = "",
      role = "municipality_user",
      module = "mosquito",
      status = "active",
    } = req.body;

    const distCode = district_name?.substring(0, 4).toUpperCase() || "XXXX";
    const muniCode = municipality_name?.substring(0, 4).toUpperCase() || "XXXX";

    // Get count of existing users for district and municipality
    const [countRows] = await db.execute(
      `
      SELECT COUNT(*) AS count
      FROM mosquito_municipality_users
      WHERE district_name = ? AND municipality_name = ?
      `,
      [district_name, municipality_name]
    );
    const count = countRows[0]?.count || 0;
    const newCount = String(count + 1).padStart(3, "0");

    const user_id = `MOS${distCode}MUNUSR${muniCode}USR${newCount}`;

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into DB with parameters
    await db.execute(
      `
      INSERT INTO mosquito_municipality_users (
        user_id, username, password, phone_number,
        municipality_name, district_name, email,
        role, module, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        user_id,
        username,
        hashedPassword,
        phone_number || "",
        municipality_name,
        district_name,
        email,
        role,
        module,
        status,
      ]
    );

    res.status(201).json({
      user_id,
      username,
      phone_number,
      municipality_name,
      district_name,
      email,
      role,
      module,
      status,
    });
  } catch (err) {
    console.error("addMosquitoMunicipalityUser error:", err);
    res.status(500).json({ message: "Failed to add user" });
  }
};


// GET - Single User by ID
export const getMosquitoMunicipalityUserById = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;

  try {
    const stmt = await db.execute(`
      SELECT * FROM mosquito_municipality_users WHERE user_id = ?
    `, [user_id]);


    if (!stmt) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(stmt);
  } catch (err) {
    console.error("getMosquitoMunicipalityUserById error:", err);
    res.status(500).json({ message: "Failed to fetch user" });
  }
};

// PUT - Update User
export const updateMosquitoMunicipalityUser = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;
  const { username, password, phone_number, email, municipality_name, status } = req.body;

  try {
    let query;
    let params;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `
        UPDATE mosquito_municipality_users
        SET username = ?, password = ?, phone_number = ?, email = ?, municipality_name = ?, status = ?
        WHERE user_id = ?
      `;
      params = [username, hashedPassword, phone_number, email, municipality_name, status, user_id];
    } else {
      query = `
        UPDATE mosquito_municipality_users
        SET username = ?, phone_number = ?, email = ?, municipality_name = ?, status = ?
        WHERE user_id = ?
      `;
      params = [username, phone_number, email, municipality_name, status, user_id];
    }

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User updated successfully" });
  } catch (err) {
    console.error("updateMosquitoMunicipalityUser error:", err);
    res.status(500).json({ message: "Failed to update user" });
  }
};
// DELETE - Remove User
export const deleteMosquitoMunicipalityUser = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.params;

  try {
    const [stmt] = await db.execute(`
      DELETE FROM mosquito_municipality_users WHERE user_id = ?
    `, [user_id]);

    if (stmt.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("deleteMosquitoMunicipalityUser error:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
};
export const getMunicipalityMaster = async (req, res) => {
  try {
    const db = await dbPromise; // await your MySQL connection or pool

    const [rows] = await db.execute(`
      SELECT *
      FROM chlorination_municipality_master
    `);

    res.json(rows);
  } catch (err) {
    console.error("Error fetching municipalities:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// MUNICIPALITY MASTER -chlorination
export const addMunicipalityMaster = async (req, res) => {
  const db = await dbPromise;
  const { hub_id, hub_name, district_name, municipality_name, latitude, longitude } = req.body;

  if (!hub_id || !hub_name || !district_name || !municipality_name || !latitude || !longitude) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const stmt = await db.execute(`
      INSERT INTO chlorination_municipality_master
      (hub_id, hub_name, district_name, municipality_name, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [hub_id, hub_name, district_name, municipality_name, latitude, longitude]);

    res.status(201).json({ message: "Municipality added", id: stmt.lastInsertRowid });
  } catch (err) {
    console.error("Error inserting municipality:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addTownPanchayatMaster = async (req, res) => {
  const db = await dbPromise;
  const { hub_id, hub_name, district_name, townpanchayat_name, latitude, longitude } = req.body;

  if (!hub_id || !hub_name || !district_name || !townpanchayat_name || !latitude || !longitude) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const [stmt] = await db.execute(`
      INSERT INTO chlorination_townpanchayat_master
      (hub_id, hub_name, district_name, townpanchayat_name, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [hub_id, hub_name, district_name, townpanchayat_name, latitude, longitude]);

    res.status(201).json({ message: "Town Panchayat added", id: stmt.lastInsertRowid });
  } catch (err) {
    console.error("Error inserting into townpanchayat_master:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getTownPanchayatMaster = async (req, res) => {
  const db = await dbPromise;
  try {
    const [stmt] = await db.execute(`
      SELECT * FROM chlorination_townpanchayat_master
    `);

    res.json(stmt);
  } catch (err) {
    console.error("Error fetching town panchayats:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addGovernmentHospital = async (req, res) => {
  const db = await dbPromise;
  const { hub_id, hub_name, district_name, hospital_name, latitude, longitude } = req.body;

  if (!hub_id || !hub_name || !district_name || !hospital_name || !latitude || !longitude) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const [stmt] = await db.execute(`
      INSERT INTO chlorination_government_hospital_master
      (hub_id, hub_name, district_name, hospital_name, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [hub_id, hub_name, district_name, hospital_name, latitude, longitude]);

    res.status(201).json({ message: "Hospital added", id: stmt.lastInsertRowid });
  } catch (err) {
    console.error("Error adding hospital:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
export const getGovernmentHospitals = async (req, res) => {
  const db = await dbPromise;
  try {
    const [stmt] = await db.execute(`
      SELECT id, hub_id, hub_name, district_name, hospital_name, latitude, longitude, created_at
      FROM chlorination_government_hospital_master
    `);

    res.json(stmt);
  } catch (err) {
    console.error("Error fetching hospitals:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addRailwayStationMaster = async (req, res) => {
  const db = await dbPromise;
  const { hub_id, hub_name, district_name, station_name, latitude, longitude } = req.body;

  if (!hub_id || !hub_name || !district_name || !station_name || !latitude || !longitude) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const [stmt] = await db.execute(`
      INSERT INTO chlorination_railway_station_master
      (hub_id, hub_name, district_name, station_name, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [hub_id, hub_name, district_name, station_name, latitude, longitude]);

    res.status(201).json({ message: "Railway station added", id: stmt.lastInsertRowid });
  } catch (err) {
    console.error("Error adding railway station:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getRailwayStationMaster = async (req, res) => {
  const db = await dbPromise;
  try {
    const [stmt] = await db.execute(`SELECT * FROM chlorination_railway_station_master`);

    res.json(stmt);
  } catch (err) {
    console.error("Error fetching railway stations:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


export const addApprovedHomesMaster = async (req, res) => {
  const { hub_id, hub_name, district_name, approvedhome_name, latitude, longitude } = req.body;

  if (!hub_id || !hub_name || !district_name || !approvedhome_name || !latitude || !longitude) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const db = await dbPromise;
    const [stmt] = await db.execute(
      `INSERT INTO chlorination_approved_home_master
       (hub_id, hub_name, district_name, approvedhome_name, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hub_id, hub_name, district_name, approvedhome_name, latitude, longitude]
    );

    res.status(201).json({ message: "Approved home added", id: stmt.insertId });
  } catch (err) {
    console.error("Error adding approved home:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getApprovedHomesMaster = async (req, res) => {
  const db = await dbPromise;
  try {

    const [stmt] = await db.execute(`SELECT * FROM chlorination_approved_home_master`);
    console.log("Fetched rows from DB:", stmt); // ADD THIS LINE
    res.json(stmt);
  } catch (err) {
    console.error("Error fetching approved homes:", err.message, err.stack);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
};


export const getPrisonMaster = async (req, res) => {
  const db = await dbPromise;
  try {
    const [stmt] = await db.execute("SELECT * FROM chlorination_prison_master");

    res.json(stmt);
  } catch (err) {
    console.error("Error fetching prisons:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
export const addPrisonMaster = async (req, res) => {
  const db = await dbPromise;
  const { hub_id, hub_name, district_name, prison_name, latitude, longitude } = req.body;

  if (!hub_id || !hub_name || !district_name || !prison_name || !latitude || !longitude) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const [stmt] = await db.execute(`
      INSERT INTO chlorination_prison_master
      (hub_id, hub_name, district_name, prison_name, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [hub_id, hub_name, district_name, prison_name, latitude, longitude]);

    res.status(201).json({ message: "Prison added", id: stmt.lastInsertRowid });
  } catch (err) {
    console.error("Error adding prison:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
export const getGovernmentInstitutionMaster = async (req, res) => {
  const db = await dbPromise;
  try {
    const [rows] = await db.execute(`SELECT * FROM chlorination_governmentinstitution_master`);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching institutions:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


export const addGovernmentInstitutionMaster = async (req, res) => {
  const db = await dbPromise;
  const { hub_id, hub_name, district_name, institution_name, latitude, longitude } = req.body;
  if (!hub_id || !hub_name || !district_name || !institution_name || !latitude || !longitude) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {

    const [stmt] = await db.execute(
      `INSERT INTO chlorination_governmentinstitution_master
         (hub_id, hub_name, district_name, institution_name, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hub_id, hub_name, district_name, institution_name, latitude, longitude]
    );

    res.status(201).json({ message: "Institution added", id: stmt.lastInsertRowid });
  } catch (err) {
    console.error("Error adding institution:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};



export const addEducationalInstitutionMaster = async (req, res) => {

  try {
    const { hub_id, hub_name, district_name, institution_name, latitude, longitude } = req.body;

    if (!hub_id || !hub_name || !district_name || !institution_name || !latitude || !longitude) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const db = await dbPromise;
    const [stmt] = await db.execute(`
      INSERT INTO chlorination_educationalinstitution_master
      (hub_id, hub_name, district_name, institution_name, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?)
            `, [hub_id, hub_name, district_name, institution_name, latitude, longitude]);

    res.status(201).json({ message: "Institution added", id: stmt.lastInsertRowid });
  } catch (err) {
    console.error("Error adding educational institution:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getEducationalInstitutionMaster = async (req, res) => {
  const db = await dbPromise;
  try {
    const [stmt] = await db.execute(`
      SELECT * FROM chlorination_educationalinstitution_master
    `);

    res.json(stmt);
  } catch (err) {
    console.error("Error fetching institutions:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getPWDMaster = async (req, res) => {
  const db = await dbPromise;
  try {
    const [stmt] = await db.execute(`SELECT * FROM chlorination_pwd_master`);

    res.json(stmt);
  } catch (err) {
    console.error("Error fetching PWD records:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
export const addPWDMaster = async (req, res) => {
  const db = await dbPromise;
  const { hub_id, hub_name, district_name, pwd_name, latitude, longitude } = req.body;

  if (!hub_id || !hub_name || !district_name || !pwd_name || !latitude || !longitude) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const [stmt] = await db.execute(`
      INSERT INTO chlorination_pwd_master
      (hub_id, hub_name, district_name, pwd_name, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?)
    ` , [hub_id, hub_name, district_name, pwd_name, latitude, longitude]);

    res.status(201).json({ message: "PWD entry added", id: stmt.lastInsertRowid });
  } catch (err) {
    console.error("Error inserting PWD:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


export const addTempleFestival = async (req, res) => {
  const db = await dbPromise;
  const { hub_id, hub_name, district_name, temple_name, latitude, longitude } = req.body;

  if (!hub_id || !hub_name || !district_name || !temple_name || !latitude || !longitude) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const [stmt] = await db.execute(`
      INSERT INTO chlorination_templefestival_master
      (hub_id, hub_name, district_name, temple_name, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [hub_id, hub_name, district_name, temple_name, latitude, longitude]);

    res.status(201).json({ message: "Temple festival camp added", id: stmt.lastInsertRowid });
  } catch (err) {
    console.error("DB insert error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getTempleFestivals = async (req, res) => {
  const db = await dbPromise;
  try {
    const [rows] = await db.execute(`
      SELECT * FROM chlorination_templefestival_master
    `);
    res.json(rows);
  } catch (err) {
    console.error("DB select error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
/*
export const addGovtHoliday = async (req, res) => {
    const db = await dbPromise;
  const { holiday_name, date } = req.body;

  if (!holiday_name || !date) {
    return res.status(400).json({ error: "Missing holiday_name or date" });
  }

  // Always convert to string in YYYY-MM-DD format
  let formattedDate;
  if (typeof date === "string") {
    formattedDate = date.split("T")[0]; // Handles ISO strings
  } else if (date instanceof Date) {
    formattedDate = date.toISOString().split("T")[0];
  } else {
    // Try to parse if it's something else (e.g., from a date picker)
    try {
      formattedDate = new Date(date).toISOString().split("T")[0];
    } catch {
      return res.status(400).json({ error: "Invalid date format" });
    }
  }

  try {
    const stmt = await db.execute(
      `INSERT INTO chlorination_govt_holiday (holiday_name, date) VALUES (?, ?)`
    );
    const result = stmt.run(holiday_name, formattedDate);
    return res.status(200).json({ message: "Holiday added", id: result.lastInsertRowid });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
*/
export const addGovtHoliday = async (req, res) => {

  const { holiday_name, date } = req.body;

  if (!holiday_name || !date) {
    return res.status(400).json({ error: "Missing holiday_name or date" });
  }

  // Simplify date normalization, expect ISO 8601 or similar
  let formattedDate;
  try {
    formattedDate = new Date(date).toISOString().split("T")[0];
  } catch {
    return res.status(400).json({ error: "Invalid date format" });
  }

  try {
    const db = await dbPromise;
    const [result] = await db.execute(
      `INSERT INTO chlorination_govt_holiday (holiday_name, date) VALUES (?, ?)`,
      [holiday_name, formattedDate]
    );

    console.log("Inserted holiday with ID:", result.insertId);

    return res.status(201).json({
      message: "Holiday added",
      id: result.insertId
    });
  } catch (err) {
    console.error("DB insert error:", err);
    return res.status(500).json({ error: err.message });
  }
};


export const getGovtHolidays = async (req, res) => {
  const db = await dbPromise; // ensure we get the connection

  try {
    const [rows] = await db.execute(
      `SELECT * FROM chlorination_govt_holiday ORDER BY date ASC`
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error("Error retrieving holidays:", err.message);
    return res.status(500).json({ error: "Failed to retrieve holidays" });
  }
};


export const getHubMasterData = async (req, res) => {
  try {

    const tables = [
      ['chlorination_corporation_master', 'corporation', 'corporation_name', 'Corporation'],
      ['chlorination_municipality_master', 'municipalities', 'municipality_name', 'Municipality'],
      ['chlorination_townpanchayat_master', 'townPanchayats', 'townpanchayat_name', 'Town Panchayat'],
      ['chlorination_government_hospital_master', 'govtHospitals', 'hospital_name', 'Government Hospital'],
      ['chlorination_railway_station_master', 'railwayStations', 'station_name', 'Railway Station'],
      ['chlorination_approved_home_master', 'approvedHomes', 'approvedhome_name', 'Approved Home'],
      ['chlorination_prison_master', 'prisons', 'prison_name', 'Prison'],
      ['chlorination_governmentinstitution_master', 'govtInstitutions', 'institution_name', 'Government Institution'],
      ['chlorination_educationalinstitution_master', 'educationalInstitutions', 'institution_name', 'Educational Institution'],
      ['chlorination_pwd_master', 'pwdPoondi', 'pwd_name', 'PWD'],
      ['chlorination_templefestival_master', 'templeCamp', 'temple_name', 'Temple Camp'],
    ];

    const masterData = {};
    const details = [];

    for (const [table, alias, nameField, categoryLabel] of tables) {
      const db = await dbPromise;
      // Query data from each table
      const [rows] = await db.execute(
        `SELECT hub_id, hub_name, district_name, ${nameField} AS location_name FROM ${table}`
      );

      for (const row of rows) {
        // Add to detailed records
        details.push({
          hub_id: row.hub_id,
          hub_name: row.hub_name,
          district: row.district_name,
          location_name: row.location_name,
          category: categoryLabel,
        });

        // Aggregate summary counts
        const key = `${row.hub_id}_${row.district_name}`;
        if (!masterData[key]) {
          masterData[key] = {
            hub_id: row.hub_id,
            district: row.district_name,
            corporation: 0,
            municipalities: 0,
            townPanchayats: 0,
            govtHospitals: 0,
            railwayStations: 0,
            approvedHomes: 0,
            prisons: 0,
            govtInstitutions: 0,
            educationalInstitutions: 0,
            pwdPoondi: 0,
            templeCamp: 0,
            cycle1Status: "In Progress",
            cycle2Status: "In Progress",
          };
        }

        masterData[key][alias]++;
      }
    }

    const summary = Object.values(masterData).map((entry, index) => ({
      id: index + 1,
      ...entry,
      total:
        entry.corporation +
        entry.municipalities +
        entry.townPanchayats +
        entry.govtHospitals +
        entry.railwayStations +
        entry.approvedHomes +
        entry.prisons +
        entry.govtInstitutions +
        entry.educationalInstitutions +
        entry.pwdPoondi +
        entry.templeCamp,
    }));

    res.json({ summary, details });
  } catch (error) {
    console.error("Error in getHubMasterData:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const savePlanStatus = async (req, res) => {
  const db = await dbPromise;

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  let {
    user_id,
    username = '',
    hub_name = '',
    location_name,
    district = '',
    hub_id,
    accepted,
    reason = '',
    visited = 0,
    remarks = '',
  } = req.body;

  const acceptedValue = Number(accepted);
  const remarksTrimmed = String(remarks || '').slice(0, 250);

  if (!user_id || !location_name || !hub_id || isNaN(acceptedValue)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const timestamp = new Date().toISOString();
  const flag = acceptedValue === 0 && reason === 'Leave' ? 'red' : '';

  try {
    await db.execute(
      `INSERT INTO inspection_plan_status
        (user_id, username, hub_name, location_name, district, hub_id,
         accepted, reason, timestamp, visited, remarks, flag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        username,
        hub_name,
        location_name,
        district,
        hub_id,
        acceptedValue,
        reason,
        timestamp,
        String(visited ?? '0'),
        remarksTrimmed,
        flag,
      ]
    );

    // mimic SQLite behaviour
    if (acceptedValue === 0) {
      const rescheduleReasons = ['Local Holiday', 'Natural Disaster'];

      if (reason === 'Leave') {
        return res.json({ success: true, reschedule: true, flag: 'red' });
      }

      if (!rescheduleReasons.includes(reason)) {
        return res.json({ success: true, reschedule: true });
      }

      return res.json({ success: true, reschedule: 'defer' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Error saving plan status:', err);
    return res.status(500).json({ error: 'Database error' });
  }
};

// GET /inspection-plan?user_id=HUB001...
export const getInspectionPlan = async (req, res) => {
  try {
    const db = await dbPromise;

    // 1. Load holidays
    const [holidayRows] = await db.execute(`SELECT date FROM chlorination_govt_holiday`);
    const govtHolidays = new Set(
      holidayRows.map((row) => new Date(row.date).toDateString())
    );

    // 2. Location tables
    const tables = [
      ['chlorination_corporation_master', 'corporation_name', 'Corporation'],
      ['chlorination_municipality_master', 'municipality_name', 'Municipality'],
      ['chlorination_townpanchayat_master', 'townpanchayat_name', 'Town Panchayat'],
      ['chlorination_government_hospital_master', 'hospital_name', 'Government Hospital'],
      ['chlorination_railway_station_master', 'station_name', 'Railway Station'],
      ['chlorination_approved_home_master', 'approvedhome_name', 'Approved Home'],
      ['chlorination_prison_master', 'prison_name', 'Prison'],
      ['chlorination_governmentinstitution_master', 'institution_name', 'Government Institution'],
      ['chlorination_educationalinstitution_master', 'institution_name', 'Educational Institution'],
      ['chlorination_pwd_master', 'pwd_name', 'PWD'],
      ['chlorination_templefestival_master', 'temple_name', 'Temple Camp'],
    ];

    const details = [];
    for (const [tbl, nameFld, cat] of tables) {
      try {
        const [rows] = await db.execute(`
          SELECT hub_id, hub_name, district_name, ${nameFld} AS location_name, latitude, longitude
          FROM ${tbl}
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        `);

        rows.forEach((r) => {
          details.push({
            hub_id: r.hub_id.trim().toUpperCase(),
            hub_name: r.hub_name,
            district: r.district_name,
            location_name: r.location_name,
            category: cat,
            latitude: parseFloat(r.latitude),
            longitude: parseFloat(r.longitude),
            table_name: tbl,
          });
        });
      } catch (e) {
        console.warn(`Skipping ${tbl}: ${e.message}`);
      }
    }

    // 3. Past Accepted Plans (one year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const [acceptedPlans] = await db.execute(
      `
      SELECT user_id, location_name, district, hub_id
      FROM inspection_plan_status
      WHERE accepted = 1 AND timestamp >= ?
    `,
      [oneYearAgo.toISOString()]
    );

    const skipSet = new Set(
      acceptedPlans.map(
        (p) => `${p.user_id}_${p.hub_id}_${p.location_name}_${p.district}`
      )
    );

    // 4. Hubs and Users
    const [hubsInfo] = await db.execute(
      `SELECT hub_id, latitude, longitude FROM chlorination_hubs`
    );
    const hubCoords = {};
    hubsInfo.forEach((h) => {
      hubCoords[h.hub_id.trim().toUpperCase()] = {
        latitude: parseFloat(h.latitude),
        longitude: parseFloat(h.longitude),
      };
    });

    const [dataCollectorsRaw] = await db.execute(`
      SELECT user_id, username, email, hub_id, hub_name
      FROM chlorination_data_collectors
    `);

    const dataCollectors = dataCollectorsRaw.map((u) => ({
      ...u,
      hub_id: u.hub_id.trim().toUpperCase(),
    }));

    const usersByHub = {};
    dataCollectors.forEach((u) => {
      const hubKey = u.hub_id;
      (usersByHub[hubKey] ??= []).push(u);
    });

    // 5. Utility Functions
    const haversine = (a, b) => {
      const R = 6371e3;
      const toRad = (deg) => (deg * Math.PI) / 180;
      const dLat = toRad(b.latitude - a.latitude);
      const dLon = toRad(b.longitude - a.longitude);
      const la1 = toRad(a.latitude),
        la2 = toRad(b.latitude);
      const aVal =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    };

    const getWorkingDays = (start, count) => {
      const days = [];
      let date = new Date(start);
      while (days.length < count) {
        const day = date.getDay();
        const isWorkingDay = day >= 1 && day <= 4;
        const isHoliday = govtHolidays.has(date.toDateString());
        if (isWorkingDay && !isHoliday) {
          days.push(new Date(date));
        }
        date.setDate(date.getDate() + 1);
      }
      return days;
    };

    const formatDate = (d) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    const hubDistrictMap = {
      HUB001: 'chennai',
      HUB002: 'kancheepuram',
      HUB003: 'thiruvallur',
      HUB004: 'chengalpattu',
    };

    const getDuration = (hubId, loc) => {
      const hub = hubCoords[hubId];
      if (!hub) return 3;

      const district = (loc.district || '').toLowerCase();
      const table = loc.table_name.toLowerCase();

      if (['HUB001', 'HUB002', 'HUB003', 'HUB004'].includes(hubId)) {
        if (table.includes('corporation') && district.includes(hubDistrictMap[hubId])) {
          return 1;
        }
        if (table.includes('corporation')) {
          return 2;
        }
        if (
          table.includes('municipality') ||
          table.includes('townpanchayat') ||
          table.includes('government_hospital') ||
          table.includes('railway_station') ||
          table.includes('prison')
        ) {
          return 3;
        }
        return 3;
      }

      return 3;
    };

    // 6. Group by Hub
    const byHub = {};
    details.forEach((loc) => {
      const key = `${loc.hub_id}`;
      (byHub[key] ??= []).push(loc);
    });

    const plan = [];

    for (const [hubId, locations] of Object.entries(byHub)) {
      const hubUsers = usersByHub[hubId] || [];
      if (!hubUsers.length) continue;

      const assigned = new Set();
      const userCalendars = hubUsers.map((user) => ({
        user,
        days: getWorkingDays(new Date(), 100),
      }));

      let locIndex = 0;
      let userIndex = 0;
      const retryLater = [];

      while (locIndex < locations.length) {
        const loc = locations[locIndex];
        if (assigned.has(locIndex)) {
          locIndex++;
          continue;
        }

        let attempts = 0;
        let assignedNow = false;

        while (attempts < userCalendars.length) {
          const calendar = userCalendars[userIndex % userCalendars.length];
          userIndex++;
          attempts++;

          const key = `${calendar.user.user_id}_${hubId}_${loc.location_name}_${loc.district}`;
          if (skipSet.has(key)) continue;

          const isZoneCorp =
            loc.table_name.includes('corporation') &&
            loc.location_name.toLowerCase().includes('zone');

          let group = [loc];
          assigned.add(locIndex);

          if (!isZoneCorp) {
            // same grouping rules you had in SQLite version
            if (loc.table_name.includes('municipality')) {
              for (let j = 0; j < locations.length && group.length < 3; j++) {
                if (assigned.has(j)) continue;
                const cand = locations[j];
                const dist = haversine(loc, cand) / 1000;
                if (dist <= 5) {
                  group.push(cand);
                  assigned.add(j);
                }
              }
            } else if (loc.table_name.includes('townpanchayat')) {
              for (let j = 0; j < locations.length && group.length < 3; j++) {
                if (assigned.has(j)) continue;
                const cand = locations[j];
                const dist = haversine(loc, cand) / 1000;
                if (dist <= 5 && !cand.table_name.includes('townpanchayat')) {
                  group.push(cand);
                  assigned.add(j);
                }
              }
            } else {
              for (let j = 0; j < locations.length && group.length < 3; j++) {
                if (assigned.has(j)) continue;
                const cand = locations[j];
                const dist = haversine(loc, cand) / 1000;
                if (dist <= 5) {
                  group.push(cand);
                  assigned.add(j);
                }
              }
            }
          }

          const dur = getDuration(hubId, loc);
          let dateIdx = -1;

          while (++dateIdx < calendar.days.length) {
            const d = calendar.days[dateIdx];
            const day = d.getDay();
            const isValid =
              (dur === 3 && day === 1) ||
              (dur === 2 && day <= 2) ||
              (dur === 1 && day === 4);

            if (isValid) {
              const from = new Date(d);
              const to = new Date(from);
              to.setDate(to.getDate() + dur - 1);
              const fromStr = formatDate(from);
              const toStr = formatDate(to);

              group.forEach((l) => {
                plan.push({
                  hub_id: hubId,
                  hub_name: l.hub_name,
                  district: l.district,
                  location_name: l.location_name,
                  category: l.category,
                  user_id: calendar.user.user_id,
                  username: calendar.user.username,
                  email: calendar.user.email,
                  from: fromStr,
                  to: toStr,
                  isLong: dur > 1,
                });
              });

              calendar.days.splice(dateIdx, dur);
              assignedNow = true;
              break;
            }
          }

          if (assignedNow) break;
        }

        if (!assignedNow) retryLater.push(loc);
        locIndex++;
      }

      retryLater.forEach((loc) => {
        const user = hubUsers[Math.floor(Math.random() * hubUsers.length)];
        const from = getWorkingDays(new Date(), 365).slice(-1)[0];
        const dur = getDuration(hubId, loc);
        const to = new Date(from);
        to.setDate(to.getDate() + dur - 1);
        plan.push({
          hub_id: hubId,
          hub_name: loc.hub_name,
          district: loc.district,
          location_name: loc.location_name,
          category: loc.category,
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          from: formatDate(from),
          to: formatDate(to),
          isLong: dur > 1,
        });
      });
    }

    const grouped = {};
    plan.forEach((v) => {
      const key = `${v.from}_${v.to}_${v.user_id}_${v.hub_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          from: v.from,
          to: v.to,
          locations: new Set(),
          hi_name: `${v.username}, HI`,
          hub_id: v.hub_id,
          return_date: v.to,
          user_id: v.user_id,
        };
      }
      grouped[key].locations.add(`${v.location_name}, ${v.district}`);
    });

    const printablePlan = Object.values(grouped).map((v, i) => ({
      sno: i + 1,
      from: v.from,
      to: v.to,
      proposed_place: [...v.locations].join(' | '),
      return_date: v.return_date,
      hi_name: v.hi_name,
      hub_id: v.hub_id,
      user_id: v.user_id,
    }));

    return res.json({ printablePlan });
  } catch (err) {
    console.error('getInspectionPlan error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};




export const getAllPlanStatuses = async (req, res) => {
  try {
    const db = await dbPromise;
    const [rows] = await db.execute(`SELECT * FROM inspection_plan_status`);
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching plan statuses:', err);
    return res.status(500).json({ error: 'Database error' });
  }
};




export const saveVillageWaterSamplePlan = async (req, res) => {
  try {
    const {
      district,
      hud_id,
      hud_name,
      block_id,
      block_name,
      village_id,
      village_name,
      month,
      samples,
      date,
    } = req.body;

    const db = await dbPromise;

    await db.execute(
      `
      INSERT INTO village_water_sample_plan (
        district, hud_id, hud_name,
        block_id, block_name,
        village_id, village_name,
        month, samples, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        district,
        hud_id,
        hud_name,
        block_id,
        block_name,
        village_id,
        village_name,
        month,
        samples || 0,
        date || null
      ]
    );

    res.status(201).json({ message: "Village water sample plan saved successfully" });
  } catch (err) {
    console.error("Error saving plan:", err.message);
    res.status(500).json({ error: "Failed to save plan" });
  }
};


export const getVillageWaterSamplePlans = async (req, res) => {
  try {
    const db = await dbPromise;
    const [rows] = await db.execute(`SELECT * FROM village_water_sample_plan ORDER BY id DESC`);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching plans:", err.message);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
};

// Assumes `db` is a mysql2/promise connection or pool
export const generateId = async (hudName, blockName) => {
  const hudPrefix = hudName.trim().substring(0, 4).toUpperCase();
  const blockPrefix = blockName.trim().substring(0, 4).toUpperCase();
  const prefix = `CHLHUD${hudPrefix}BLK${blockPrefix}USR`;
  const db = await dbPromise;
  // Query last user_id that matches the prefix
  const [rows] = await db.execute(
    `
    SELECT user_id FROM chl_hud_block_users
    WHERE user_id LIKE ?
    ORDER BY user_id DESC
    LIMIT 1
    `,
    [`${prefix}%`]
  );

  let nextNumber = 1;
  if (rows.length > 0) {
    const last = rows[0];
    const match = last.user_id.match(/(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(3, "0")}`;
};

export const addBlockUser = async (req, res) => {
  const {
    username,
    email,
    phone_number,
    password,
    hud_id,
    hud_name,
    block_id,
    block_name,
    module = "chlorination",
    role = "block_user",
    status = "Active",
  } = req.body;

  if (
    !username ||
    !email ||
    !phone_number ||
    !password ||
    !hud_id ||
    !hud_name ||
    !block_id ||
    !block_name
  ) {
    return res
      .status(400)
      .json({ message: "All required fields must be provided" });
  }

  try {
    const db = await dbPromise;

    const hashedPassword = await bcrypt.hash(password, 10);
    const user_id = await generateId(hud_name, block_name);

    const insertQuery = `
      INSERT INTO chl_hud_block_users
      (
        user_id,
        username,
        email,
        phone_number,
        password,
        hud_id,
        hud_name,
        block_id,
        block_name,
        module,
        role,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(insertQuery, [
      user_id,
      username,
      email,
      phone_number,
      hashedPassword,
      hud_id,
      hud_name,
      block_id,
      block_name,
      module,
      role,
      status,
    ]);

    return res.status(201).json({
      message: "Block user added successfully",
      user_id,
    });
  } catch (err) {
    // MySQL duplicate key error
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "User already exists" });
    }

    console.error("addBlockUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


export const getBlockUsers = async (req, res) => {
  try {
    const { hud_id } = req.query;
    const db = await dbPromise;
    let rows;

    if (hud_id) {
      console.log("Ã°Å¸â€˜â€° Fetching block users for hud_id:", hud_id);
      const [result] = await db.execute(
        `SELECT * FROM chl_hud_block_users WHERE hud_id = ?`,
        [hud_id]
      );
      rows = result;
    } else {
      console.log("Ã°Å¸â€˜â€° Fetching ALL block users");
      const [result] = await db.execute(
        `SELECT * FROM chl_hud_block_users`
      );
      rows = result;
    }

    console.log("Ã¢Å“â€¦ Query result:", rows);

    return res.json(rows);
  } catch (err) {
    console.error("Ã¢ÂÅ’ getBlockUsers error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};


export const updateBlockUser = async (req, res) => {
  const { user_id } = req.params;

  const {
    username,
    email,
    phone_number,
    password,
    hud_id,
    hud_name,
    block_id,
    block_name,
    module = "chlorination",
    role = "block_user",
    status = "Active",
  } = req.body;

  if (
    !username ||
    !email ||
    !phone_number ||
    !hud_id ||
    !hud_name ||
    !block_id ||
    !block_name
  ) {
    return res.status(400).json({
      message: "All required fields except password must be provided",
    });
  }

  try {
    const db = await dbPromise;

    /* Ã°Å¸â€Â¹ Fetch existing user */
    const [rows] = await db.query(
      "SELECT password FROM chl_hud_block_users WHERE user_id = ?",
      [user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    /* Ã°Å¸â€Â¹ Handle password */
    let hashedPassword = rows[0].password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    /* Ã°Å¸â€Â¹ Update */
    const [result] = await db.query(
      `
      UPDATE chl_hud_block_users
      SET
        username = ?,
        email = ?,
        phone_number = ?,
        password = ?,
        hud_id = ?,
        hud_name = ?,
        block_id = ?,
        block_name = ?,
        module = ?,
        role = ?,
        status = ?
      WHERE user_id = ?
      `,
      [
        username,
        email,
        phone_number,
        hashedPassword,
        hud_id,
        hud_name,
        block_id,
        block_name,
        module,
        role,
        status,
        user_id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ message: "Block user updated successfully" });
  } catch (err) {
    console.error("updateBlockUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


export const deleteBlockUser = async (req, res) => {
  const { user_id } = req.params;

  try {
    const db = await dbPromise;

    const [result] = await db.query(
      "DELETE FROM chl_hud_block_users WHERE user_id = ?",
      [user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ message: "Block user deleted successfully" });
  } catch (err) {
    console.error("deleteBlockUser error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getSavePlanStatus = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const db = await dbPromise;
    const [rows] = await db.execute(
      `SELECT * FROM inspection_plan_status
       WHERE user_id = ?
       ORDER BY timestamp DESC`,
      [user_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching plan status:', err);
    return res.status(500).json({ error: 'Database error' });
  }
};



/* ---------------------------------------------
   Generate PHC ID using Block ID prefix
----------------------------------------------*/
// async function generatePhcId(block_id, phc_name) {
//   // Extract prefix from block ID: HUDBLKABCD001 Ã¢â€ â€™ ABCD
//   const blockPrefix = block_id.replace(/[0-9]/g, "").slice(-4).toUpperCase();

//   const db = await dbPromise;

//   const [rows] = await db.execute(
//     `
//       SELECT TRIM(phc_id) AS phc_id
//       FROM phc_master
//       WHERE phc_id LIKE CONCAT('PHC', ?, '%')
//       ORDER BY LENGTH(phc_id) DESC, phc_id DESC
//       LIMIT 1
//     `,
//     [blockPrefix]
//   );

//   let nextNumber = 1;

//   if (rows.length > 0) {
//     const match = rows[0].phc_id.match(/(\d+)$/);
//     if (match) nextNumber = parseInt(match[1], 10) + 1;
//   }

//   return `PHC${blockPrefix}${String(nextNumber).padStart(3, "0")}`;
// }
export async function generatePhcId(block_id, phc_name) {
  if (!block_id || !phc_name) {
    throw new Error("block_id and phc_name are required");
  }

  const db = await dbPromise;

  // 1Ã¯Â¸ÂÃ¢Æ’Â£ Extract block prefix safely Ã¢â€ â€™ KANC
  const blockMatch = block_id.match(/([A-Z]{3,5})\d*$/i);
  if (!blockMatch) {
    throw new Error(`Invalid block_id format: ${block_id}`);
  }
  const blockPrefix = blockMatch[1].toUpperCase();

  // 2Ã¯Â¸ÂÃ¢Æ’Â£ Extract PHC name prefix Ã¢â€ â€™ first 3 letters
  const namePrefix = phc_name
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, "X"); // ensure length

  // 3Ã¯Â¸ÂÃ¢Æ’Â£ Base prefix
  const basePrefix = `PHC${blockPrefix}${namePrefix}`;

  // 4Ã¯Â¸ÂÃ¢Æ’Â£ Find last ID with same prefix
  const [rows] = await db.execute(
    `
    SELECT phc_id
    FROM phc_master
    WHERE phc_id LIKE ?
    ORDER BY CAST(SUBSTRING(phc_id, -3) AS UNSIGNED) DESC
    LIMIT 1
    `,
    [`${basePrefix}%`]
  );

  let nextNumber = 1;

  if (rows.length > 0) {
    const match = rows[0].phc_id.match(/(\d{3})$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  // 5Ã¯Â¸ÂÃ¢Æ’Â£ Final PHC ID
  return `${basePrefix}${String(nextNumber).padStart(3, "0")}`;
}


/* ---------------------------------------------
   Add New PHC
----------------------------------------------*/
export const addPhc = async (req, res) => {
  try {
    const { phc_name, hud_id, hud_name, block_id, block_name } = req.body;

    if (!phc_name || !hud_id || !block_id)
      return res.status(400).json({ message: "Missing required fields" });

    const phc_id = await generatePhcId(block_id, phc_name);

    const db = await dbPromise;

    await db.execute(
      `
        INSERT INTO phc_master
        (phc_id, phc_name, hud_id, hud_name, block_id, block_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [phc_id, phc_name, hud_id, hud_name, block_id, block_name]
    );

    res.status(201).json({ message: "PHC added successfully", phc_id });
  } catch (err) {
    console.error("Error adding PHC:", err);
    res.status(500).json({ message: "Failed to add PHC" });
  }
};

/* ---------------------------------------------
   Fetch all PHCs
----------------------------------------------*/
export const getPhcs = async (req, res) => {
  try {
    const db = await dbPromise;

    const [rows] = await db.execute(
      `SELECT * FROM phc_master ORDER BY hud_name, block_name, phc_name`
    );

    rows.forEach(r => {
      Object.keys(r).forEach(k => {
        if (Buffer.isBuffer(r[k])) r[k] = r[k].toString();
      });
    });

    res.json(rows);
  } catch (err) {
    console.error("Error fetching PHCs:", err);
    res.status(500).send("Failed to fetch PHCs");
  }
};

/* ---------------------------------------------
   Update PHC
----------------------------------------------*/
export const updatePhc = async (req, res) => {
  try {
    const { phc_id } = req.params;
    const { phc_name, hud_id, hud_name, block_id, block_name } = req.body;

    if (!phc_id || !phc_name || !hud_id || !block_id)
      return res.status(400).json({ message: "Missing fields" });

    const db = await dbPromise;

    const [result] = await db.execute(
      `
        UPDATE phc_master
        SET phc_name = ?, hud_id = ?, hud_name = ?, block_id = ?, block_name = ?
        WHERE phc_id = ?
      `,
      [phc_name, hud_id, hud_name, block_id, block_name, phc_id]
    );

    if (!result.affectedRows)
      return res.status(404).json({ message: "PHC not found" });

    res.json({ message: "PHC updated successfully" });
  } catch (err) {
    console.error("Error updating PHC:", err);
    res.status(500).json({ message: "Failed to update PHC" });
  }
};

/* ---------------------------------------------
   Delete PHC
----------------------------------------------*/
export const deletePhc = async (req, res) => {
  try {
    const { phc_id } = req.params;

    const db = await dbPromise;

    const [result] = await db.execute(
      `DELETE FROM phc_master WHERE phc_id = ?`,
      [phc_id]
    );

    if (!result.affectedRows)
      return res.status(404).json({ message: "PHC not found" });

    res.json({ message: "PHC deleted successfully" });
  } catch (err) {
    console.error("Error deleting PHC:", err);
    res.status(500).json({ message: "Failed to delete PHC" });
  }
};

export const getChlorinePPMSummary = async (req, res) => {
  try {
    const db = await dbPromise;
    const { download } = req.query;

    /* ================= DOWNLOAD MODE ================= */
    if (download === "true") {
      const minPPM = Number(req.query.min);
      const maxPPM = Number(req.query.max);
      const limit = Math.min(Number(req.query.limit) || 1200, 1200);
      const { fromDate, toDate } = req.query;

      if (
        Number.isNaN(minPPM) ||
        Number.isNaN(maxPPM) ||
        minPPM >= maxPPM
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid PPM range"
        });
      }

      const queryParams = [];
      let dateCondition = "";

      if (fromDate && toDate) {
        dateCondition = `
          AND DATE(
            CASE 
              WHEN timestamp LIKE '%,%' AND (timestamp LIKE '%AM%' OR timestamp LIKE '%PM%') THEN STR_TO_DATE(timestamp, '%d/%m/%Y, %h:%i:%s %p')
              WHEN timestamp LIKE '%,%' THEN STR_TO_DATE(timestamp, '%d/%m/%Y, %H:%i:%s')
              WHEN timestamp LIKE '%/%' THEN STR_TO_DATE(timestamp, '%d/%m/%Y %H:%i:%s')
              ELSE STR_TO_DATE(timestamp, '%Y-%m-%d %H:%i:%s')
            END
          ) BETWEEN ? AND ?
        `;
        queryParams.push(minPPM, maxPPM, fromDate, toDate, minPPM, maxPPM, fromDate, toDate);
      } else {
        queryParams.push(minPPM, maxPPM, minPPM, maxPPM);
      }

      const [rows] = await db.execute(
        `
        SELECT image_path, actualPPM, ppm, timestamp FROM (
          SELECT image_path, actualPPM, ppm, timestamp
          FROM chlorine_data_collection
          WHERE actualPPM >= ? AND actualPPM < ?
            AND image_path IS NOT NULL
            ${dateCondition}

          UNION ALL

          SELECT image_path, actualPPM, ppm, timestamp
          FROM chlorine_hud_data_collection
          WHERE actualPPM >= ? AND actualPPM < ?
            AND image_path IS NOT NULL
            ${dateCondition}
        ) t
        ORDER BY 
          CASE 
            WHEN timestamp LIKE '%,%' AND (timestamp LIKE '%AM%' OR timestamp LIKE '%PM%') THEN STR_TO_DATE(timestamp, '%d/%m/%Y, %h:%i:%s %p')
            WHEN timestamp LIKE '%,%' THEN STR_TO_DATE(timestamp, '%d/%m/%Y, %H:%i:%s')
            WHEN timestamp LIKE '%/%' THEN STR_TO_DATE(timestamp, '%d/%m/%Y %H:%i:%s')
            ELSE STR_TO_DATE(timestamp, '%Y-%m-%d %H:%i:%s')
          END DESC
        LIMIT ${limit}
        `,
        queryParams
      );

      const images = rows
        .filter(r => r.image_path)
        .map(r => ({
          url: `http://localhost:3000${r.image_path}`,
          actualPPM: r.actualPPM !== null ? Number(r.actualPPM) : null,
          ppm: r.ppm !== null ? Number(r.ppm) : null,
          timestamp: r.timestamp
        }));

      return res.json({
        success: true,
        count: images.length,
        images
      });
    }

    /* ================= SUMMARY MODE ================= */

    const [rows] = await db.execute(`
      SELECT
        COALESCE(SUM(actualPPM >= 0   AND actualPPM < 0.5), 0) AS t_0_0_5,
        COALESCE(SUM(actualPPM >= 0.5 AND actualPPM < 1), 0)   AS t_0_5_1,
        COALESCE(SUM(actualPPM >= 1   AND actualPPM < 1.5), 0) AS t_1_1_5,
        COALESCE(SUM(actualPPM >= 1.5 AND actualPPM < 2), 0)   AS t_1_5_2,
        COALESCE(SUM(actualPPM >= 2   AND actualPPM < 2.5), 0) AS t_2_2_5,
        COALESCE(SUM(actualPPM >= 2.5 AND actualPPM < 3), 0)   AS t_2_5_3,
        COALESCE(SUM(actualPPM >= 3), 0)                       AS t_gt_3,

        COALESCE(SUM(actualPPM >= 0   AND actualPPM < 0.5 AND image_path IS NOT NULL), 0) AS i_0_0_5,
        COALESCE(SUM(actualPPM >= 0.5 AND actualPPM < 1   AND image_path IS NOT NULL), 0) AS i_0_5_1,
        COALESCE(SUM(actualPPM >= 1   AND actualPPM < 1.5 AND image_path IS NOT NULL), 0) AS i_1_1_5,
        COALESCE(SUM(actualPPM >= 1.5 AND actualPPM < 2   AND image_path IS NOT NULL), 0) AS i_1_5_2,
        COALESCE(SUM(actualPPM >= 2   AND actualPPM < 2.5 AND image_path IS NOT NULL), 0) AS i_2_2_5,
        COALESCE(SUM(actualPPM >= 2.5 AND actualPPM < 3   AND image_path IS NOT NULL), 0) AS i_2_5_3,
        COALESCE(SUM(actualPPM >= 3                       AND image_path IS NOT NULL), 0) AS i_gt_3
      FROM (
        SELECT actualPPM, image_path FROM chlorine_data_collection
        UNION ALL
        SELECT actualPPM, image_path FROM chlorine_hud_data_collection
      ) t
    `);

    return res.json({
      success: true,
      data: [
        { label: "0 – 0.5", min: 0, max: 0.5, totalCount: Number(rows[0].t_0_0_5), imageCount: Number(rows[0].i_0_0_5) },
        { label: "0.5 – 1", min: 0.5, max: 1, totalCount: Number(rows[0].t_0_5_1), imageCount: Number(rows[0].i_0_5_1) },
        { label: "1 – 1.5", min: 1, max: 1.5, totalCount: Number(rows[0].t_1_1_5), imageCount: Number(rows[0].i_1_1_5) },
        { label: "1.5 – 2", min: 1.5, max: 2, totalCount: Number(rows[0].t_1_5_2), imageCount: Number(rows[0].i_1_5_2) },
        { label: "2 – 2.5", min: 2, max: 2.5, totalCount: Number(rows[0].t_2_2_5), imageCount: Number(rows[0].i_2_2_5) },
        { label: "2.5 – 3", min: 2.5, max: 3, totalCount: Number(rows[0].t_2_5_3), imageCount: Number(rows[0].i_2_5_3) },
        { label: "> 3", min: 3, max: 100, totalCount: Number(rows[0].t_gt_3), imageCount: Number(rows[0].i_gt_3) }
      ]
    });

  } catch (err) {
    console.error("PPM SUMMARY ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message
    });
  }
};

export const addSpecialChlorineDataEntry = async (req, res) => {
  console.log("Incoming SPECIAL chlorine data:", req.body);

  try {
    const db = await dbPromise;

    // ====================================================
    // ??  ROLE FROM SESSION
    // ====================================================
    const role = req.body.role;


    if (!role || !['special_user', 'DHO', 'chl_admin'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      ppm,
      actualPPM,
      base64Image,
      latitude,
      longitude,
      timestamp,
      samplingPoint,
      user_id,
      username,
      address
    } = req.body;

    // ====================================================
    // VALIDATION
    // ====================================================
    if (
      !ppm || !base64Image || !latitude || !longitude || !timestamp ||
      !samplingPoint || !user_id || !username || !address
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // ====================================================
    // NORMALIZE SAMPLING POINT
    // ====================================================
    const normalizedSamplingPoint = samplingPoint.trim().toUpperCase();

    if (!['TAIL', 'MID', 'OHT', 'GLR', 'SUMP'].includes(normalizedSamplingPoint)) {
      return res.status(400).json({
        message: 'Invalid samplingPoint. Use TAIL, MID, OHT, GLR, or SUMP.'
      });
    }

    const ppmValue = parseFloat(ppm);
    const actual = actualPPM ? parseFloat(actualPPM) : null;

    // ====================================================
    // FORMAT TIMESTAMP
    // ====================================================
    const mysqlTimestamp = formatToDDMMYYYY(String(timestamp));

    if (!mysqlTimestamp) {
      return res.status(400).json({ message: "Invalid timestamp format" });
    }

    // ====================================================
    // BASE64 ? BUFFER
    // ====================================================
    const cleanedBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "").trim();
    const buffer = Buffer.from(cleanedBase64, "base64");

    // ====================================================
    // IMAGE COMPRESSION
    // ====================================================
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    const filename = `chlorine_special_${Date.now()}.jpg`;
    const fullPath = path.join(uploadsDir, filename);
    const storedPath = `/uploads/${filename}`;

    let quality = 80;
    let compressedBuffer;

    while (quality > 10) {
      compressedBuffer = await sharp(buffer, { failOnError: false })
        .rotate()
        .jpeg({ quality })
        .toBuffer();

      if (compressedBuffer.length <= 150 * 1024) break;
      quality -= 10;
    }

    fs.writeFileSync(fullPath, compressedBuffer);

    // ====================================================
    // AUTO DELETE AFTER 7 DAYS
    // ====================================================
    setTimeout(() => {
      if (fs.existsSync(fullPath)) fs.unlink(fullPath, () => { });
    }, 7 * 24 * 60 * 60 * 1000);

    // ====================================================
    // INSERT INTO DATABASE (NO special_id/name)
    // ====================================================
    const query = `
      INSERT INTO chlorine_special_data_collection
      (ppm, actualPPM, samplingPoint, image_path, latitude, longitude, timestamp,
       user_id, username, role, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.execute(query, [
      ppmValue,
      actual,
      normalizedSamplingPoint,
      storedPath,
      latitude,
      longitude,
      mysqlTimestamp,
      user_id,
      username,
      role,
      address
    ]);

    return res.status(201).json({
      message: "Special chlorine data stored successfully",
      compressedImageSize: compressedBuffer.length
    });

  } catch (err) {
    console.error("addSpecialChlorineDataEntry error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getSpecialChlorineData = async (req, res) => {
  try {
    const db = await dbPromise;

    // âœ… Read from query instead of session
    const { role, date } = req.query;

    // âœ… Same role validation (unchanged logic)
    if (!role || !['special_user', 'DHO', 'chl_admin'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let query = `
      SELECT 
        id,
        ppm,
        actualPPM,
        samplingPoint,
        image_path,
        latitude,
        longitude,
        timestamp,
        user_id,
        username,
        role,
        address
      FROM chlorine_special_data_collection
      WHERE 1=1
    `;

    const params = [];

    // âœ… Same date filter
    if (date) {
      query += ` AND DATE(timestamp) = ?`;
      params.push(date);
    }

    query += ` ORDER BY id DESC`;

    const [rows] = await db.execute(query, params);

    return res.status(200).json({
      count: rows.length,
      data: rows
    });

  } catch (err) {
    console.error("getSpecialChlorineData error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};


/* =====================================================
   ADD BLOCK CHLORINE DATA
===================================================== */

export const addBlockChlorineUserDataEntry = async (req, res) => {
  console.log("Incoming BLOCK chlorine data:", req.body);

  try {
    const db = await dbPromise;

    const {
      ppm,
      actualPPM,
      base64Image,
      latitude,
      longitude,
      timestamp,      // VARCHAR -> store directly
      samplingPoint,
      address,
      user_id,
      username,
      role,
      hud_id,
      hud_name,
      block_id,
      block_name
    } = req.body;

    /* ================= VALIDATION ================= */

    if (
      !ppm || !base64Image || !latitude || !longitude || !timestamp ||
      !samplingPoint || !address || !block_id || !block_name || !role
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedSamplingPoint = samplingPoint.trim().toUpperCase();

    if (!["TAIL", "MID", "OHT", "GLR", "SUMP"].includes(normalizedSamplingPoint)) {
      return res.status(400).json({ message: "Invalid samplingPoint" });
    }

    const ppmValue = parseFloat(ppm);
    const actual = actualPPM ? parseFloat(actualPPM) : null;

    /* =====================================================
       ? IMPORTANT
       VARCHAR timestamp ? DO NOT CONVERT
    ===================================================== */

    const mysqlTimestamp = timestamp;

    /* ================= IMAGE PROCESS ================= */

    const cleanedBase64 = base64Image
      .replace(/^data:image\/\w+;base64,/, "")
      .trim();

    const buffer = Buffer.from(cleanedBase64, "base64");

    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    const filename = `chlorine_block_${Date.now()}.jpg`;
    const fullPath = path.join(uploadsDir, filename);
    const storedPath = `/uploads/${filename}`;

    let quality = 80;
    let compressedBuffer;

    while (quality > 10) {
      compressedBuffer = await sharp(buffer, { failOnError: false })
        .rotate()
        .jpeg({ quality })
        .toBuffer();

      if (compressedBuffer.length <= 150 * 1024) break;
      quality -= 10;
    }

    fs.writeFileSync(fullPath, compressedBuffer);

    /* ================= AUTO DELETE AFTER 7 DAYS ================= */

    setTimeout(() => {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }, 7 * 24 * 60 * 60 * 1000);

    /* ================= INSERT DATABASE ================= */

    const query = `
      INSERT INTO chlorine_block_data_collection
      (ppm, actualPPM, samplingPoint, image_path, latitude, longitude, timestamp,
       hud_id, hud_name, block_id, block_name, user_id, username, role, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.execute(query, [
      ppmValue,
      actual,
      normalizedSamplingPoint,
      storedPath,
      latitude,
      longitude,
      mysqlTimestamp,
      hud_id ?? "",
      hud_name ?? "",
      block_id,
      block_name,
      user_id,
      username,
      role,
      address
    ]);

    return res.status(201).json({
      message: "Block chlorine data stored successfully"
    });

  } catch (err) {
    console.error("addBlockChlorineUserDataEntry error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET BLOCK CHLORINE DATA
===================================================== */

export const getBlockChlorineData = async (req, res) => {
  try {
    const db = await dbPromise;

    const { block_id, date } = req.query;

    let query = `
      SELECT *
      FROM chlorine_block_data_collection
      WHERE 1=1
    `;

    const params = [];

    /* ===== filter by block ===== */
    if (block_id) {
      query += ` AND block_id = ?`;
      params.push(block_id);
    }

    /* ===== filter by date ===== */
    if (date) {
      query += ` AND timestamp LIKE ?`;
      params.push(`${date}%`);
    }

    query += ` ORDER BY id DESC`;

    const [rows] = await db.execute(query, params);

    return res.status(200).json({
      count: rows.length,
      data: rows
    });

  } catch (err) {
    console.error("getBlockChlorineData error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getHudBlockChlorineData = async (req, res) => {
  try {
    const db = await dbPromise;

    const { hud_id } = req.query;

    if (!hud_id) {
      return res.status(400).json({
        message: "hud_id is required",
      });
    }

    let query = `
      SELECT *
      FROM chlorine_block_data_collection
      WHERE hud_id = ?
      ORDER BY id DESC
    `;

    const [rows] = await db.execute(query, [hud_id]);

    return res.status(200).json({
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("getHudBlockChlorineData error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};



export const getHouseIndexCategorySummary = async (req, res) => {
  try {
    const db = await dbPromise;
    const { from_date, to_date } = req.query;

    let whereClause = "";
    const params = [];

    if (from_date && to_date) {
      whereClause = "WHERE DATE(created_at) BETWEEN ? AND ?";
      params.push(from_date, to_date);
    }

    const [entries] = await db.query(
      `
      SELECT
        created_at,
        district_name,   -- HUD
        block_name,
        phc_name,
        active_larval_source_count
      FROM larva_entries
      ${whereClause}
      `,
      params
    );

    /* ================= GROUP MAP ================= */
    const groupMap = {};

    entries.forEach((e) => {
      const date = new Date(e.created_at).toISOString().split("T")[0];
      const phcKey = e.phc_name || "NO_PHC";
      const key = `${date}|${e.district_name}|${e.block_name}|${phcKey}`;

      if (!groupMap[key]) {
        groupMap[key] = {
          date,
          hud_name: e.district_name,
          block_name: e.block_name,
          phc_name: phcKey,
          houses_inspected: 0,
          positive_houses: 0,
        };
      }

      groupMap[key].houses_inspected += 1;
      if (Number(e.active_larval_source_count) > 0) {
        groupMap[key].positive_houses += 1;
      }
    });

    /* ================= SUMMARY ================= */
    const summary = {
      lt5: { label: "House Index < 5", count: 0 },
      gt5: { label: "House Index = 5 & < 10", count: 0 },
      gt10: { label: "House Index = 10 & < 15", count: 0 },
      gt15: { label: "House Index = 15", count: 0 },
      total_groups: 0,
    };

    const hud_counts = {
      lt5: {},
      gt5: {},
      gt10: {},
      gt15: {},
    };

    const details = [];

    Object.values(groupMap).forEach((g) => {
      const hi =
        g.houses_inspected > 0
          ? Math.round((g.positive_houses / g.houses_inspected) * 100)
          : 0;

      let category = "lt5";
      summary.total_groups += 1;

      if (hi < 5) summary.lt5.count += 1;
      else if (hi < 10) {
        summary.gt5.count += 1;
        category = "gt5";
      } else if (hi < 15) {
        summary.gt10.count += 1;
        category = "gt10";
      } else {
        summary.gt15.count += 1;
        category = "gt15";
      }

      hud_counts[category][g.hud_name] =
        (hud_counts[category][g.hud_name] || 0) + 1;

      details.push({
        date: g.date,
        hud_name: g.hud_name,
        block_name: g.block_name,
        phc_name: g.phc_name,
        hi,
        category,
      });
    });

    return res.json({
      status: "success",
      data: {
        summary,
        hud_counts,
        details,
      },
    });
  } catch (error) {
    console.error("House Index Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch house index summary",
    });
  }
};

export const getHiHudSummaryToday = async (req, res) => {
  try {
    const db = await dbPromise;

    /* ================= TODAY ================= */
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    /* ================= HI MASTER ================= */
    const [hiUsers] = await db.query(`
      SELECT
        user_id,
        username,
        block_name,
        hud_id,
        hud_name
      FROM village_users
      WHERE role = 'hi_user'
    `);

    /* ================= TODAY ACTIVITY ================= */
    const [activity] = await db.query(
      `
      SELECT DISTINCT user_id
      FROM (
        SELECT user_id, timestamp FROM chlorine_hud_data_collection
        UNION ALL
        SELECT user_id, timestamp FROM chlorine_hud_data_collection_new
      ) AS combined
      WHERE DATE(
        STR_TO_DATE(SUBSTRING_INDEX(timestamp, ',', 1), '%d/%m/%Y')
      ) = ?
      `,
      [today]
    );

    const activeSet = new Set(activity.map(a => a.user_id));

    /* ================= HUD GROUP ================= */
    const hudMap = {};

    hiUsers.forEach(hi => {
      if (!hudMap[hi.hud_id]) {
        hudMap[hi.hud_id] = {
          hud_id: hi.hud_id,
          hud_name: hi.hud_name,
          total_hi: 0,
          active_hi: 0,
          inactive_hi: 0,
        };
      }

      hudMap[hi.hud_id].total_hi += 1;

      if (activeSet.has(hi.user_id)) {
        hudMap[hi.hud_id].active_hi += 1;
      } else {
        hudMap[hi.hud_id].inactive_hi += 1;
      }
    });

    return res.json({
      status: "success",
      date: today,
      data: Object.values(hudMap),
    });
  } catch (err) {
    console.error("HI HUD SUMMARY ERROR:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch HI HUD summary",
    });
  }
};

export const getActiveHiDetails = async (req, res) => {
  try {
    const db = await dbPromise;
    const { hud_id, from_date, to_date } = req.query;

    const from = from_date || new Date().toISOString().split("T")[0];
    const to = to_date || from;

    const [rows] = await db.query(
      `
      SELECT DISTINCT
        v.user_id,
        v.username,
        v.email,
        v.phone_number,
        v.block_name,
        v.hud_id,
        v.hud_name,
        MAX(
          STR_TO_DATE(c.timestamp, '%d/%m/%Y, %h:%i:%s')
        ) AS last_activity_time
      FROM village_users v
      INNER JOIN (
        SELECT user_id, timestamp FROM chlorine_hud_data_collection
        UNION ALL
        SELECT user_id, timestamp FROM chlorine_hud_data_collection_new
      ) c
        ON c.user_id = v.user_id
      WHERE v.role = 'hi_user'
        AND v.hud_id = ?
        AND DATE(STR_TO_DATE(SUBSTRING_INDEX(c.timestamp, ',', 1), '%d/%m/%Y')) BETWEEN ? AND ?
      GROUP BY
        v.user_id,
        v.username,
        v.email,
        v.phone_number,
        v.block_name,
        v.hud_id,
        v.hud_name
      ORDER BY last_activity_time DESC
      `,
      [hud_id, from, to]
    );

    res.json({
      status: "success",
      type: "active",
      from_date: from,
      to_date: to,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("ACTIVE HI DETAILS ERROR:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch active HI details",
    });
  }
};

export const getInactiveHiDetails = async (req, res) => {
  try {
    const db = await dbPromise;
    const { hud_id, from_date, to_date } = req.query;

    const from = from_date || new Date().toISOString().split("T")[0];
    const to = to_date || from;

    const [rows] = await db.query(
      `
      SELECT
        v.user_id,
        v.username,
        v.email,
        v.phone_number,
        v.block_name,
        v.hud_id,
        v.hud_name
      FROM village_users v
      LEFT JOIN (
        SELECT user_id, timestamp FROM chlorine_hud_data_collection
        UNION ALL
        SELECT user_id, timestamp FROM chlorine_hud_data_collection_new
      ) c
        ON c.user_id = v.user_id
        AND DATE(STR_TO_DATE(SUBSTRING_INDEX(c.timestamp, ',', 1), '%d/%m/%Y')) BETWEEN ? AND ?
      WHERE v.role = 'hi_user'
        AND v.hud_id = ?
        AND c.user_id IS NULL
      ORDER BY v.block_name, v.username
      `,
      [from, to, hud_id]
    );

    res.json({
      status: "success",
      type: "inactive",
      from_date: from,
      to_date: to,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("INACTIVE HI DETAILS ERROR:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch inactive HI details",
    });
  }
};

export const getFilteredHudHiSummary = async (req, res) => {
  try {
    const db = await dbPromise;

    const { hud_id, from_date, to_date } = req.query;

    if (!hud_id) {
      return res.status(400).json({
        status: "error",
        message: "hud_id is required",
      });
    }

    const from = from_date || new Date().toISOString().split("T")[0];
    const to = to_date || from;

    const [rows] = await db.query(
      `
      SELECT
        v.hud_id,
        v.hud_name,
        COUNT(DISTINCT v.user_id) AS total_hi,
        COUNT(DISTINCT c.user_id) AS active_hi,
        COUNT(DISTINCT v.user_id) - COUNT(DISTINCT c.user_id) AS inactive_hi
      FROM village_users v
      LEFT JOIN (
        SELECT user_id, timestamp FROM chlorine_hud_data_collection
        UNION ALL
        SELECT user_id, timestamp FROM chlorine_hud_data_collection_new
      ) c
        ON c.user_id = v.user_id
        AND DATE(
          COALESCE(
            STR_TO_DATE(c.timestamp, '%d/%m/%Y, %H:%i:%s'),
            STR_TO_DATE(c.timestamp, '%d/%m/%Y, %h:%i:%s')
          )
        ) BETWEEN ? AND ?
      WHERE v.role = 'hi_user'
        AND v.hud_id = ?
      GROUP BY v.hud_id, v.hud_name
      `,
      [from, to, hud_id]
    );

    res.json({ status: "success", data: rows });
  } catch (err) {
    console.error("HUD HI summary error:", err);
    res.status(500).json({ status: "error" });
  }
};

export const getFilteredActiveHiDetails = async (req, res) => {
  try {
    const db = await dbPromise;

    const { hud_id, from_date, to_date } = req.query;
    if (!hud_id) {
      return res.status(400).json({ status: "error", message: "hud_id required" });
    }

    const from = from_date || new Date().toISOString().split("T")[0];
    const to = to_date || from;

    const [rows] = await db.query(
      `
      SELECT DISTINCT
        v.user_id,
        v.username,
        v.email,
        v.phone_number,
        v.block_name,
        v.hud_name
      FROM village_users v
      INNER JOIN (
        SELECT user_id, timestamp FROM chlorine_hud_data_collection
        UNION ALL
        SELECT user_id, timestamp FROM chlorine_hud_data_collection_new
      ) c
        ON c.user_id = v.user_id
      WHERE v.hud_id = ?
        AND DATE(
          COALESCE(
            STR_TO_DATE(c.timestamp, '%d/%m/%Y, %H:%i:%s'),
            STR_TO_DATE(c.timestamp, '%d/%m/%Y, %h:%i:%s')
          )
        ) BETWEEN ? AND ?
      `,
      [hud_id, from, to]
    );

    res.json({ status: "success", data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error" });
  }
};


export const getFilteredInactiveHiDetails = async (req, res) => {
  try {
    const db = await dbPromise;

    const { hud_id, from_date, to_date } = req.query;
    if (!hud_id) {
      return res.status(400).json({ status: "error", message: "hud_id required" });
    }

    const from = from_date || new Date().toISOString().split("T")[0];
    const to = to_date || from;

    const [rows] = await db.query(
      `
      SELECT
        v.user_id,
        v.username,
        v.email,
        v.phone_number,
        v.block_name,
        v.hud_name
      FROM village_users v
      WHERE v.hud_id = ?
        AND v.user_id NOT IN (
          SELECT DISTINCT user_id
          FROM (
            SELECT user_id, timestamp FROM chlorine_hud_data_collection
            UNION ALL
            SELECT user_id, timestamp FROM chlorine_hud_data_collection_new
          ) c
          WHERE DATE(
            COALESCE(
              STR_TO_DATE(c.timestamp, '%d/%m/%Y, %H:%i:%s'),
              STR_TO_DATE(c.timestamp, '%d/%m/%Y, %h:%i:%s')
            )
          ) BETWEEN ? AND ?
        )
      `,
      [hud_id, from, to]
    );

    res.json({ status: "success", data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error" });
  }
};

// Add this to your backend controller file

export const getUserOverallCounts = async (req, res) => {
  try {
    const db = await dbPromise;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ message: "user_id is required" });
    }

    // 1. DBC Counts (pulling from the correct dbc_hi_monitoring table)
    const [dbcRows] = await db.query(`
      SELECT 
        COUNT(*) AS totalDBC,
        COALESCE(SUM(DATE(timestamp) = CURDATE()), 0) AS todayDBC
      FROM dbc_hi_monitoring 
      WHERE user_id = ?
    `, [user_id]);

    // 2. Larva Counts (pulling from larva_entries)
    const [larvaRows] = await db.query(`
      SELECT 
        COUNT(*) AS totalLarva,
        COALESCE(SUM(DATE(submitted_at) = CURDATE()), 0) AS todayLarva
      FROM larva_entries 
      WHERE user_id = ?
    `, [user_id]);

    // 3. Action Taken Counts (pulling from larva_entries where action is taken)
    const [actionRows] = await db.query(`
      SELECT 
        COUNT(*) AS totalAction,
        COALESCE(SUM(DATE(submitted_at) = CURDATE()), 0) AS todayAction
      FROM larva_entries 
      WHERE user_id = ? AND action_taken IS NOT NULL AND TRIM(action_taken) <> ''
    `, [user_id]);

    return res.json({
      success: true,
      data: {
        dbc: {
          overall: Number(dbcRows[0]?.totalDBC || 0),
          today: Number(dbcRows[0]?.todayDBC || 0)
        },
        larva: {
          overall: Number(larvaRows[0]?.totalLarva || 0),
          today: Number(larvaRows[0]?.todayLarva || 0)
        },
        action: {
          overall: Number(actionRows[0]?.totalAction || 0),
          today: Number(actionRows[0]?.todayAction || 0)
        }
      }
    });

  } catch (error) {
    console.error("getUserOverallCounts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};


export const getLarvaCounts = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ message: "user_id is required" });
  }

  try {
    const query = `
      SELECT 
        DATE_FORMAT(submitted_at, '%d-%m-%Y') as date, 
        COUNT(*) as count
      FROM larva_entries
      WHERE user_id = ?
      GROUP BY DATE(submitted_at)
    `;
    const [rows] = await db.execute(query, [user_id]);

    const result = {};
    rows.forEach(row => {
      result[row.date] = row.count;
    });

    return res.json(result);
  } catch (err) {
    console.error("getLarvaCounts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getActionCounts = async (req, res) => {
  const db = await dbPromise;
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ message: "user_id is required" });
  }

  try {
    // Counts entries where an action was taken
    const query = `
      SELECT 
        DATE_FORMAT(submitted_at, '%d-%m-%Y') as date, 
        COUNT(*) as count
      FROM larva_entries
      WHERE user_id = ? 
        AND action_taken IS NOT NULL 
        AND TRIM(action_taken) <> ''
      GROUP BY DATE(submitted_at)
    `;
    const [rows] = await db.execute(query, [user_id]);

    const result = {};
    rows.forEach(row => {
      result[row.date] = row.count;
    });

    return res.json(result);
  } catch (err) {
    console.error("getActionCounts error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


