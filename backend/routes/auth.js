// /backend/routes/auth.js
import express from "express";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import crypto from "crypto";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { logActivity } from "../utils/activityLogger.js";
import db from "../config/db.js"; // promise-based pool

dotenv.config();
const router = express.Router();

// Ensure table for tracking active sessions exists
db.query(`CREATE TABLE IF NOT EXISTS user_sessions (
  user_id INT PRIMARY KEY,
  session_id VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`).catch((err) => console.error("user_sessions table error:", err));

// -----------------------------
// Utilities
// -----------------------------
const generateResetToken = () => crypto.randomBytes(32).toString("hex");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// -----------------------------
// CREATE BUILT-IN ADMIN
// -----------------------------
const createAdmin = async () => {
  try {
    const adminEmail = "admin@eteeap.com";
    const adminPassword = "Admin123";
    const adminFullname = "Administrator";
    const adminRole = "admin";

    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [adminEmail]);
    if (existing.length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const [result] = await db.query(
        "INSERT INTO users (fullname, email, password, role) VALUES (?, ?, ?, ?)",
        [adminFullname, adminEmail, hashedPassword, adminRole]
      );
      console.log("Built-in admin account created:", adminEmail);
      await logActivity(result.insertId, "admin", "create_admin", `Admin account created: ${adminEmail}`);
    } else {
      console.log("Admin account already exists:", adminEmail);
    }
  } catch (err) {
    console.error("Create admin error:", err);
  }
};

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    done(null, rows[0]);
  } catch (err) {
    done(err, null);
  }
});

