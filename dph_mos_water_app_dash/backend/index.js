import dotenv from "dotenv";
dotenv.config();
import 'dotenv/config';
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import cron from "node-cron";
import redisClient from "./redis.js";

// Routes
import loginRoute from "./routes/login.js";
import captchaRoute from "./routes/captcha.js";
import forgotPasswordRoute from "./routes/forgotPassword.js";
import dashboardRoute from "./routes/dashboard.js";
import authRoute from "./routes/auth.js";

// Middleware
import authMiddleware from "./middleware/auth.js";
import loginLimiter from "./middleware/loginLimiter.js";
import globalLimiter from "./middleware/globalLimiter.js";

// Utils
import { getInspectionPlan } from "./controllers/dashboardController.js";
import { initMidnightTransferJob } from "./cron/midnightTransfer.js";
import { cleanupExpiredSessions, getActiveSessionCount } from "./utils/tokenStore.js";

const app = express();

/* ======================================================
   __dirname (ES MODULE)
====================================================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ======================================================
   SECURITY HEADERS — Helmet
====================================================== */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "same-site" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "no-referrer" },
    xContentTypeOptions: true,
    xFrameOptions: { action: "deny" },
    xXssProtection: true,
  })
);

/* ======================================================
   CORS — LOCAL + PROD (NO *)
====================================================== */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8081",
  "http://192.168.1.89:5173",
  "http://192.168.1.89:8081",
  "http://192.168.1.145:5173",
  "http://192.168.1.145:8081",
  "http://10.0.2.2:8081",
  "http://localhost:3000"
];

const corsOptions = {
  origin: (origin, callback) => {
    // allow server-side / cron / postman
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS blocked"), false);
    }
  },
  credentials: true,  // Required for httpOnly cookies
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
};

app.use(cors(corsOptions));

/* ======================================================
   COOKIE PARSER (required for httpOnly JWT cookie)
====================================================== */
app.use(cookieParser());

/* ======================================================
   GLOBAL RATE LIMITER (2000 concurrent users)
====================================================== */
app.use(globalLimiter);

/* ======================================================
   STATIC UPLOADS
====================================================== */
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(
  "/uploads",
  (req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    next();
  },
  express.static(uploadDir)
);

/* ======================================================
   BODY PARSERS
====================================================== */
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ extended: true, limit: "150mb" }));

/* ======================================================
   HEALTH CHECK (no auth required)
====================================================== */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    activeSessions: getActiveSessionCount(),
    timestamp: new Date().toISOString(),
  });
});

/* ======================================================
   PUBLIC ROUTES (no authentication required)
====================================================== */
app.use("/login", loginLimiter, loginRoute);   // Rate-limited login
app.use("/captcha", captchaRoute);
app.use("/forgot-password", forgotPasswordRoute);

/* ======================================================
   AUTH ROUTES (logout / heartbeat / status)
====================================================== */
app.use("/auth", authRoute);

/* ======================================================
   PROTECTED ROUTES — JWT auth required
====================================================== */
app.use("/dashboard", authMiddleware, dashboardRoute);

/* ======================================================
   GLOBAL ERROR HANDLER
====================================================== */
app.use((err, req, res, next) => {
  // CORS errors
  if (err.message === "CORS blocked") {
    return res.status(403).json({ error: "CORS_BLOCKED", message: "Origin not allowed." });
  }
  console.error("❌ [Server] Unhandled error:", err);
  return res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error." });
});

/* ======================================================
   CRON — Daily inspection plan email
====================================================== */
cron.schedule("0 9 * * *", async () => {
  console.log("⏳ Running daily inspection plan email job...");
  await getInspectionPlan(
    {},
    {
      json: (data) => console.log("✅ Email job result:", data),
      status: () => ({
        json: (data) => console.error("❌ Email job error:", data),
      }),
    }
  );
});

/* ======================================================
   CRON — Session cleanup every 5 minutes
====================================================== */
cron.schedule("*/5 * * * *", () => {
  cleanupExpiredSessions();
  console.log(`🔄 [Session] Active sessions: ${getActiveSessionCount()}`);
});

initMidnightTransferJob();

/* ======================================================
   START SERVER
====================================================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`🔒 Security: Helmet + JWT + Rate Limiting ACTIVE`);
  console.log(`⏱️  Session idle timeout: ${(parseInt(process.env.SESSION_IDLE_TIMEOUT || '900000')) / 60000} minutes`);
  console.log(`📂 Uploads served from: ${uploadDir}`);
});
