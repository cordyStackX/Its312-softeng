import React, { useState, useEffect } from "react";
import { Trash2, Check, XCircle, Eye } from "lucide-react";
import axios from "axios";
import Toast from "./Toast";

const FILE_COLUMNS = [
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
  "certificates"
];

const FILE_LABELS = {
  letter_of_intent: "Letter of Intent",
  resume: "Resume",
  picture: "Picture",
  application_form: "Application Form",
  recommendation_letter: "Recommendation Letter",
  school_credentials: "School Credentials",
  high_school_diploma: "High School Diploma",
  transcript: "Transcript",
  birth_certificate: "Birth Certificate",
  employment_certificate: "Employment Certificate",
  nbi_clearance: "NBI Clearance",
  marriage_certificate: "Marriage Certificate",
  business_registration: "Business Registration",
  certificates: "Certificates"
};

// Reusable button classes for consistent responsive UI
const BTN_BASE = "inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-md focus:outline-none";
const BTN_PRIMARY = `${BTN_BASE} bg-blue-600 text-white hover:bg-blue-700`;
const BTN_SUCCESS = `${BTN_BASE} bg-green-50 text-green-700 hover:bg-green-100`;
const BTN_DANGER = `${BTN_BASE} bg-red-50 text-red-700 hover:bg-red-100`;
const BTN_ICON = "inline-flex items-center justify-center p-2 rounded-md bg-white border hover:bg-gray-50";

import { useLocation } from 'react-router-dom';

