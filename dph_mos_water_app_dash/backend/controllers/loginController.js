import dbPromise from '../utils/db.js'; // Ensure this is your mysql2/promise connection file
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createSession, getActiveSessionCount } from '../utils/tokenStore.js';

/* ======================================================
   ACCOUNT LOCKOUT TRACKING (in-memory)
   Resets on server restart. For 2000 users this is sufficient.
====================================================== */
const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
const LOCKOUT_DURATION = parseInt(process.env.LOCKOUT_DURATION || '900000', 10); // 15 min

// Map<identifier, { attempts: number, lockedUntil: number|null }>
const failedAttempts = new Map();

function isLocked(identifier) {
  const record = failedAttempts.get(identifier);
  if (!record) return false;
  if (record.lockedUntil && Date.now() < record.lockedUntil) return true;
  return false;
}

function registerFailedAttempt(identifier) {
  const record = failedAttempts.get(identifier) || { attempts: 0, lockedUntil: null };
  record.attempts += 1;
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION;
    console.warn(`🔒 [LoginController] Account locked: ${identifier} — too many failed attempts.`);
  }
  failedAttempts.set(identifier, record);
  return record;
}

function clearFailedAttempts(identifier) {
  failedAttempts.delete(identifier);
}

/* ======================================================
   COOKIE OPTIONS
====================================================== */
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: parseInt(process.env.SESSION_IDLE_TIMEOUT || '900000', 10),
  path: '/',
});

