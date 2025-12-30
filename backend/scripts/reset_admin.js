// backend/scripts/reset_admin.js
// Run with: node backend/scripts/reset_admin.js
import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

const adminEmail = process.env.ADMIN_EMAIL || 'admin@eteeap.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
const adminFullname = 'Administrator';
const adminRole = 'admin';

(async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'eteeap_db'
  });

  try {
    const [rows] = await conn.query('SELECT * FROM users WHERE email = ?', [adminEmail]);
    const hashed = await bcrypt.hash(adminPassword, 10);

    if (rows.length === 0) {
      await conn.query('INSERT INTO users (fullname, email, password, role) VALUES (?, ?, ?, ?)', [adminFullname, adminEmail, hashed, adminRole]);
      console.log('Admin account created:', adminEmail);
    } else {
      await conn.query('UPDATE users SET fullname = ?, password = ?, role = ? WHERE id = ?', [adminFullname, hashed, adminRole, rows[0].id]);
      console.log('Admin account updated (password reset):', adminEmail);
    }

    console.log('Done. Use the password:', adminPassword);
  } catch (err) {
    console.error('Error resetting admin:', err);
  } finally {
    await conn.end();
  }
})();