import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { FaFileAlt, FaFilePdf, FaImage, FaCheckCircle, FaUpload } from "react-icons/fa";

const DOCUMENTS = [
  { key: "letter_of_intent", label: "Letter of Intent" },
  { key: "resume", label: "Résumé / CV" },
  { key: "picture", label: "Formal Picture" },
  { key: "application_form", label: "ETEEAP Application Form" },
  { key: "recommendation_letter", label: "Recommendation Letter" },
  { key: "school_credentials", label: "School Credentials" },
  { key: "high_school_diploma", label: "High School Diploma / PEPT" },
  { key: "transcript", label: "Transcript" },
  { key: "birth_certificate", label: "Birth Certificate" },
  { key: "employment_certificate", label: "Certificate of Employment" },
  { key: "nbi_clearance", label: "NBI Clearance" },
  { key: "marriage_certificate", label: "Marriage Certificate" },
  { key: "business_registration", label: "Business Registration" },
  { key: "certificates", label: "Certificates" },
];

function ApplicationDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [verified, setVerified] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [fileInputs, setFileInputs] = useState({});
  

  const user = JSON.parse(localStorage.getItem("user"));

  const fetchDetails = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`http://localhost:5000/profile/applications/${id}`, { headers: { "x-user-id": user.id }, withCredentials: true });
      setApp(res.data.application);
      setRemarks(res.data.remarks || {});
      setVerified(res.data.verified || {});
    } catch (err) {
      console.error("Failed to load application:", err.response?.data || err.message);
    }
  };

  useEffect(() => {
    const load = async () => {
      await fetchDetails();

      // mark related notifications as read for this application
      try {
        const stored = localStorage.getItem('user');
        const user = stored ? JSON.parse(stored) : null;
        const nres = await axios.get("http://localhost:5000/notifications", { headers: user ? { 'x-user-id': user.id } : {}, withCredentials: true });
        const list = Array.isArray(nres.data) ? nres.data : [];
        const toMark = list.filter((n) => String(n.application_id) === String(id) && !n.read).map((n) => n.notification_key);
        for (const key of toMark) {
          try {
            await axios.post("http://localhost:5000/notifications/mark-read", { notification_key: key }, { headers: user ? { 'x-user-id': user.id } : {}, withCredentials: true });
          } catch (e) {
            console.error("Failed to mark notification read:", e?.response?.data || e.message);
          }
        }
      } catch (err) {
        console.error("Failed to fetch notifications for marking read:", err?.response?.data || err.message);
      }
    };

    load();
    // auto-open doc if query param provided
    const params = new URLSearchParams(location.search);
    const doc = params.get("doc");
    if (doc) {
      // ensure details loaded then scroll
      setTimeout(() => {
        const el = document.getElementById(`doc-${doc}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleFileChange = (key, file) => {
    setFileInputs((prev) => ({ ...prev, [key]: file }));
  };

  // collapsed UI removed for cleaner interface

  const handleResubmit = async (key) => {
    if (!fileInputs[key]) return alert("Choose a file to upload");
    setUploadingDoc(key);
    try {
      const fd = new FormData();
      fd.append("file", fileInputs[key]);
      fd.append("application_id", id);
      fd.append("document_name", key);

      const res = await axios.post("http://localhost:5000/notifications/resubmit", fd, {
        headers: { "x-user-id": user.id, "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });

      alert(res.data.message || "Resubmitted successfully");
      setFileInputs((p) => ({ ...p, [key]: null }));
      fetchDetails();
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert("Upload failed");
    } finally {
      setUploadingDoc(null);
    }
  };

  if (!app) return <div className="p-8">Loading application...</div>;

  const statusLower = String(app.status || "").toLowerCase();
  const readOnly = statusLower.includes("accept") || statusLower.includes("reject");
  return (
    <main className="max-w-4xl mx-auto px-4 py-20">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Application: {app.program_name}</h1>
            <p className="text-sm text-gray-600 mt-1">Applicant: {app.full_name} • Submitted: {new Date(app.created_at).toLocaleString()}</p>
          </div>
          <div className="text-right md:w-48">
            <div className="text-sm text-gray-500">Overall Status</div>
            <div className="font-semibold text-blue-700 text-lg">{app.status || "pending"}</div>
          </div>
        </div>

        <section className="mt-6">
          <h2 className="font-semibold mb-2">Documents & Progress</h2>
          <div className="mb-3">
            <div className="text-sm text-gray-600">Showing {DOCUMENTS.length} documents</div>
          </div>

          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {DOCUMENTS.map((d) => {
              const val = app[d.key];
              const remark = remarks[d.key]?.remark || null;
              const verifiedFlag = verified[`${d.key}_verified`];
              return (
                <div id={`doc-${d.key}`} key={d.key} className="p-4 border rounded">
                    <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Icon mapping */}
                      <span className="text-gray-600">
                        {d.key.includes("picture") || d.key.includes("photo") ? <FaImage /> : d.key.includes("transcript") || d.key.includes("pdf") || d.key.includes("application_form") ? <FaFilePdf /> : <FaFileAlt />}
                      </span>
                      <div>
                        <div className="font-medium">{d.label}</div>
                        <div className="text-xs mt-1">
                          {val ? (
                            <a href={`http://localhost:5000/${val.replace(/^\//, "")}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">View file</a>
                          ) : (
                            <span className="text-gray-500">Not uploaded</span>
                          )}
                        </div>
                        <div className="mt-2">
                          {val ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800">Uploaded</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-100 text-red-800">Missing</span>
                          )}
                        </div>
                          {remark && <div className="text-sm text-yellow-700 mt-1">Remark: {remark}</div>}
                          {verifiedFlag && <div className="text-xs text-green-600 mt-1">Verified</div>}
                      </div>
                    </div>

                    {/* dropdown removed for clean UI */}
                  </div>
                  <div className="mt-3 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                      <div className="md:flex-1">
                        {/* optional extra description could go here */}
                      </div>

                      {/* Hide upload/resubmit controls when application is accepted/rejected */}
                      {!readOnly ? (
                        <div className="flex flex-col items-stretch gap-2 md:items-end md:w-auto w-full">
                          <label className="w-full md:w-auto">
                            <input id={`file-input-${d.key}`} className="hidden" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileChange(d.key, e.target.files[0])} />
                            <div className="flex items-center justify-between gap-2">
                              <button type="button" onClick={() => document.getElementById(`file-input-${d.key}`).click()} className="px-3 py-2 bg-gray-100 border rounded text-sm hover:bg-gray-200">
                                Choose file
                              </button>
                              <div className="text-sm text-gray-700">{fileInputs[d.key]?.name || "No file chosen"}</div>
                            </div>
                          </label>

                          <button disabled={!fileInputs[d.key] || uploadingDoc === d.key} onClick={() => handleResubmit(d.key)} className="px-3 py-2 bg-blue-600 text-white rounded text-sm w-full md:w-auto">
                            {uploadingDoc === d.key ? "Uploading..." : (val ? "Resubmit" : "Upload")}
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">This application is read-only.</div>
                      )}
                    </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-6 flex justify-end gap-3">
          {user && String(user.id) === String(app.user_id) && !statusLower.includes('accept') && (
            <button
              onClick={async () => {
                if (!window.confirm('Delete this application? This cannot be undone.')) return;
                try {
                  const res = await axios.delete(`http://localhost:5000/admin/applications/${id}`, {
                    headers: { 'x-user-id': user.id },
                    withCredentials: true,
                  });
                  alert(res.data?.message || 'Application deleted');
                  navigate('/programs');
                } catch (err) {
                  console.error('Delete failed:', err.response?.data || err.message);
                  alert(err.response?.data?.message || 'Failed to delete application');
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Delete Application
            </button>
          )}

          <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Back</button>
        </div>
      </div>
    </main>
  );
}

export default ApplicationDetails;
