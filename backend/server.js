// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import "./config/passport.js";
import mysql from "mysql2/promise";

// Import routes
import authRoutes from "./routes/auth.js";                  
import submitApplicationRoutes from "./config/submit_application.js";
import profileRoutes from "./routes/profile.js";
import adminRoutes from "./routes/admin.js";
import adminDashboardRoutes from "./routes/adminDashboard.js"; 
import notificationsRoutes from "./routes/notifications.js";
import { logActivity } from "./utils/activityLogger.js";

const app = express();
const port = process.env.PORT || 5000;

// MySQL connection pool
export const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "eteeap_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Ensure `req.user` is available when we set `req.session.user` manually
app.use((req, res, next) => {
  try {
    if (!req.user && req.session && req.session.user) req.user = req.session.user;
  } catch (e) {
    // ignore
  }
  next();
});

// Global middleware: enforce single active session per user
app.use(async (req, res, next) => {
  try {
    if (req.user && req.sessionID) {
      const [rows] = await db.query("SELECT session_id FROM user_sessions WHERE user_id = ?", [req.user.id]);
      if (rows.length > 0 && rows[0].session_id && rows[0].session_id !== req.sessionID) {
        // current session is not the active one -> log out
        try { req.logout(() => {}); } catch (e) {}
        try { req.session.destroy(() => {}); } catch (e) {}
      }
    }
  } catch (e) {
    console.error('session enforcement error:', e);
  }
  next();
});

// -----------------------------
// Routes
// -----------------------------
app.use("/auth", authRoutes);
app.use("/submit_application", submitApplicationRoutes);
app.use("/profile", profileRoutes);
app.use("/admin", adminRoutes);                      
app.use("/admin", adminDashboardRoutes);   // ✅ FIXED — now matches frontend
app.use("/notifications", notificationsRoutes);

// Serve uploads
app.use("/uploads", express.static("uploads"));

// Test endpoint
app.get("/", (req, res) => res.send("Backend is running!"));

// Client-side activity logging (convenience endpoint used by frontend)
app.post('/log_activity', async (req, res) => {
  try {
    const { action, details } = req.body || {};
    const userId = req.user?.id || req.headers['x-user-id'] || null;
    // Client-side activity logging is intentionally not persisted to the central activity log
    // to ensure only admin actions are recorded for audit purposes.
    res.json({ message: 'Received' });
  } catch (err) {
    console.error('log_activity error', err);
    res.status(500).json({ message: 'Failed to log activity' });
  }
});

// Fallback route
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Start server
app.listen(port, () => 
  console.log(`🚀 Server running on http://localhost:${port}`)
);

// Ensure trash table exists and purge old trashed items daily
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS applications_trash (
        id INT AUTO_INCREMENT PRIMARY KEY,
        original_id INT,
        program_name VARCHAR(255),
        full_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(100),
        marital_status VARCHAR(100),
        is_business_owner TINYINT(1),
        business_name VARCHAR(255),
        letter_of_intent VARCHAR(255),
        resume VARCHAR(255),
        picture VARCHAR(255),
        application_form VARCHAR(255),
        recommendation_letter VARCHAR(255),
        school_credentials VARCHAR(255),
        high_school_diploma VARCHAR(255),
        transcript VARCHAR(255),
        birth_certificate VARCHAR(255),
        employment_certificate VARCHAR(255),
        nbi_clearance VARCHAR(255),
        marriage_certificate VARCHAR(255),
        business_registration VARCHAR(255),
        certificates VARCHAR(255),
        created_at DATETIME,
        resume_status VARCHAR(50),
        resume_remark VARCHAR(255),
        status VARCHAR(50),
        data LONGTEXT,
        deleted_at DATETIME,
        INDEX (deleted_at)
      ) ENGINE=InnoDB;
    `);

    const purgeOld = async () => {
      try {
        const [result] = await db.query("DELETE FROM applications_trash WHERE deleted_at < (NOW() - INTERVAL 30 DAY)");
        if (result && result.affectedRows) {
          console.log(`Purged ${result.affectedRows} trashed applications older than 30 days`);
        }
      } catch (e) {
        console.error('Error purging old trashed applications', e);
      }
    };

    // Run once on startup
    await purgeOld();
    // Schedule daily purge (24h)
    setInterval(purgeOld, 24 * 60 * 60 * 1000);
  } catch (err) {
    console.error('Failed to ensure applications_trash table or start purge job', err);
  }
})();
 