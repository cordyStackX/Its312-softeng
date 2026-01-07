// submit_application.js
import express from "express";
import multer from "multer";
import fs from "fs";
import { db } from "../server.js"; // Use the pool from server.js

const router = express.Router();

// Helper to resolve user id from session or header (fallback for API clients)
const resolveUserId = (req) => {
  if (req.user && req.user.id) return req.user.id;
  const headerId = req.headers['x-user-id'] || req.headers['x_user_id'];
  if (headerId) return Number(headerId);
  return null;
};

// -------------------------------
// Multer setup for file uploads
// -------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });
const cpUpload = upload.fields([
  { name: "letter_of_intent" },
  { name: "resume" },
  { name: "picture" },
  { name: "application_form" },
  { name: "recommendation_letter" },
  { name: "school_credentials" },
  { name: "high_school_diploma" },
  { name: "transcript" },
  { name: "birth_certificate" },
  { name: "employment_certificate" },
  { name: "nbi_clearance" },
  { name: "marriage_certificate" },
  { name: "business_registration" },
  { name: "certificates" },
]);

// -------------------------------
// Submit application route
// -------------------------------
router.post("/", cpUpload, async (req, res) => {
  try {
    console.log("Form body:", req.body);
    console.log("Files:", req.files);

    const body = req.body;
    const files = req.files || {};

    // Map uploaded files early so draft conversion can reuse them
    const filePaths = {};
    Object.keys(files).forEach((key) => {
      // normalize backslashes to forward slashes for consistent URLs
      filePaths[key] = files[key][0]?.path ? files[key][0].path.replace(/\\/g, "/") : null;
    });

    // Resolve user ID (session preferred, header fallback)
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized: Missing user ID" });

    // Block admins from submitting applications
    const [[userRow]] = await db.query("SELECT role FROM users WHERE id = ? LIMIT 1", [userId]);
    console.log('User role lookup result:', userRow);
    if (userRow && userRow.role === 'admin') return res.status(403).json({ message: "Admins cannot submit applications" });

    // If this request includes a draft_id, attempt to convert that draft into a submitted application
    if (body.draft_id) {
      const draftId = body.draft_id;
      console.log('Attempting to convert draft id=', draftId, 'for userId=', userId);
      // Ensure draft exists and is owned by this user
      const [rows] = await db.query(`SELECT * FROM applications WHERE id = ? AND user_id = ? AND status = 'Draft' LIMIT 1`, [draftId, userId]);
      console.log('Draft lookup rows:', rows);
      if (!rows.length) return res.status(404).json({ message: 'Draft not found or not owned by user' });

      // Build update similar to save-draft but set status to Pending (or Submitted)
      const fields = [];
      const values = [];
      if (body.full_name) { fields.push("full_name = ?"); values.push(body.full_name); }
      if (body.email) { fields.push("email = ?"); values.push(body.email); }
      if (body.phone) { fields.push("phone = ?"); values.push(body.phone); }
      if (body.marital_status) { fields.push("marital_status = ?"); values.push(body.marital_status); }
      if (body.is_business_owner) { fields.push("is_business_owner = ?"); values.push(body.is_business_owner); }
      if (body.business_name) { fields.push("business_name = ?"); values.push(body.business_name); }

      // files
      Object.keys(filePaths).forEach(k => { if (filePaths[k]) { fields.push(`${k} = ?`); values.push(filePaths[k]); } });

      // set status to Pending
      fields.push("status = ?"); values.push('Pending');

      values.push(draftId);
      console.log('About to run UPDATE with fields:', fields, 'values:', values);
      const [result] = await db.query(`UPDATE applications SET ${fields.join(", ")} WHERE id = ?`, values);
      console.log('UPDATE result:', result);
      if (result.affectedRows === 0) return res.status(500).json({ message: 'Failed to submit draft' });

      // Return success
      return res.json({ message: 'Draft submitted successfully', applicationId: draftId });
    }

    // Enforce only one application per user (exclude drafts) - allow operation only if there is no non-draft application
    const [existingApps] = await db.query("SELECT id FROM applications WHERE user_id = ? AND (status IS NULL OR status != 'Draft') LIMIT 1", [userId]);
    if (existingApps.length > 0) {
      return res.status(409).json({ message: "Only one submitted application allowed per account" });
    }

    // Insert into applications table including user_id, set status to 'Pending' so admins see it immediately
    console.log('Inserting new application, filePaths:', filePaths);
    const insertValues = [
      userId,
      body.program_name,
      body.full_name,
      body.email,
      body.phone,
      body.marital_status,
      body.is_business_owner,
      body.business_name || null,
      filePaths.letter_of_intent,
      filePaths.resume,
      filePaths.picture,
      filePaths.application_form,
      filePaths.recommendation_letter,
      filePaths.school_credentials,
      filePaths.high_school_diploma,
      filePaths.transcript,
      filePaths.birth_certificate,
      filePaths.employment_certificate,
      filePaths.nbi_clearance,
      filePaths.marriage_certificate,
      filePaths.business_registration,
      filePaths.certificates,
    ];
    console.log('Insert values count:', insertValues.length, 'values:', insertValues.map(v => v ? v.toString().slice(0,80) : v));
    const [result] = await db.query(
      `INSERT INTO applications
      (user_id, program_name, full_name, email, phone, marital_status, is_business_owner, business_name,
       letter_of_intent, resume, picture, application_form, recommendation_letter,
       school_credentials, high_school_diploma, transcript, birth_certificate,
       employment_certificate, nbi_clearance, marriage_certificate, business_registration, certificates, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      insertValues
    );

    // Return application ID for notifications tracking
    res.json({ 
      message: "Application submitted successfully!", 
      applicationId: result.insertId 
    });
  } catch (err) {
    console.error("Submit Application Error:", err);
    res.status(500).json({ message: "Server error. Check backend logs for details." });
  }
});

// -------------------------------
// Save draft route
// -------------------------------
router.post("/draft", cpUpload, async (req, res) => {
  try {
    const body = req.body;
    const files = req.files || {};
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized: Missing user ID" });

    // Block admins from saving drafts
    const [[roleRow]] = await db.query("SELECT role FROM users WHERE id = ? LIMIT 1", [userId]);
    if (roleRow && roleRow.role === 'admin') return res.status(403).json({ message: "Admins cannot submit applications" });

    // Map uploaded files
    const filePaths = {};
    Object.keys(files).forEach((key) => {
      filePaths[key] = files[key][0]?.path || null;
    });

    // If draft id provided, update existing draft
    if (body.draft_id) {
      const draftId = body.draft_id;
      // Build update query with provided fields (partial)
      const fields = [];
      const values = [];
      if (body.full_name) { fields.push("full_name = ?"); values.push(body.full_name); }
      if (body.email) { fields.push("email = ?"); values.push(body.email); }
      if (body.phone) { fields.push("phone = ?"); values.push(body.phone); }
      if (body.marital_status) { fields.push("marital_status = ?"); values.push(body.marital_status); }
      if (body.is_business_owner) { fields.push("is_business_owner = ?"); values.push(body.is_business_owner); }
      if (body.business_name) { fields.push("business_name = ?"); values.push(body.business_name); }

      // files
      Object.keys(filePaths).forEach(k => { fields.push(`${k} = ?`); values.push(filePaths[k]); });

      if (fields.length === 0) return res.status(400).json({ message: "No draft data provided" });
      values.push(draftId, userId);
      const [result] = await db.query(`UPDATE applications SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`, values);
      if (result.affectedRows === 0) return res.status(404).json({ message: "Draft not found or not owned by user" });
      return res.json({ message: "Draft updated", draftId });
    }

    // Check for existing draft for this user+program
    const [existing] = await db.query(`SELECT id FROM applications WHERE user_id = ? AND program_name = ? AND status = 'Draft' LIMIT 1`, [userId, body.program_name]);
    if (existing.length > 0) {
      const draftId = existing[0].id;
      // Update existing
      const [result] = await db.query(
        `UPDATE applications SET full_name = ?, email = ?, phone = ?, marital_status = ?, is_business_owner = ?, business_name = ?, letter_of_intent = ?, resume = ?, picture = ?, application_form = ?, recommendation_letter = ?, school_credentials = ?, high_school_diploma = ?, transcript = ?, birth_certificate = ?, employment_certificate = ?, nbi_clearance = ?, marriage_certificate = ?, business_registration = ?, certificates = ? WHERE id = ?`,
        [
          body.full_name || null,
          body.email || null,
          body.phone || null,
          body.marital_status || null,
          body.is_business_owner || null,
          body.business_name || null,
          filePaths.letter_of_intent || null,
          filePaths.resume || null,
          filePaths.picture || null,
          filePaths.application_form || null,
          filePaths.recommendation_letter || null,
          filePaths.school_credentials || null,
          filePaths.high_school_diploma || null,
          filePaths.transcript || null,
          filePaths.birth_certificate || null,
          filePaths.employment_certificate || null,
          filePaths.nbi_clearance || null,
          filePaths.marriage_certificate || null,
          filePaths.business_registration || null,
          filePaths.certificates || null,
          draftId,
        ]
      );
      return res.json({ message: "Draft updated", draftId });
    }

    // Ensure user has no other application (only 1 application per account)
    const [anyApps] = await db.query(`SELECT id FROM applications WHERE user_id = ? LIMIT 1`, [userId]);
    if (anyApps.length > 0) return res.status(409).json({ message: 'Only one application allowed per account' });

    // Insert new draft with status 'Draft'
    const [insertRes] = await db.query(
      `INSERT INTO applications
      (user_id, program_name, full_name, email, phone, marital_status, is_business_owner, business_name,
       letter_of_intent, resume, picture, application_form, recommendation_letter,
       school_credentials, high_school_diploma, transcript, birth_certificate,
       employment_certificate, nbi_clearance, marriage_certificate, business_registration, certificates, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft')`,
      [
        userId,
        body.program_name || null,
        body.full_name || null,
        body.email || null,
        body.phone || null,
        body.marital_status || null,
        body.is_business_owner || null,
        body.business_name || null,
        filePaths.letter_of_intent || null,
        filePaths.resume || null,
        filePaths.picture || null,
        filePaths.application_form || null,
        filePaths.recommendation_letter || null,
        filePaths.school_credentials || null,
        filePaths.high_school_diploma || null,
        filePaths.transcript || null,
        filePaths.birth_certificate || null,
        filePaths.employment_certificate || null,
        filePaths.nbi_clearance || null,
        filePaths.marriage_certificate || null,
        filePaths.business_registration || null,
        filePaths.certificates || null,
      ]
    );
    return res.json({ message: "Draft saved", draftId: insertRes.insertId });
  } catch (err) {
    console.error("Save Draft Error:", err);
    res.status(500).json({ message: "Server error while saving draft" });
  }
});

// -------------------------------
// List drafts for current user
// -------------------------------
router.get("/drafts", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [rows] = await db.query(`SELECT * FROM applications WHERE user_id = ? AND status = 'Draft' ORDER BY created_at DESC`, [userId]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching drafts:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------------
// Get a single draft by id (owned by the user)
// -------------------------------
router.get('/drafts/:id', async (req, res) => {
  try {
    const draftId = req.params.id;
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const [rows] = await db.query(`SELECT * FROM applications WHERE id = ? AND user_id = ? AND status = 'Draft' LIMIT 1`, [draftId, userId]);
    if (!rows.length) return res.status(404).json({ message: 'Draft not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching draft by id:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a draft owned by the user
router.delete('/drafts/:id', async (req, res) => {
  try {
    console.log('DELETE /submit_application/drafts called with id=', req.params.id, 'headers=', req.headers);
    const draftId = req.params.id;
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const [rows] = await db.query(`SELECT * FROM applications WHERE id = ? AND user_id = ? AND status = 'Draft'`, [draftId, userId]);
    if (!rows.length) return res.status(404).json({ message: 'Draft not found or not owned by user' });

    await db.query(`DELETE FROM applications WHERE id = ? AND user_id = ?`, [draftId, userId]);
    return res.json({ message: 'Draft deleted' });
  } catch (err) {
    console.error('Error deleting draft:', err);
    res.status(500).json({ message: 'Server error while deleting draft' });
  }
});

// Submit a draft directly (minimal endpoint used by frontend when draft has only server-side file paths)
router.post('/submit-draft', async (req, res) => {
  try {
    const { draft_id } = req.body || {};
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!draft_id) return res.status(400).json({ message: 'draft_id required' });

    // Ensure draft exists and is owned by user
    const [rows] = await db.query(`SELECT * FROM applications WHERE id = ? AND user_id = ? AND status = 'Draft' LIMIT 1`, [draft_id, userId]);
    if (!rows.length) return res.status(404).json({ message: 'Draft not found or not owned by user' });

    const [result] = await db.query(`UPDATE applications SET status = 'Pending' WHERE id = ? AND user_id = ?`, [draft_id, userId]);
    if (result.affectedRows === 0) return res.status(500).json({ message: 'Failed to submit draft' });

    return res.json({ message: 'Draft submitted successfully', applicationId: draft_id });
  } catch (err) {
    console.error('Submit-draft error:', err);
    res.status(500).json({ message: 'Server error while submitting draft' });
  }
});

export default router;
