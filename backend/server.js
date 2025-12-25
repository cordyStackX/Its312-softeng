// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
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
    await logActivity(userId, 'client', action || 'log', details || '');
    res.json({ message: 'Logged' });
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
