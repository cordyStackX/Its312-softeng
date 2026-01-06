import db from "../config/db.js";
import { logActivity } from "../utils/activityLogger.js";
import bcrypt from "bcryptjs";

// ---------------------------
// --- APPLICATIONS ---
// ---------------------------
export const getAllApplications = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, program_name, full_name, email, phone, marital_status, is_business_owner,
      business_name, letter_of_intent, resume, picture, application_form, recommendation_letter,
      school_credentials, high_school_diploma, transcript, birth_certificate, employment_certificate,
      nbi_clearance, marriage_certificate, business_registration, certificates, created_at,
      resume_status, resume_remark, status
      FROM applications
      ORDER BY created_at DESC`
    );

    // Get verified files and normalize to explicit 0/1 flags for all known file keys
    const [verified] = await db.query("SELECT * FROM verified_files");

    const fileKeys = [
      "letter_of_intent",
      "resume",
      "picture",
      "application_form",
      "recommendation_letter",
      "school_credentials",
      "high_school_diploma",
      "transcript",
      "birth_certificate",
      "employment_certificate",
      "nbi_clearance",
      "marriage_certificate",
      "business_registration",
      "certificates",
    ];

    const applicationsWithVerified = rows.map(app => {
      const verifiedFiles = verified.filter(v => v.application_id === app.id);
      const verifiedObj = {};
      // default all to 0
      fileKeys.forEach(k => { verifiedObj[`${k}_verified`] = 0; });
      // set ones present to 1
      verifiedFiles.forEach(v => {
        verifiedObj[`${v.file_key}_verified`] = 1;
      });
      return { ...app, ...verifiedObj };
    });

    res.json(applicationsWithVerified);
  } catch (err) {
    console.error("Error fetching applications:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateApplicationStatus = async (req, res) => {
  const applicationId = req.params.id;
  const { status } = req.body;

  if (!status) return res.status(400).json({ message: "Status is required" });

  try {
    // allow case-insensitive pending/accepted/rejected and normalize value
    const lc = String(status).toLowerCase().trim();
    const allowed = ["pending", "accepted", "rejected"];
    if (!allowed.includes(lc)) {
      return res.status(400).json({ message: "Invalid status value" });
    }
    const normalized = lc === "pending" ? "Pending" : lc === "accepted" ? "Accepted" : "Rejected";

    const [result] = await db.query(
      `UPDATE applications SET status = ? WHERE id = ?`,
      [normalized, applicationId]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Application not found" });

    const [rows] = await db.query(`SELECT * FROM applications WHERE id = ?`, [applicationId]);

    // Log the admin action
    // Require authenticated admin and log the admin action
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });
    await logActivity(adminId, "admin", "update_application_status", `Set application ${applicationId} status to ${normalized}`);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error updating status" });
  }
};

// ---------------------------
// --- UPDATE DOCUMENT STATUS ---
// ---------------------------
export const updateDocumentStatus = async (req, res) => {
  const { id } = req.params;
  const { documentName, status, remark } = req.body;

  if (!documentName || !status) {
    return res.status(400).json({ message: "Document name and status are required" });
  }

  try {
    const allowedStatuses = ["pending", "approved", "rejected"];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Whitelist document names to avoid SQL injection and unknown column errors
    const allowedDocs = new Set([
      "letter_of_intent",
      "resume",
      "picture",
      "application_form",
      "recommendation_letter",
      "school_credentials",
      "high_school_diploma",
      "transcript",
      "birth_certificate",
      "employment_certificate",
      "nbi_clearance",
      "marriage_certificate",
      "business_registration",
      "certificates",
    ]);

    if (!allowedDocs.has(documentName)) {
      return res.status(400).json({ message: "Invalid document name" });
    }

    const statusColumn = `${documentName}_status`;
    const remarkColumn = `${documentName}_remark`;

    // Ensure the applications table actually has the status column before attempting UPDATE
    const [[colInfo]] = await db.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = ?`,
      [statusColumn]
    );

    if (!colInfo || Number(colInfo.cnt) === 0) {
      // Column does not exist - treat as no-op and return current application row
      const [rows] = await db.query(`SELECT * FROM applications WHERE id = ?`, [id]);
      if (!rows.length) return res.status(404).json({ message: "Application not found" });
      return res.json(rows[0]);
    }

    const [result] = await db.query(
      `UPDATE applications SET ${statusColumn} = ?, ${remarkColumn} = ? WHERE id = ?`,
      [status, remark || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Application not found" });
    }

    const [rows] = await db.query(`SELECT * FROM applications WHERE id = ?`, [id]);
    const updatedDoc = rows[0];

    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });
    await logActivity(
      adminId,
      "admin",
      "update_document_status",
      `Updated document '${documentName}' status to '${status}' on application ${id}`
    );

    res.json(updatedDoc);
  } catch (err) {
    console.error("Error updating document status:", err);
    // If database reports unknown column (bad field), return 400 with a helpful message
    if (err && (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054)) {
      return res.status(400).json({ message: "Document does not support status updates" });
    }
    res.status(500).json({ message: "Server error updating document status" });
  }
};