/* ======================================================
   HELPER: Issue JWT and set httpOnly cookie
====================================================== */
function issueAuthToken(res, userPayload) {
  const jti = uuidv4();
  const token = jwt.sign(
    {
      user_id: userPayload.user_id,
      role:    userPayload.role,
      module:  userPayload.module,
      jti,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  // Register in token store (tracks idle timeout)
  createSession(userPayload.user_id, jti, userPayload.role, userPayload.module);

  // Set secure httpOnly cookie
  res.cookie('jwt_token', token, getCookieOptions());

  console.log(`✅ [Auth] Token issued for user ${userPayload.user_id} (${userPayload.role}). Active sessions: ${getActiveSessionCount()}`);

  return jti;
}

const handleLogin = async (req, res) => {
  const emailOrUserIdOrUsername = req.body.email || req.body.username || req.body.user_id;
  const { password } = req.body;

  if (!emailOrUserIdOrUsername || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  // ── Account lockout check ────────────────────────────────────────────────
  if (isLocked(emailOrUserIdOrUsername)) {
    const record = failedAttempts.get(emailOrUserIdOrUsername);
    const remainingSec = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return res.status(423).json({
      error: 'ACCOUNT_LOCKED',
      message: `Account temporarily locked due to too many failed attempts. Try again in ${Math.ceil(remainingSec / 60)} minute(s).`,
      retryAfterSeconds: remainingSec,
    });
  }

  console.log('🔐 [Login] Attempting login for:', emailOrUserIdOrUsername);
    try {
    const db = await dbPromise; // get the connection

    // Utility to fetch first row:
    const getFirstRow = (rows) => (rows.length > 0 ? rows[0] : null);

    // 1. Admin user
    const [adminRows] = await db.execute(`
      SELECT * FROM admin_users WHERE email = ? OR username = ? OR user_id = ?
    `, [emailOrUserIdOrUsername, emailOrUserIdOrUsername, emailOrUserIdOrUsername]);
    const adminUser = getFirstRow(adminRows);

    if (adminUser && bcrypt.compareSync(password, adminUser.password || adminUser.hashedPassword)) {
      clearFailedAttempts(emailOrUserIdOrUsername);
      const userPayload = {
        user_id: adminUser.user_id || null,
        email: adminUser.email,
        username: adminUser.username,
        role: adminUser.role,
        module: adminUser.module,
        district_name: adminUser.district_name || null,
        block_name: adminUser.block_name || null,
        hub_name: adminUser.hub_name || null,
        status: adminUser.status || 'active'
      };
      issueAuthToken(res, userPayload);
      return res.status(200).json({
        message: `${adminUser.module} ${adminUser.role} login successful`,
        user: userPayload,
      });
    }

    // ðŸ”¹ 1A. Developer User (SYSTEM / IMAGE DOWNLOADER)
const [devRows] = await db.execute(`
  SELECT * FROM developer_users
  WHERE email = ? OR username = ? OR user_id = ?
`, [
  emailOrUserIdOrUsername,
  emailOrUserIdOrUsername,
  emailOrUserIdOrUsername
]);

const developerUser = getFirstRow(devRows);

if (
  developerUser &&
  (developerUser.status === 'ACTIVE' || !developerUser.status) &&
  bcrypt.compareSync(password, developerUser.password)
) {
  clearFailedAttempts(emailOrUserIdOrUsername);
  const userPayload = {
    user_id: developerUser.user_id,
    email: developerUser.email,
    username: developerUser.username,
    role: developerUser.role || 'DEVELOPER',
    module: 'developer',
    status: developerUser.status || 'ACTIVE'
  };
  issueAuthToken(res, userPayload);
  return res.status(200).json({
    message: 'Developer login successful',
    user: userPayload,
  });
}


    // 2. Mosquito District Officer
    const [mosqRows] = await db.execute(`
      SELECT u.*, d.district_name FROM district_officer_table u
      JOIN mosquito_district_master d ON u.district_code = d.district_code
      WHERE u.email = ? OR u.username = ?
    `, [emailOrUserIdOrUsername, emailOrUserIdOrUsername]);
    const mosquitoUser = getFirstRow(mosqRows);

    if (mosquitoUser && bcrypt.compareSync(password, mosquitoUser.password || mosquitoUser.hashedPassword)) {
      clearFailedAttempts(emailOrUserIdOrUsername);
      const userPayload = {
        user_id: mosquitoUser.user_id,
        email: mosquitoUser.email,
        username: mosquitoUser.username,
        role: mosquitoUser.role || 'district_user',
        module: mosquitoUser.module || 'mosquito',
        district_name: mosquitoUser.district_name,
        status: mosquitoUser.status
      };
      issueAuthToken(res, userPayload);
      return res.status(200).json({ message: 'Mosquito district officer login successful', user: userPayload });
    }

    // 3. Mosquito Block User
    const [blockUserRows] = await db.execute(`
      SELECT * FROM mosquito_block_users WHERE email = ? OR username = ?
    `, [emailOrUserIdOrUsername, emailOrUserIdOrUsername]);
    const mosquitoBlockUser = getFirstRow(blockUserRows);

    if (mosquitoBlockUser && bcrypt.compareSync(password, mosquitoBlockUser.password)) {
      clearFailedAttempts(emailOrUserIdOrUsername);
      const userPayload = {
        user_id: mosquitoBlockUser.user_id,
        email: mosquitoBlockUser.email,
        username: mosquitoBlockUser.username,
        role: mosquitoBlockUser.role || 'block_user',
        module: mosquitoBlockUser.module || 'mosquito',
        district_name: mosquitoBlockUser.district_name,
        block_name: mosquitoBlockUser.block_name,
        block_id: mosquitoBlockUser.block_id,
        status: mosquitoBlockUser.status
      };
      issueAuthToken(res, userPayload);
      return res.status(200).json({ message: 'Mosquito block user login successful', user: userPayload });
    }

    // 4. Mosquito Corporation User
    const [corpRows] = await db.execute(`
      SELECT * FROM mosquito_corp_master_users WHERE email = ? OR username = ?
    `, [emailOrUserIdOrUsername, emailOrUserIdOrUsername]);
    const corpUser = getFirstRow(corpRows);

    if (corpUser && bcrypt.compareSync(password, corpUser.password)) {
      clearFailedAttempts(emailOrUserIdOrUsername);
      const userPayload = {
        user_id: corpUser.user_id,
        email: corpUser.email,
        username: corpUser.username,
        district_name: corpUser.district_name,
        corp_name: corpUser.corp_name,
        corporation_code: corpUser.corporation_code,
        role: corpUser.role,
        module: corpUser.module,
        status: corpUser.status
      };
      issueAuthToken(res, userPayload);
      return res.status(200).json({ message: 'Mosquito corporation user login successful', user: userPayload });
    }

    // 5. Municipality User
    const [munRows] = await db.execute(`
      SELECT * FROM mos_mun_master_users WHERE email = ? OR username = ?
    `, [emailOrUserIdOrUsername, emailOrUserIdOrUsername]);
    const munUser = getFirstRow(munRows);

    if (munUser && bcrypt.compareSync(password, munUser.password)) {
      clearFailedAttempts(emailOrUserIdOrUsername);
      const userPayload = {
        user_id: munUser.user_id,
        email: munUser.email,
        username: munUser.username,
        district_name: munUser.district_name,
        corp_name: munUser.corp_name,
        corporation_code: munUser.corporation_code,
        municipality_id: munUser.municipality_id,
        municipality_name: munUser.municipality_name,
        role: munUser.role || 'municipality_user',
        module: munUser.module || 'mosquito',
        status: munUser.status || 'active'
      };
      issueAuthToken(res, userPayload);
      return res.status(200).json({ message: 'Mosquito municipality user login successful', user: userPayload });
    }

    // 6. Chlorination Hub User

    const [chlRows] = await db.execute(`
      SELECT * FROM chlorination_hub_users WHERE email = ? OR username = ?
    `, [emailOrUserIdOrUsername, emailOrUserIdOrUsername]);
    const chlUser = getFirstRow(chlRows);

    if (chlUser && bcrypt.compareSync(password, chlUser.hashedPassword || chlUser.password)) {
      clearFailedAttempts(emailOrUserIdOrUsername);
      const userPayload = {
        user_id: chlUser.user_id,
        email: chlUser.email,
        username: chlUser.username,
        role: chlUser.role,
        module: chlUser.module,
        hub_id: chlUser.hub_id,
        status: chlUser.status
      };
      issueAuthToken(res, userPayload);
      return res.status(200).json({ message: `${chlUser.module} ${chlUser.role} login successful`, user: userPayload });
    }
    const [hudBlockRows] = await db.execute(`
      SELECT * FROM chl_hud_block_users WHERE email = ? OR username = ?
    `, [emailOrUserIdOrUsername, emailOrUserIdOrUsername]);
    const hudChlBlockUser = getFirstRow(hudBlockRows);

    if (hudChlBlockUser && bcrypt.compareSync(password, hudChlBlockUser.hashedPassword || hudChlBlockUser.password)) {
      clearFailedAttempts(emailOrUserIdOrUsername);
      const userPayload = {
        user_id: hudChlBlockUser.user_id,
        email: hudChlBlockUser.email,
        username: hudChlBlockUser.username,
        phone_number: hudChlBlockUser.phone_number,
        hud_id: hudChlBlockUser.hud_id,
        hud_name: hudChlBlockUser.hud_name,
        block_id: hudChlBlockUser.block_id,
        block_name: hudChlBlockUser.block_name,
        role: hudChlBlockUser.role || 'block_user',
        module: hudChlBlockUser.module || 'chlorination',
        status: hudChlBlockUser.status || 'active'
      };
      issueAuthToken(res, userPayload);
      return res.status(200).json({ message: 'chlorination hud block user login successful', user: userPayload });
    }



 const [hudRows] = await db.execute(`
      SELECT * FROM  hud_master_users WHERE email = ? OR username = ?
    `, [emailOrUserIdOrUsername, emailOrUserIdOrUsername]);

const chlorHudUser = getFirstRow(hudRows);
if (chlorHudUser) {
  console.log("ðŸ‘‰ HUD User Found:", {
    email: chlorHudUser.email,
    username: chlorHudUser.username  });

  if (bcrypt.compareSync(password, chlorHudUser.hashedPassword || chlorHudUser.password)) {
      clearFailedAttempts(emailOrUserIdOrUsername);
      const userPayload = {
        user_id: chlorHudUser.user_id,
        email: chlorHudUser.email,
        username: chlorHudUser.username,
        phone_number: chlorHudUser.phone_number,
        hud_id: chlorHudUser.hud_id,
        hud_name: chlorHudUser.hud_name,
        block_id: chlorHudUser.block_id,
        block_name: chlorHudUser.block_name,
        role: chlorHudUser.role || 'DHO',
        module: chlorHudUser.module || 'chlorination',
        status: chlorHudUser.status || 'active'
      };
      issueAuthToken(res, userPayload);
      return res.status(200).json({ message: 'chlorination hud user login successful', user: userPayload });
  } else {
    registerFailedAttempt(emailOrUserIdOrUsername);
    return res.status(401).json({ message: "Invalid password" });
  }
}
// If chlorHudUser is null, do not call compareSync here



    // 8. Chlorination Data Collector
    const [collectorRows] = await db.execute(`
      SELECT * FROM chlorination_data_collectors WHERE email = ? OR username = ?
    `, [emailOrUserIdOrUsername, emailOrUserIdOrUsername]);
    const collector = getFirstRow(collectorRows);

    if (collector && bcrypt.compareSync(password, collector.hashedPassword || collector.password)) {
      clearFailedAttempts(emailOrUserIdOrUsername);
      const userPayload = {
        user_id: collector.user_id,
        email: collector.email,
        username: collector.username,
        phone_number: collector.phone_number,
        role: 'RWAL_hi_user',
        module: 'chlorination',
        hub_id: collector.hub_id,
        hub_name: collector.hub_name,
        status: 'active'
      };
      issueAuthToken(res, userPayload);
      return res.status(200).json({ message: 'chlorination data_collector login successful', user: userPayload });
    }
// ðŸ”¹ New: Village Users (hi_user)
    const [villageRows] = await db.execute(`
      SELECT * FROM village_users WHERE (email = ? OR username = ?) AND role = 'hi_user'
    `, [emailOrUserIdOrUsername, emailOrUserIdOrUsername]);
    const villageUser = getFirstRow(villageRows);

    if (villageUser && bcrypt.compareSync(password, villageUser.hashedPassword || villageUser.password)) {
      clearFailedAttempts(emailOrUserIdOrUsername);
      const userPayload = {
        user_id: villageUser.user_id,
        email: villageUser.email,
        username: villageUser.username,
        phone_number: villageUser.phone_number,
        role: villageUser.role || 'hi_user',
        module: villageUser.module || 'chlorination',
        block_id: villageUser.block_id,
        block_name: villageUser.block_name,
        hud_id: villageUser.hud_id,
        hud_name: villageUser.hud_name,
        status: 'active'
      };
      issueAuthToken(res, userPayload);
      return res.status(200).json({ message: 'HUD village data_collector login successful', user: userPayload });
    }

    // ðŸ”¹ New: Mosquito Block Data Collectors
    const [mosBlockRows] = await db.execute(`
      SELECT * FROM mosquito_block_datacollector WHERE email = ? OR username = ?
    `, [emailOrUserIdOrUsername, emailOrUserIdOrUsername]);
    const mosBlockUser = getFirstRow(mosBlockRows);

    if (mosBlockUser && bcrypt.compareSync(password, mosBlockUser.hashedPassword || mosBlockUser.password)) {
      clearFailedAttempts(emailOrUserIdOrUsername);
      const userPayload = {
        user_id: mosBlockUser.user_id,
        email: mosBlockUser.email,
        username: mosBlockUser.username,
        phone_number: mosBlockUser.phone_number,
        role: mosBlockUser.role || 'hi_user',
        module: mosBlockUser.module || 'mosquito',
        district_id: mosBlockUser.district_id,
        district_name: mosBlockUser.district_name,
        block_id: mosBlockUser.block_id,
        block_name: mosBlockUser.block_name,
        status: mosBlockUser.status || 'Active'
      };
      issueAuthToken(res, userPayload);
      return res.status(200).json({ message: 'mosquito block data_collector login successful', user: userPayload });
    }
    // 9. --- NEW: Chlorination HUD Block Users ---

    // ── No user matched — register failed attempt ───────────────────────
    const attemptRecord = registerFailedAttempt(emailOrUserIdOrUsername);
    const remaining = MAX_ATTEMPTS - attemptRecord.attempts;

    if (attemptRecord.lockedUntil) {
      return res.status(423).json({
        error: 'ACCOUNT_LOCKED',
        message: `Too many failed attempts. Account locked for 15 minutes.`,
      });
    }

    return res.status(401).json({
      message: 'Invalid credentials.',
      attemptsRemaining: Math.max(0, remaining),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export default { handleLogin };