function AdminApplicants() {
  const location = useLocation();
  const [applicants, setApplicants] = useState([]);
  const [search, setSearch] = useState("");
  const [showView, setShowView] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showTrash, setShowTrash] = useState(false);
  const [trashedApplicants, setTrashedApplicants] = useState([]);

  // Remark modal states
  const [remarkData, setRemarkData] = useState(null);
  const [remarkText, setRemarkText] = useState("");
  const [showVerifyAllConfirm, setShowVerifyAllConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const [supportedDocStatusKeys, setSupportedDocStatusKeys] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [programFilter, setProgramFilter] = useState("All");

  // derived program list (include additional known programs)
  const EXTRA_PROGRAMS = [
    "Bachelor of Arts in English Language Studies",
    "Bachelor of Science in Business Administration - Human Resource Management",
    "Bachelor of Science in Business Administration - Marketing Management",
    "Bachelor of Science in Hospitality Management"
  ];
  const programs = Array.from(new Set([
    ...applicants.map(a => a.program_name).filter(Boolean),
    ...EXTRA_PROGRAMS
  ])).sort();

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const backendURL = "http://localhost:5000";
  // ensure axios sends cookies for session-based admin auth
  axios.defaults.withCredentials = true;

  useEffect(() => { fetchApplicants(); }, []);

  // If ?open=ID is present in query params (navigated from notification), open that application on load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get('open');
    if (!openId) return;

    // after applicants are loaded, try to open
    const tryOpen = () => {
      const found = applicants.find(a => String(a.id) === String(openId));
      if (found) setShowView(found);
    };

    tryOpen();
  }, [location.search, applicants]);

  useEffect(() => {
    const fetchSupported = async () => {
      try {
        const res = await axios.get(`${backendURL}/admin/document-status-supported`);
        setSupportedDocStatusKeys(res.data.supported || []);
      } catch (e) {
        console.warn('Failed to fetch supported doc status keys', e?.response?.data || e.message);
        setSupportedDocStatusKeys([]);
      }
    };
    fetchSupported();
  }, []);

  // --- LOG ACTIVITY ---
  const logActivity = async (action, details) => {
    try {
      await axios.post(`${backendURL}/admin/log`, { action, details });
    } catch (err) {
      console.error("Activity logging failed:", err);
    }
  };

  // --- FETCH APPLICANTS ---
  const fetchApplicants = async () => {
    try {
      const res = await axios.get(`${backendURL}/admin/applications`);
      setApplicants(res.data);
    } catch (err) { console.error(err); }
  };


  // --- ACCEPT / REJECT SINGLE APPLICANT ---
  const acceptRejectApplicant = async (id, status) => {
    try {
      const normalized = String(status).toLowerCase();

      // Update application status on server first
      const res = await axios.put(`${backendURL}/admin/applications/${id}/status`, { status: normalized });
      const updated = res.data || {};

      // Find current applicant record (to know which files are uploaded)
      const applicant = applicants.find(a => a.id === id) || (showView && showView.id === id && showView) || {};

      // If Accepted: verify all uploaded files
      if (normalized === "accepted") {
        const filesToVerify = FILE_COLUMNS.filter(f => applicant[f]);
        if (filesToVerify.length > 0) {
          await Promise.all(filesToVerify.map(f =>
            axios.put(`${backendURL}/admin/applications/${id}/documents/${f}/verify`, { verified: 1 })
          ));

          // Merge verified flags locally
          setApplicants(prev => prev.map(a => {
            if (a.id !== id) return a;
            const updates = {};
            filesToVerify.forEach(f => { updates[`${f}_verified`] = 1; });
            return { ...a, ...updates, status: updated.status || a.status };
          }));
          if (showView && showView.id === id) {
            setShowView(prev => {
              const updates = {};
              FILE_COLUMNS.filter(f => prev[f]).forEach(f => { updates[`${f}_verified`] = 1; });
              return { ...prev, ...updates, status: updated.status || prev.status };
            });
          }
        }
        await logActivity("Bulk Verify on Accept", `Applicant ID ${id} - verified ${filesToVerify.length} files and set status to Accepted`);
        showToast(`Applicant accepted and ${applicant ? FILE_COLUMNS.filter(f => applicant[f]).length : 0} files verified`, "success");
      }

      // If Rejected: unverify all uploaded files
      else if (normalized === "rejected") {
        const filesToUnverify = FILE_COLUMNS.filter(f => applicant[f]);
        if (filesToUnverify.length > 0) {
          await Promise.all(filesToUnverify.map(f =>
            axios.put(`${backendURL}/admin/applications/${id}/documents/${f}/verify`, { verified: 0 })
          ));

          setApplicants(prev => prev.map(a => {
            if (a.id !== id) return a;
            const updates = {};
            filesToUnverify.forEach(f => { updates[`${f}_verified`] = 0; });
            return { ...a, ...updates, status: updated.status || a.status };
          }));
          if (showView && showView.id === id) {
            setShowView(prev => {
              const updates = {};
              FILE_COLUMNS.filter(f => prev[f]).forEach(f => { updates[`${f}_verified`] = 0; });
              return { ...prev, ...updates, status: updated.status || prev.status };
            });
          }
        }
        await logActivity("Bulk Unverify on Reject", `Applicant ID ${id} - unverified ${filesToUnverify.length} files and set status to Rejected`);
        showToast("Applicant rejected and all file verifications removed", "success");
      }

      // If Pending: set application status and set each document status to pending
      else if (normalized === "pending") {
        const filesToSet = FILE_COLUMNS.filter(f => applicant[f] && supportedDocStatusKeys.includes(f));
        let failedCount = 0;
        if (filesToSet.length > 0) {
          const results = await Promise.all(filesToSet.map(async (f) => {
            try {
              return await axios.put(`${backendURL}/admin/applications/${id}/documents`, { documentName: f, status: "pending" });
            } catch (err) {
              // log and count but don't throw to allow other updates to proceed
              console.warn(`Failed to set document ${f} to pending for application ${id}:`, err?.response?.data || err.message);
              failedCount += 1;
              return null;
            }
          }));
        }
        // Merge status into local state
        setApplicants(prev => prev.map(a => a.id === id ? { ...a, status: updated.status || a.status } : a));
        if (showView && showView.id === id) setShowView(prev => ({ ...prev, status: updated.status || prev.status }));
        await logActivity("Set Pending", `Applicant ID ${id} - set status to Pending and attempted to set ${filesToSet.length} document(s) to pending (${failedCount} failed)`);
        if (failedCount > 0) showToast(`Applicant set to Pending; ${failedCount} document(s) could not be updated`, "warning");
        else showToast("Applicant set to Pending; documents set to Pending", "success");
      }

      // If none of above, still update the app row from server
      else {
        setApplicants(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a));
        if (showView && showView.id === id) setShowView(prev => ({ ...prev, ...updated }));
        showToast(`Status updated: ${updated.status || status}`, "success");
        await logActivity("Applicant Status Change", `Applicant ID ${id} set to ${updated.status || status}`);
      }
    } catch (err) {
      console.error("Error updating applicant status:", err);
      const msg = err?.response?.data?.message || err.message || "Failed to update applicant status. Please try again.";
      showToast(msg, "error");
    }
  };



  // --- DELETE APPLICANT ---
  const confirmDelete = id => setDeleteId(id);
  const doDelete = async () => {
    try {
      await axios.delete(`${backendURL}/admin/applications/${deleteId}`);
      // Refresh both lists so trash shows the moved item
      await fetchTrash();
      setApplicants(prev => prev.filter(a => a.id !== deleteId));
      await logActivity("Applicant Trashed", `Applicant ID ${deleteId} moved to trash`);
      setDeleteId(null);
      showToast("Applicant moved to Trash", "success");
    } catch (err) { console.error(err); showToast("Failed to delete applicant", "error"); }
  };

  // --- TRASH OPERATIONS ---
  const fetchTrash = async () => {
    try {
      const res = await axios.get(`${backendURL}/admin/applications/trash`);
      setTrashedApplicants(res.data || []);
    } catch (err) { console.error('Failed to fetch trashed applications', err); setTrashedApplicants([]); }
  };

  const restoreTrashed = async (trashId) => {
    try {
      await axios.post(`${backendURL}/admin/applications/trash/${trashId}/restore`);
      showToast('Application restored', 'success');
      await logActivity('Restore Application', `Restored trashed application ${trashId}`);
      fetchTrash();
      fetchApplicants();
    } catch (err) { console.error('Failed to restore trashed application', err); showToast('Restore failed', 'error'); }
  };

  const permanentlyDelete = async (trashId) => {
    try {
      await axios.delete(`${backendURL}/admin/applications/trash/${trashId}`);
      showToast('Trashed application permanently deleted', 'success');
      await logActivity('Permanent Delete', `Permanently deleted trashed application ${trashId}`);
      fetchTrash();
    } catch (err) { console.error('Failed to permanently delete trashed application', err); showToast('Delete failed', 'error'); }
  };

  // --- EXPORT CSV ---


  // --- SEARCH + STATUS FILTER ---
  const filtered = applicants.filter(a => {
    const matchesSearch = a.full_name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      (a.phone || "").toLowerCase().includes(search.toLowerCase()) ||
      a.program_name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'All' ? true : String(a.status) === statusFilter;

    const matchesProgram = programFilter === 'All' ? true : String(a.program_name) === programFilter;

    // Completeness: all FILE_COLUMNS present (kept for potential future use)
    const uploadedFiles = FILE_COLUMNS.filter(f => a[f]);
    const isComplete = uploadedFiles.length > 0 && uploadedFiles.length === FILE_COLUMNS.length;

    // Exclude Draft applications from the admin list
    return matchesSearch && matchesStatus && matchesProgram && a.status !== 'Draft';
  });

  // --- REMARK FUNCTIONS ---
  const showRemark = async (applicationId, documentName) => {
    try {
      const res = await axios.get(`${backendURL}/admin/applications/${applicationId}/documents/${documentName}/remark`);
      setRemarkData({ applicationId, documentName });
      setRemarkText(res.data.remark || "");
    } catch (err) {
      console.error(err);
      setRemarkData({ applicationId, documentName });
      setRemarkText("Error fetching remark");
      showToast("Failed to fetch remark", "error");
    }
  };

  const saveRemark = async () => {
    try {
      await axios.post(`${backendURL}/admin/applications/${remarkData.applicationId}/documents/${remarkData.documentName}/remark`, {
        remark: remarkText
      });
      await logActivity("Remark Sent", `Remark sent to Applicant ID ${remarkData.applicationId} for ${remarkData.documentName}`);
      setRemarkData(null);
      setRemarkText("");
    } catch (err) {
      console.error(err);
      showToast("Failed to save remark", "error");
    }
  };

  // --- VERIFY FILE ---
  const verifyFile = async (applicantId, fileKey) => {
    try {
      // toggle verify/unverify depending on current state
      const applicant = applicants.find(a => a.id === applicantId) || (showView && showView.id === applicantId && showView);
      const currentlyVerified = applicant ? (applicant[`${fileKey}_verified`] === 1) : false;
      const newVal = currentlyVerified ? 0 : 1;
      // Use server's authoritative response which includes explicit per-file verified flags
      const res = await axios.put(`${backendURL}/admin/applications/${applicantId}/documents/${fileKey}/verify`, { verified: newVal });
      const updatedApp = res.data || {};

      // Build updates only for recognized verified flags so we don't accidentally overwrite other fields
      const updates = {};
      FILE_COLUMNS.forEach(f => {
        const key = `${f}_verified`;
        if (typeof updatedApp[key] !== "undefined") updates[key] = Number(updatedApp[key]);
      });
      if (typeof updatedApp.status !== "undefined") updates.status = updatedApp.status;

      setApplicants(prev => prev.map(a => a.id === applicantId ? { ...a, ...updates } : a));
      if (showView && showView.id === applicantId) {
        setShowView(prev => ({ ...prev, ...updates }));
      }

      await logActivity("File Verify Toggled", `Applicant ID ${applicantId}, File ${fileKey} set to ${newVal}`);

      // If we just unverified a file, set application status to Pending on the server (status endpoint returns app row)
      if (newVal === 0) {
        try {
          const statusRes = await axios.put(`${backendURL}/admin/applications/${applicantId}/status`, { status: "pending" });
          const updated = statusRes.data || {};
          // Merge only the status field to avoid clobbering verified flags
          setApplicants(prev => prev.map(a => a.id === applicantId ? { ...a, status: updated.status || a.status } : a));
          if (showView && showView.id === applicantId) setShowView(prev => ({ ...prev, status: updated.status || prev.status }));
          showToast("File unverified — application status set to Pending", "success");
        } catch (statusErr) {
          console.error("Failed to set application status to Pending:", statusErr);
          showToast("File unverified but failed to update status on server", "error");
        }
      }

      showToast(newVal === 1 ? "File verified" : "File unverified", "success");
    } catch (err) {
      console.error("Failed to verify file:", err);
      showToast("Failed to verify file. Please try again.", "error");
    }
  };

  // --- VERIFY ALL UPLOADED FILES ---
  const verifyAllFiles = async () => {
    if (!showView) return;
    try {
      const filesToVerify = FILE_COLUMNS.filter(f => showView[f]);
      // Explicitly mark each uploaded file as verified on backend
      await Promise.all(filesToVerify.map(f =>
        axios.put(`${backendURL}/admin/applications/${showView.id}/documents/${f}/verify`, { verified: 1 })
      ));

      // Also update applicant status on backend to Accepted
      try {
        await axios.put(`${backendURL}/admin/applications/${showView.id}/status`, { status: "Accepted" });
      } catch (statusErr) {
        console.error("Failed to update applicant status on server:", statusErr);
        // continue, but show an error toast
        showToast("Files verified but failed to set status on server", "error");
      }

      // Update local state
      setApplicants(prev => prev.map(a => {
        if (a.id !== showView.id) return a;
        const updates = {};
        filesToVerify.forEach(f => { updates[`${f}_verified`] = 1; });
        return { ...a, ...updates };
      }));

      setShowView(prev => {
        const updates = {};
        filesToVerify.forEach(f => { updates[`${f}_verified`] = 1; });
        // Also mark applicant as Accepted when re-verifying all files
        return { ...prev, ...updates, status: "Accepted" };
      });

      setShowVerifyAllConfirm(false);
      await logActivity("Verify All", `Re-verified all files for Applicant ID ${showView.id} and set status to Accepted`);
      showToast("All files re-verified and status set to Accepted", "success");
    } catch (err) {
      console.error("Failed to verify all files:", err);
      showToast("Failed to re-verify all files. Please try again.", "error");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
        <h2 className="text-xl font-semibold text-blue-800">Applicants <span className="text-sm text-gray-600 ml-2">({showTrash ? trashedApplicants.length : filtered.length})</span></h2>

        <div className="flex flex-wrap items-center gap-2 justify-end w-full md:w-auto md:max-w-4xl">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search applicants..."
            className="border rounded-md px-3 py-2 text-sm w-full md:flex-1"
          />

          <select
            id="programFilter"
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="border px-3 py-2 rounded-md text-sm bg-white w-full md:w-48"
          >
            <option value="All">All Programs</option>
            {programs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border px-3 py-2 rounded-md text-sm bg-white w-full md:w-36"
          >
            <option value="All">All</option>
            <option value="Pending">Pending</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
          </select>

          {!remarkData && (
            <div className="flex items-center md:justify-end">
              <button
                className={`${BTN_ICON} ml-1`}
                onClick={async () => { const next = !showTrash; setShowTrash(next); if (next) await fetchTrash(); }}
                aria-label={showTrash ? 'Back to Applicants' : 'Open Trash Bin'}
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline text-sm">{showTrash ? 'Back' : 'Trash'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block overflow-x-auto w-full">
        {showTrash ? (
          <table className="w-full text-left border table-fixed">
            <thead className="bg-blue-800 text-white">
              <tr>
                <th className="p-2 w-3/12">Name</th>
                <th className="p-2 w-3/12">Email</th>
                <th className="p-2 w-2/12">Program</th>
                <th className="p-2 w-2/12">Deleted At</th>
                <th className="p-2 w-1/12">Original ID</th>
                <th className="p-2 w-1/12 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trashedApplicants.map(t => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{t.full_name || (t.data && t.data.full_name) || '-'}</td>
                  <td className="p-2">{t.email || (t.data && t.data.email) || '-'}</td>
                  <td className="p-2">{t.program_name || (t.data && t.data.program_name) || '-'}</td>
                  <td className="p-2">{t.deleted_at}</td>
                  <td className="p-2">{t.original_id}</td>
                  <td className="p-2 text-center flex flex-col sm:flex-row items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => restoreTrashed(t.id)} className="w-full sm:w-auto px-2 py-1 bg-green-600 text-white rounded">Restore</button>
                    <button onClick={() => {
                        if (!window.confirm('Permanently delete this trashed application? This cannot be undone.')) return;
                        permanentlyDelete(t.id);
                      }}
                      className="w-full sm:w-auto px-2 py-1 bg-red-600 text-white rounded"
                    >Delete Permanently</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left border">
            <thead className="bg-blue-800 text-white">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Program</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-center">Documents</th>
                <th className="p-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const isLocked = a.status === "Accepted" || a.status === "Rejected";
                return (
                  <tr key={a.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setShowView(a)}>
                    <td className="p-2">{a.full_name}</td>
                    <td className="p-2">{a.email}</td>
                    <td className="p-2">{a.phone || "-"}</td>
                    <td className="p-2">{a.program_name}</td>
                    <td className={`p-2 font-medium ${
                      a.status === "Accepted"
                        ? "text-green-600"
                        : a.status === "Rejected"
                          ? "text-red-600"
                          : "text-yellow-600"
                    }`}>
                      {a.status}
                    </td>
                    <td className="p-2 text-center">{FILE_COLUMNS.filter(f => a[f]).length}</td>
                    <td className="p-2 text-center flex justify-center gap-2" onClick={e => e.stopPropagation()}>
                      <button disabled={isLocked} onClick={() => acceptRejectApplicant(a.id, "Accepted")}
                        title={isLocked ? "Actions locked for accepted or rejected applicants" : "Accept"}
                        className={`${BTN_SUCCESS} disabled:opacity-50 disabled:cursor-not-allowed`}>
                        <Check size={14} />
                        <span className="hidden sm:inline">Accept</span>
                      </button>
                      <button disabled={isLocked} onClick={() => acceptRejectApplicant(a.id, "Rejected")}
                        title={isLocked ? "Actions locked for accepted or rejected applicants" : "Reject"}
                        className={`${BTN_DANGER} disabled:opacity-50 disabled:cursor-not-allowed`}>
                        <XCircle size={14} />
                        <span className="hidden sm:inline">Reject</span>
                      </button>
                      <button disabled={isLocked} onClick={() => confirmDelete(a.id)}
                        title={isLocked ? "Actions locked for accepted or rejected applicants" : "Delete applicant"}
                        className={`${BTN_ICON} disabled:opacity-50 disabled:cursor-not-allowed`}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MOBILE LIST */}
      <div className="md:hidden space-y-3">
        {showTrash ? (
          trashedApplicants.map(t => (
            <div key={t.id} className="border rounded-lg p-4 shadow-sm bg-white">
              <div className="font-semibold text-blue-600 text-lg">{t.full_name || (t.data && t.data.full_name)}</div>
              <div className="text-sm text-gray-600">{t.email || (t.data && t.data.email)}</div>
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => restoreTrashed(t.id)} className="px-2 py-1 bg-green-600 text-white rounded">Restore</button>
                <button onClick={() => {
                    if (!window.confirm('Permanently delete this trashed application? This cannot be undone.')) return;
                    permanentlyDelete(t.id);
                  }}
                  className="px-2 py-1 bg-red-600 text-white rounded"
                >Delete Permanently</button>
              </div>
            </div>
          ))
        ) : (
          <>
            {filtered.map(a => {
              const isLocked = a.status === "Accepted" || a.status === "Rejected";
              return (
                <div key={a.id}
                  className="border rounded-lg p-4 shadow-sm bg-white cursor-pointer hover:bg-gray-50"
                  onClick={() => setShowView(a)}>
                  <div className="font-semibold text-blue-600 text-lg">{a.full_name}</div>
                  <div className={`mt-1 font-medium ${
                    a.status === "Accepted"
                      ? "text-green-600"
                      : a.status === "Rejected"
                        ? "text-red-600"
                        : "text-yellow-600"
                  }`}>{a.status}</div>
                  <div className="mt-2 flex flex-col sm:flex-row justify-end gap-2" onClick={e => e.stopPropagation()}>
                    <button disabled={isLocked} onClick={() => acceptRejectApplicant(a.id, "Accepted")}
                      title={isLocked ? "Actions locked for accepted or rejected applicants" : "Accept"}
                      className="w-full sm:w-auto px-3 py-2 bg-green-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      <Check size={14} />
                      <span>Accept</span>
                    </button>
                    <button disabled={isLocked} onClick={() => acceptRejectApplicant(a.id, "Rejected")}
                      title={isLocked ? "Actions locked for accepted or rejected applicants" : "Reject"}
                      className="w-full sm:w-auto px-3 py-2 bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      <XCircle size={14} />
                      <span>Reject</span>
                    </button>
                    <button disabled={isLocked} onClick={() => confirmDelete(a.id)}
                      title={isLocked ? "Actions locked for accepted or rejected applicants" : "Delete applicant"}
                      className="w-full sm:w-auto px-3 py-2 bg-white border rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* VIEW MODAL */}
      {showView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm p-2">
          <div className="bg-white rounded-xl shadow-lg w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-blue-800">
                {showView.full_name}'s Files
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FILE_COLUMNS.map(f => {
                const fileURL = showView[f];
                const verified = showView[`${f}_verified`] === 1;

                return (
                  <div key={f} className="border bg-gray-50 rounded-lg p-3 shadow-sm flex flex-col items-center">
                    <div className="text-sm font-semibold text-gray-700 mb-2 text-center">{FILE_LABELS[f]}</div>

                    {fileURL ? (
                      <button onClick={() => window.open(`${backendURL}/${fileURL}`, "_blank")}
                        className="text-gray-600 hover:text-gray-800 mb-1">
                        <Eye size={24} />
                      </button>
                    ) : <div className="text-xs text-gray-500 italic mb-1">No file uploaded</div>}

                    {fileURL && (
                      <div className="text-xs text-gray-400 truncate w-full text-center mb-2">
                        {fileURL.split("/").pop()}
                      </div>
                    )}

                    {fileURL && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => verifyFile(showView.id, f)}
                          className={`px-3 py-1 text-xs rounded font-medium ${verified ? "bg-yellow-500 text-white hover:bg-yellow-600" : "bg-green-500 text-white hover:bg-green-600"}`}
                        >
                          {verified ? "Unverify" : "Verify"}
                        </button>

                        <button
                          onClick={() => showRemark(showView.id, f)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        >
                          Remark
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end relative">
              {(() => {
                const uploaded = FILE_COLUMNS.filter(f => showView[f]);
                const allVerified = uploaded.length > 0 && uploaded.every(f => showView[`${f}_verified`] === 1);

                return (
                  <>
                    {allVerified && (
                      <div className="relative mr-2">
                        <button
                          onClick={() => setShowVerifyAllConfirm(prev => !prev)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                        >
                          Re-verify All
                        </button>

                        {showVerifyAllConfirm && (
                          <div className="absolute bottom-full mb-2 right-0 bg-white border rounded p-3 shadow text-sm w-64 z-50">
                            <div className="mb-3 text-gray-700">All uploaded files are already verified. Re-verify all files?</div>
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setShowVerifyAllConfirm(false)} className="px-2 py-1 bg-gray-200 rounded">Cancel</button>
                              <button onClick={() => verifyAllFiles()} className="px-2 py-1 bg-blue-600 text-white rounded">Confirm</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <button onClick={() => setShowView(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Close</button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* REMARK MODAL */}
      {remarkData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow p-4 w-80 max-w-[90vw] text-center">
            <h4 className="font-semibold text-blue-700 mb-2">{FILE_LABELS[remarkData.documentName]}</h4>
            <textarea
              className="w-full border rounded p-2 mb-4 text-sm"
              rows={4}
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
            />
            {/* removed Trash Bin toggle from remark modal */}
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setRemarkData(null)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={saveRemark}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg p-6 w-96 text-center shadow">
            <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-4">Move this applicant to Trash Bin? You can restore it within 30 days.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
              <button onClick={doDelete} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminApplicants;
