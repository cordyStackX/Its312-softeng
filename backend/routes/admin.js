// routes/admin.js
import express from "express";
import multer from "multer";
import path from "path";
import {
  getAllApplications,
  updateApplicationStatus,
  updateDocumentStatus,
  deleteApplication,
  getDocumentRemark,
  addDocumentRemark,
  getAdminProfile,
  updateAdminProfile,
  getSupportedDocumentStatusKeys,
  verifyFile,
} from "../controllers/adminController.js";
import { db } from "../server.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

// ---------------------------
// Multer setup for profile picture upload
// ---------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/profile/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ---------------------------
// --- APPLICATIONS ---
// ---------------------------
router.get("/applications", getAllApplications);
router.put("/applications/:id/status", updateApplicationStatus);
router.put("/applications/:id/documents", updateDocumentStatus);
router.delete("/applications/:id", deleteApplication);
router.get('/applications/trash', async (req, res) => {
  // delegate to controller method to keep middleware/logic consistent
  try {
    const { getTrashedApplications } = await import('../controllers/adminController.js');
    return getTrashedApplications(req, res);
  } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }); }
});

router.post('/applications/trash/:id/restore', async (req, res) => {
  try {
    const { restoreTrashedApplication } = await import('../controllers/adminController.js');
    return restoreTrashedApplication(req, res);
  } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }); }
});

router.delete('/applications/trash/:id', async (req, res) => {
  try {
    const { permanentlyDeleteTrashedApplication } = await import('../controllers/adminController.js');
    return permanentlyDeleteTrashedApplication(req, res);
  } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }); }
});

// Supported document status keys
router.get("/document-status-supported", getSupportedDocumentStatusKeys);

// ---------------------------
// --- VERIFY FILE ---
// ---------------------------
router.put("/applications/:id/documents/:fileKey/verify", verifyFile);

// ---------------------------
// --- DOCUMENT REMARKS ---
// ---------------------------
router.get("/applications/:applicationId/documents/:documentName/remark", getDocumentRemark);
router.post("/applications/:applicationId/documents/:documentName/remark", addDocumentRemark);

// ---------------------------
// --- ADMIN PROFILE ---
// ---------------------------
router.get("/profile", getAdminProfile);
router.put("/profile", upload.single("profile_picture"), updateAdminProfile);

// ---------------------------
// --- ACTIVITY LOGS ---
// ---------------------------
router.get("/activity-logs", async (req, res) => {
  try {
    const [rows] = await db.query(
            `SELECT a.id, DATE_FORMAT(a.created_at, '%Y-%m-%d %h:%i %p') as date,
              u.id as user_id, u.fullname as user, u.role as role, a.action, a.details
       FROM activity_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching activity logs:", err);
    if (!res.headersSent) res.status(500).json({ message: "Server error fetching activity logs" });
  }
});

// POST activity log (accept from client)
router.post("/log", async (req, res) => {
  try {
    const { action, details } = req.body || {};
    const userId = req.user?.id || null;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Force admin role for activity logging; logActivity will verify admin role
    await logActivity(userId, "admin", action || "log", details || "");
    res.json({ message: "Logged" });
  } catch (err) {
    console.error("Error logging activity:", err);
    if (!res.headersSent) res.status(500).json({ message: "Failed to log activity" });
  }
});

export default router;