// ---------------------------
// --- DELETE APPLICATION ---
// ---------------------------
export const deleteApplication = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM applications WHERE id = ?",
      [id]
    );

    if (!rows.length) return res.status(404).json({ message: "Application not found" });
    // Move to trash: insert into applications_trash then remove from applications
    const app = rows[0];
    try {
      await db.query(
        `INSERT INTO applications_trash (original_id, program_name, full_name, email, phone, marital_status, is_business_owner, business_name, letter_of_intent, resume, picture, application_form, recommendation_letter, school_credentials, high_school_diploma, transcript, birth_certificate, employment_certificate, nbi_clearance, marriage_certificate, business_registration, certificates, created_at, resume_status, resume_remark, status, data, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [app.id, app.program_name, app.full_name, app.email, app.phone, app.marital_status, app.is_business_owner, app.business_name, app.letter_of_intent, app.resume, app.picture, app.application_form, app.recommendation_letter, app.school_credentials, app.high_school_diploma, app.transcript, app.birth_certificate, app.employment_certificate, app.nbi_clearance, app.marriage_certificate, app.business_registration, app.certificates, app.created_at, app.resume_status, app.resume_remark, app.status, JSON.stringify(app)]
      );
    } catch (e) {
      console.error('Failed to move application to trash', e);
      return res.status(500).json({ message: 'Failed to move application to trash' });
    }

    await db.query("DELETE FROM applications WHERE id = ?", [id]);

    // Log admin trash action
    const adminId = req.user?.id;
    if (adminId) {
      try {
        await logActivity(adminId, "admin", "trash_application", `Moved application ${id} to trash (${app.email || 'no-email'})`);
      } catch (e) { console.error('Failed to log trash action', e); }
    }

    res.json({ message: "Application moved to trash", trashed: app });
  } catch (err) {
    console.error("Error deleting application:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// --- TRASHED APPLICATIONS ---
// ---------------------------
export const getTrashedApplications = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, original_id, program_name, full_name, email, deleted_at, data FROM applications_trash ORDER BY deleted_at DESC`
    );
    // Parse JSON data safely
    const safe = rows.map(r => ({ ...r, data: r.data ? JSON.parse(r.data) : null }));
    res.json(safe);
  } catch (err) {
    console.error('Error fetching trashed applications', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const restoreTrashedApplication = async (req, res) => {
  try {
    const { id } = req.params; // trash table id
    const [[row]] = await db.query('SELECT * FROM applications_trash WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ message: 'Trashed item not found' });

    // Attempt to restore original id if free; otherwise insert and return new id
    const originalId = row.original_id;
    // Check conflict
    const [conflict] = await db.query('SELECT id FROM applications WHERE id = ?', [originalId]);
    if (conflict.length === 0 && originalId) {
      // Insert with original id
      await db.query(
        `INSERT INTO applications (id, program_name, full_name, email, phone, marital_status, is_business_owner, business_name, letter_of_intent, resume, picture, application_form, recommendation_letter, school_credentials, high_school_diploma, transcript, birth_certificate, employment_certificate, nbi_clearance, marriage_certificate, business_registration, certificates, created_at, resume_status, resume_remark, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.original_id, row.program_name, row.full_name, row.email, row.phone, row.marital_status, row.is_business_owner, row.business_name, row.letter_of_intent, row.resume, row.picture, row.application_form, row.recommendation_letter, row.school_credentials, row.high_school_diploma, row.transcript, row.birth_certificate, row.employment_certificate, row.nbi_clearance, row.marriage_certificate, row.business_registration, row.certificates, row.created_at, row.resume_status, row.resume_remark, row.status]
      );
    } else {
      // Insert without id
      await db.query(
        `INSERT INTO applications (program_name, full_name, email, phone, marital_status, is_business_owner, business_name, letter_of_intent, resume, picture, application_form, recommendation_letter, school_credentials, high_school_diploma, transcript, birth_certificate, employment_certificate, nbi_clearance, marriage_certificate, business_registration, certificates, created_at, resume_status, resume_remark, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.program_name, row.full_name, row.email, row.phone, row.marital_status, row.is_business_owner, row.business_name, row.letter_of_intent, row.resume, row.picture, row.application_form, row.recommendation_letter, row.school_credentials, row.high_school_diploma, row.transcript, row.birth_certificate, row.employment_certificate, row.nbi_clearance, row.marriage_certificate, row.business_registration, row.certificates, row.created_at, row.resume_status, row.resume_remark, row.status]
      );
    }

    // Remove from trash
    await db.query('DELETE FROM applications_trash WHERE id = ?', [id]);

    const adminId = req.user?.id;
    if (adminId) {
      try { await logActivity(adminId, 'admin', 'restore_application', `Restored trashed application ${id} (orig:${row.original_id})`); } catch(e){console.error('Failed to log restore', e)}
    }

    res.json({ message: 'Application restored' });
  } catch (err) {
    console.error('Error restoring trashed application', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const permanentlyDeleteTrashedApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM applications_trash WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Trashed item not found' });
    await db.query('DELETE FROM applications_trash WHERE id = ?', [id]);
    const adminId = req.user?.id;
    if (adminId) {
      try { await logActivity(adminId, 'admin', 'permanently_delete_application', `Permanently deleted trashed application ${id}`); } catch(e){console.error('Failed to log permanent delete', e)}
    }
    res.json({ message: 'Trashed application permanently deleted' });
  } catch (err) {
    console.error('Error permanently deleting trashed application', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------------------------
// --- VERIFY FILE ---
// ---------------------------
export const verifyFile = async (req, res) => {
  const applicationId = req.params.id;
  const fileKey = req.params.fileKey;
  const adminId = req.user?.id || null;
  const { verified } = req.body || {};

  try {
    // If client provided a verified flag, respect it (1 = verify, 0 = unverify)
    if (typeof verified !== "undefined") {
      if (Number(verified) === 1) {
        const [exists] = await db.query(
          "SELECT id FROM verified_files WHERE application_id = ? AND file_key = ?",
          [applicationId, fileKey]
        );
        if (exists.length === 0) {
          await db.query(
            "INSERT INTO verified_files (application_id, file_key, verified_by) VALUES (?, ?, ?)",
            [applicationId, fileKey, adminId]
          );
          await logActivity(adminId, "admin", "verify_file", `Verified file '${fileKey}' for application ${applicationId}`);
        }
      } else {
        // remove verified record
        await db.query(
          "DELETE FROM verified_files WHERE application_id = ? AND file_key = ?",
          [applicationId, fileKey]
        );
        await logActivity(adminId, "admin", "unverify_file", `Un-verified file '${fileKey}' for application ${applicationId}`);
      }
    } else {
      // Backwards compatible behavior: if no payload, toggle/insert if not exists
      const [exists] = await db.query(
        "SELECT id FROM verified_files WHERE application_id = ? AND file_key = ?",
        [applicationId, fileKey]
      );
      if (exists.length > 0) return res.status(200).json({ message: "Already verified" });
      await db.query(
        "INSERT INTO verified_files (application_id, file_key, verified_by) VALUES (?, ?, ?)",
        [applicationId, fileKey, adminId]
      );
      await logActivity(adminId, "admin", "verify_file", `Verified file '${fileKey}' for application ${applicationId}`);
    }

    const [rows] = await db.query(`SELECT * FROM applications WHERE id = ?`, [applicationId]);

    // build explicit verified flags for all known file keys
    const [verifiedRows] = await db.query("SELECT file_key FROM verified_files WHERE application_id = ?", [applicationId]);
    const fileKeys = [
      "letter_of_intent",
      "resume",
      "picture",
      "application_form",
      "recommendation_letter",
      "school_credentials",
      "high_school_diploma",
      "transcript",
      "birth_certificate",
      "employment_certificate",
      "nbi_clearance",
      "marriage_certificate",
      "business_registration",
      "certificates",
    ];
    const verifiedObj = {};
    fileKeys.forEach(k => { verifiedObj[`${k}_verified`] = 0; });
    verifiedRows.forEach(v => { verifiedObj[`${v.file_key}_verified`] = 1; });

    const response = { ...rows[0], ...verifiedObj };
    res.json(response);
  } catch (err) {
    console.error("Error verifying file:", err);
    res.status(500).json({ message: "Verification failed" });
  }
};

// ---------------------------
// --- DOCUMENT REMARKS ---
// ---------------------------
export const getDocumentRemark = async (req, res) => {
  try {
    const { applicationId, documentName } = req.params;
    const [rows] = await db.query(
      "SELECT remark, created_at FROM document_remarks WHERE application_id = ? AND document_name = ? ORDER BY created_at DESC LIMIT 1",
      [applicationId, documentName]
    );

    res.json(rows.length > 0 ? rows[0] : { remark: "", created_at: null });
  } catch (err) {
    console.error("Error fetching document remark:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const addDocumentRemark = async (req, res) => {
  try {
    const { applicationId, documentName } = req.params;
    const { remark } = req.body;

    await db.query(
      "INSERT INTO document_remarks (application_id, document_name, remark, created_at) VALUES (?, ?, ?, NOW())",
      [applicationId, documentName, remark]
    );

    const [rows] = await db.query(
      "SELECT remark, created_at FROM document_remarks WHERE application_id = ? AND document_name = ? ORDER BY created_at DESC LIMIT 1",
      [applicationId, documentName]
    );

    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });
    await logActivity(
      adminId,
      "admin",
      "add_document_remark",
      `Added remark for document '${documentName}' on application ${applicationId}: ${remark}`
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Error adding document remark:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// --- ADMIN PROFILE ---
// ---------------------------
export const getAdminProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const [rows] = await db.query(
      "SELECT id, fullname, email, profile_picture FROM users WHERE id = ?",
      [userId]
    );

    if (!rows.length) return res.status(404).json({ message: "Admin not found" });

    const user = rows[0];
    user.profile_picture = user.profile_picture
      ? `${req.protocol}://${req.get("host")}/${user.profile_picture}`
      : `${req.protocol}://${req.get("host")}/uploads/profile/default.png`;

    res.json(user);
  } catch (err) {
    console.error("Error fetching admin profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateAdminProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { fullname, email, password } = req.body;
    if (!fullname || !email) return res.status(400).json({ message: "Fullname and email required" });

    const fields = ["fullname = ?", "email = ?"];
    const values = [fullname, email];

    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);
      fields.push("password = ?");
      values.push(hashedPassword);
    }

    if (req.file) {
      const profile_picture = `uploads/profile/${req.file.filename}`;
      fields.push("profile_picture = ?");
      values.push(profile_picture);
    }

    values.push(userId);

    await db.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);

    const [rows] = await db.query(
      "SELECT id, fullname, email, profile_picture FROM users WHERE id = ?",
      [userId]
    );

    const user = rows[0];
    user.profile_picture = user.profile_picture
      ? `${req.protocol}://${req.get("host")}/${user.profile_picture}`
      : `${req.protocol}://${req.get("host")}/uploads/profile/default.png`;

    await logActivity(userId, "admin", "update_profile", "Admin updated profile settings");

    res.json({ message: "Profile updated successfully!", user });
  } catch (err) {
    console.error("Error updating admin profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// --- SUPPORTED DOC STATUS KEYS ---
// Returns which document base keys have a corresponding *_status column in applications
// ---------------------------
export const getSupportedDocumentStatusKeys = async (req, res) => {
  try {
    const fileKeys = [
      "letter_of_intent",
      "resume",
      "picture",
      "application_form",
      "recommendation_letter",
      "school_credentials",
      "high_school_diploma",
      "transcript",
      "birth_certificate",
      "employment_certificate",
      "nbi_clearance",
      "marriage_certificate",
      "business_registration",
      "certificates",
    ];

    const checks = await Promise.all(fileKeys.map(async (k) => {
      const col = `${k}_status`;
      const [[row]] = await db.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = ?`,
        [col]
      );
      return { key: k, has: Number(row.cnt) > 0 };
    }));

    const supported = checks.filter(c => c.has).map(c => c.key);
    res.json({ supported });
  } catch (err) {
    console.error("Error checking supported document status keys:", err);
    res.status(500).json({ message: "Server error" });
  }
};
