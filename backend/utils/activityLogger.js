import db from "../config/db.js";

export async function logActivity(user_id, role, action, details) {
  try {
    // Only record administrative actions. Ignore any non-admin logs (signup/login/user actions).
    if (String(role).toLowerCase() !== "admin") {
      return; // silently ignore non-admin actions
    }

    if (!user_id) {
      console.warn("logActivity: admin action called without user_id; skipping");
      return;
    }

    // Verify the user_id belongs to an admin account to avoid logging forged headers
    const [rows] = await db.query("SELECT role FROM users WHERE id = ? LIMIT 1", [user_id]);
    if (!rows || rows.length === 0 || rows[0].role !== 'admin') {
      console.warn(`logActivity: user ${user_id} is not an admin; skipping log`);
      return;
    }

    await db.query(
      `INSERT INTO activity_logs (user_id, role, action, details) VALUES (?, ?, ?, ?)`,
      [user_id, 'admin', action, details]
    );
  } catch (err) {
    console.error("Activity Log Error:", err);
  }
}