// -----------------------------
// SIGNUP
// -----------------------------
router.post("/signup", async (req, res) => {
  const { fullname, email, password } = req.body;
  if (!fullname || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      "INSERT INTO users (fullname, email, password, role) VALUES (?, ?, ?, ?)",
      [fullname, email, hashedPassword, "user"]
    );

    // fetch created user
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
    const newUser = rows[0];

    // Auto-login the new user (establish session)
    req.login(newUser, async (err) => {
      if (err) {
        console.error('req.login error during signup:', err);
        // still return success but ask user to login
        await logActivity(result.insertId, "user", "signup", `User signed up but login failed: ${email}`);
        return res.json({ success: true, message: "Signup successful! Please login." });
      }

      // Enforce single active session for signup too
      try {
        const [rows] = await db.query("SELECT session_id FROM user_sessions WHERE user_id = ?", [newUser.id]);
        if (rows.length > 0 && rows[0].session_id && rows[0].session_id !== req.sessionID) {
          try { req.sessionStore.destroy(rows[0].session_id, () => {}); } catch (e) { console.error('destroy prev session on signup', e); }
        }
        await db.query("INSERT INTO user_sessions (user_id, session_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE session_id = VALUES(session_id)", [newUser.id, req.sessionID]);
      } catch (e) {
        console.error('user_sessions update error (signup):', e);
      }

      try {
        await logActivity(result.insertId, "user", "signup", `User signed up: ${email}`);
      } catch (e) {
        console.error('logActivity error after signup:', e);
      }

      // remove sensitive fields
      if (newUser.password) delete newUser.password;

      res.json({ success: true, message: "Signup successful", user: newUser });
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// LOGIN
// -----------------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0)
      return res.status(401).json({ message: "Invalid email or password" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid email or password" });

    delete user.password;

    // Establish session manually to avoid passport session regenerate errors
    try {
      const safeUser = { ...user };
      if (safeUser.password) delete safeUser.password;
      if (req.session) req.session.user = safeUser;

      // Enforce single active session: destroy previous session if exists
      try {
        const [rows] = await db.query("SELECT session_id FROM user_sessions WHERE user_id = ?", [user.id]);
        if (rows.length > 0 && rows[0].session_id && rows[0].session_id !== req.sessionID) {
          try { req.sessionStore.destroy(rows[0].session_id, () => {}); } catch (e) { console.error('destroy prev session', e); }
        }
        await db.query("INSERT INTO user_sessions (user_id, session_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE session_id = VALUES(session_id)", [user.id, req.sessionID]);
      } catch (e) {
        console.error('user_sessions update error:', e);
      }

      try {
        await logActivity(user.id, user.role, "login", "User logged in");
      } catch (e) {
        console.error("logActivity error after login:", e);
      }

      res.json({ success: true, message: "Login successful", user: safeUser });
    } catch (errLogin) {
      console.error('login session error:', errLogin);
      res.status(500).json({ message: 'Login failed' });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// LOGOUT
router.post('/logout', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (userId) {
      await db.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
    }

    req.logout(() => {});
    try { req.session.destroy(() => {}); } catch (e) {}
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

// -----------------------------
// CHECK EMAIL LOGIN
// -----------------------------
router.post("/check-email", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ exists: false, message: "Email required" });

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length > 0) {
      const user = rows[0];
      delete user.password;
      delete user.google_id;
      delete user.reset_token;
      delete user.reset_token_expires;
      delete user.reset_expires;

      res.json({ exists: true, user });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error("Check-email error:", err);
    res.status(500).json({ exists: false, message: "Server error" });
  }
});

// -----------------------------
// FORGOT PASSWORD
// -----------------------------
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0)
      return res.status(404).json({ message: "Email not found" });

    const user = rows[0];
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await db.query(
      "INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, token, expiresAt]
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    // Custom sender
    const mailOptions = {
      from: `"LCCB ETEEAP Support" <no-reply@lccb-eteeap.com>`,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <p>Hello ${user.fullname},</p>
        <p>You requested a password reset. Click the link below:</p>
        <a href="${resetUrl}" target="_blank">Reset Password</a>
        <p>This link expires in 1 hour.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    await logActivity(
      user.id,
      user.role,
      "forgot_password_email_sent",
      "Sent password reset email"
    );

    res.json({ success: true, message: "Reset link sent to your email." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// RESET PASSWORD
// -----------------------------
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ message: "Token and new password required" });

  try {
    const [rows] = await db.query("SELECT * FROM password_resets WHERE token = ?", [token]);
    if (rows.length === 0)
      return res.status(400).json({ message: "Invalid or expired token" });

    const resetRecord = rows[0];
    if (new Date(resetRecord.expires_at) < new Date())
      return res.status(400).json({ message: "Token has expired" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, resetRecord.user_id]);
    await db.query("DELETE FROM password_resets WHERE id = ?", [resetRecord.id]);

    await logActivity(resetRecord.user_id, "user", "reset_password", "User reset password via token");

    res.json({ success: true, message: "Password successfully updated!" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// GOOGLE OAUTH ROUTES
// -----------------------------
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], prompt: "select_account" })
);

// Signup entrypoint: start Google OAuth and include a state flag so the callback can detect signup
router.get('/google/signup', (req, res, next) => {
  try {
    if (req.session) req.session.googleSignup = true; // best-effort fallback
  } catch (e) {
    // ignore
  }

  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account', state: 'signup' })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  const isSignup = (req.query && req.query.signup === 'true') || (req.query && req.query.state === 'signup') || (req.session && req.session.googleSignup);

  // Always create a session on successful OAuth so frontend can treat the user as logged in
  passport.authenticate('google', { failureRedirect: '/auth/failure', session: true }, async (err, user, info) => {
    try {
      if (err) throw err;
      if (!user) {
        res.send(`
          <script>
            window.opener.postMessage({ message: "Email not registered or Google Authentication Failed" }, "*");
            window.close();
          </script>
        `);
        return;
      }

      if (isSignup) {
        // Signup completed: establish session manually and send user to opener
        try {
          const safeUser = { ...user };
          if (safeUser.password) delete safeUser.password;
          if (req.session) req.session.user = safeUser;
          // Enforce single active session for Google signup as well
          try {
            const [rows] = await db.query("SELECT session_id FROM user_sessions WHERE user_id = ?", [user.id]);
            if (rows.length > 0 && rows[0].session_id && rows[0].session_id !== req.sessionID) {
              try { req.sessionStore.destroy(rows[0].session_id, () => {}); } catch (e) { console.error('destroy prev session (google signup)', e); }
            }
            await db.query("INSERT INTO user_sessions (user_id, session_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE session_id = VALUES(session_id)", [user.id, req.sessionID]);
          } catch (e) {
            console.error('user_sessions update error (google signup):', e);
          }
          try {
            await logActivity(user.id, user.role, 'google_signup', 'Google signup and auto-login');
          } catch (e) {
            console.error('logActivity error after google signup:', e);
          }

          res.send(`
            <script>
              window.opener.postMessage(${JSON.stringify(safeUser)}, "*");
              window.close();
            </script>
          `);
        } catch (e) {
          console.error('google signup session error:', e);
          res.send(`
            <script>
              window.opener.postMessage({ message: "Signup succeeded but login failed. Please login manually." }, "*");
              window.close();
            </script>
          `);
        }
        return;
      }

      // Normal login flow: establish session manually and send user to opener
      try {
        const safeUser = { ...user };
        if (safeUser.password) delete safeUser.password;
        if (req.session) req.session.user = safeUser;
        // Enforce single active session for Google login
        try {
          const [rows] = await db.query("SELECT session_id FROM user_sessions WHERE user_id = ?", [user.id]);
          if (rows.length > 0 && rows[0].session_id && rows[0].session_id !== req.sessionID) {
            try { req.sessionStore.destroy(rows[0].session_id, () => {}); } catch (e) { console.error('destroy prev session (google login)', e); }
          }
          await db.query("INSERT INTO user_sessions (user_id, session_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE session_id = VALUES(session_id)", [user.id, req.sessionID]);
        } catch (e) {
          console.error('user_sessions update error (google login):', e);
        }
        await logActivity(user.id, user.role, 'google_login_callback', 'Google login callback');

        res.send(`
          <script>
            window.opener.postMessage(${JSON.stringify(safeUser)}, "*");
            window.close();
          </script>
        `);
      } catch (e) {
        console.error('google login session error:', e);
        res.send(`
          <script>
            window.opener.postMessage({ message: "Login failed. Try again." }, "*");
            window.close();
          </script>
        `);
      }
    } catch (error) {
      console.error('Google callback error:', error);
      res.send(`
        <script>
          window.opener.postMessage({ message: "Login failed. Try again." }, "*");
          window.close();
        </script>
      `);
    }
  })(req, res, next);
});

router.get("/failure", (req, res) => {
  res.send(`
    <script>
      window.opener.postMessage({ message: "Email not registered or Google Authentication Failed" }, "*");
      window.close();
    </script>
  `);
});

export default router;