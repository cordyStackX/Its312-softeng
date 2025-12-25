import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// -------------------------
// LOG USER ACTIVITY  ⭐ ADDED
// -------------------------
const logActivity = async (action, details = "") => {
  try {
    await fetch("http://localhost:5000/log_activity", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, details }),
    });
  } catch (err) {
    console.error("Activity Log Error:", err);
  }
};

function ProgramDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const { programName } = location.state || { programName: "" };

  const initialFormData = {
    fullName: "",
    email: "",
    phone: "",
    maritalStatus: "Single",
    isBusinessOwner: "No",
    businessName: "",
    letterOfIntent: null,
    resume: null,
    picture: null,
    applicationForm: null,
    recommendationLetter: null,
    schoolCredentials: null,
    highSchoolDiploma: null,
    transcript: null,
    birthCertificate: null,
    employmentCertificate: [],
    nbiClearance: null,
    marriageCertificate: null,
    businessRegistration: null,
    certificates: [],
  };

  const [formData, setFormData] = useState(initialFormData);
  const [draftId, setDraftId] = useState(null);
  const [errors, setErrors] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const maxFileSize = 50 * 1024 * 1024; // 50MB
  const acceptedTypes = ["application/pdf", "image/jpeg", "image/png"];

  // -------------------------
  // FILE HANDLER (multi-file support)
  // -------------------------
  const handleFileChange = (name, files, maxFiles = 1) => {
    if (!files || files.length === 0) return;

    let validFiles = [];
    for (let file of files) {
      if (!acceptedTypes.includes(file.type)) {
        alert(`Invalid file type: ${file.name}`);
        continue;
      }
      if (file.size > maxFileSize) {
        alert(`File too large (max 5MB): ${file.name}`);
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) return;

    setErrors((prev) => ({ ...prev, [name]: null }));

    // single file
    if (maxFiles === 1) {
      if (name === "picture") {
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result);
        reader.readAsDataURL(validFiles[0]);
      }
      setFormData((prev) => ({ ...prev, [name]: validFiles[0] }));
      return;
    }

    // multiple files
    const prevFiles = Array.isArray(formData[name]) ? formData[name] : [];
    let updatedFiles = [...prevFiles, ...validFiles];
    if (updatedFiles.length > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files.`);
      updatedFiles = updatedFiles.slice(0, maxFiles);
    }
    setFormData((prev) => ({ ...prev, [name]: updatedFiles }));
  };

  // -------------------------
  // FILE INPUT RENDER
  // -------------------------
  const renderFileInput = (label, name, required = true, isImage = false, maxFiles = 1) => {
    const isAdjustable = ["picture", "employmentCertificate", "certificates"].includes(name);
    const isMultiFile = maxFiles > 1;

    return (
      <div
        className={`border-dashed border-2 rounded-md p-4 text-center cursor-pointer flex flex-col
        ${isAdjustable ? "min-h-[auto]" : isMultiFile ? "flex-grow" : "h-36"} 
        ${errors[name] ? "border-red-500" : "border-gray-300"}`}
        onClick={() => document.getElementById(name).click()}
      >
        <label className="font-medium cursor-pointer block mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>

        <input
          id={name}
          type="file"
          multiple={maxFiles > 1}
          className="hidden"
          accept={isImage ? "image/*" : ".pdf, .jpg, .jpeg, .png"}
          onChange={(e) => {
            const selected = Array.from(e.target.files);
            handleFileChange(name, selected, maxFiles);
            e.target.value = "";
          }}
        />

        {/* Image Preview for C */}
        {isImage && formData[name] && (
          <div className="mt-2 flex justify-center">
            {typeof formData[name] === 'string' ? (
              <img
                src={formData[name].startsWith('http') ? formData[name] : `http://localhost:5000/${formData[name]}`}
                alt="Preview"
                className={`rounded-md border ${isAdjustable ? "max-w-full max-h-48 object-contain" : "w-32 h-32 object-cover"}`}
              />
            ) : (
              <img
                src={name === "picture" ? imagePreview : URL.createObjectURL(formData[name])}
                alt="Preview"
                className={`rounded-md border ${isAdjustable ? "max-w-full max-h-48 object-contain" : "w-32 h-32 object-cover"}`}
              />
            )}
          </div>
        )}

        {/* Multi-file preview for K and N */}
        {isMultiFile && Array.isArray(formData[name]) && formData[name].length > 0 && (
          <table className="w-full text-left mt-2 text-xs">
            <tbody>
              {formData[name].map((file, idx) => (
                <tr key={idx}>
                  <td className="py-1 border-b break-all">{file.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Single file preview for non-images */}
        {(!isImage && formData[name] && !Array.isArray(formData[name])) && (
          <p className="mt-2 text-gray-700 text-sm">{typeof formData[name] === 'string' ? formData[name].split('/').pop() : formData[name].name}</p>
        )}

        <p className="text-xs text-gray-400 mt-2">
          {maxFiles > 1 ? `${maxFiles} files maximum` : "Click to select file"}
        </p>
      </div>
    );
  };

  // -------------------------
  // VALIDATION
  // -------------------------
  const validateRequired = () => {
    const required = [
      "letterOfIntent",
      "resume",
      "picture",
      "applicationForm",
      "recommendationLetter",
      "schoolCredentials",
      "highSchoolDiploma",
      "transcript",
      "birthCertificate",
      "employmentCertificate",
      "nbiClearance",
    ];
    if (formData.maritalStatus === "Married") required.push("marriageCertificate");
    if (formData.isBusinessOwner === "Yes") required.push("businessRegistration");
    return required.filter((key) => !formData[key] || (Array.isArray(formData[key]) && formData[key].length === 0));
  };

  const handleReview = (e) => {
    e.preventDefault();
    setShowModal(true);
  };

  // -------------------------
  // SUBMISSION
  // -------------------------
  const handleSubmit = async () => {
    const data = new FormData();
    data.append("program_name", programName);
    data.append("full_name", formData.fullName);
    data.append("email", formData.email);
    data.append("phone", formData.phone);
    data.append("marital_status", formData.maritalStatus);
    data.append("is_business_owner", formData.isBusinessOwner);
    data.append("business_name", formData.businessName || "");

    const fileFields = {
      letterOfIntent: "letter_of_intent",
      resume: "resume",
      picture: "picture",
      applicationForm: "application_form",
      recommendationLetter: "recommendation_letter",
      schoolCredentials: "school_credentials",
      highSchoolDiploma: "high_school_diploma",
      transcript: "transcript",
      birthCertificate: "birth_certificate",
      employmentCertificate: "employment_certificate",
      nbiClearance: "nbi_clearance",
      marriageCertificate: "marriage_certificate",
      businessRegistration: "business_registration",
      certificates: "certificates",
    };

    Object.keys(fileFields).forEach((key) => {
      const val = formData[key];
      if (!val) return;
      if (Array.isArray(val)) val.forEach((f) => data.append(fileFields[key], f));
      else data.append(fileFields[key], val);
    });

    try {
      // Attach user id from localStorage so backend can associate the application
      const storedUser = localStorage.getItem("user");
      const userId = storedUser ? JSON.parse(storedUser).id : null;

      const res = await fetch("http://localhost:5000/submit_application", {
        method: "POST",
        body: data,
        credentials: "include",
        headers: userId ? { "x-user-id": String(userId) } : {},
      });
      const result = await res.json();
      if (!res.ok) {
        alert(`Error: ${result.message || "Unknown error"}`);
        return;
      }

      // ✅ ADDED - log activity exactly like login activity
      await logActivity("Application Submitted", `User submitted application for program: ${programName}`);

      alert(result.message);
      navigate("/programs");
    } catch (err) {
      console.error(err);
      alert("Submission failed.");
    }
  };

  // -------------------------
  // SAVE DRAFT
  // -------------------------
  const handleSaveDraft = async () => {
    const data = new FormData();
    data.append("program_name", programName);
    data.append("full_name", formData.fullName);
    data.append("email", formData.email);
    data.append("phone", formData.phone);
    data.append("marital_status", formData.maritalStatus);
    data.append("is_business_owner", formData.isBusinessOwner);
    data.append("business_name", formData.businessName || "");

    const fileFields = {
      letterOfIntent: "letter_of_intent",
      resume: "resume",
      picture: "picture",
      applicationForm: "application_form",
      recommendationLetter: "recommendation_letter",
      schoolCredentials: "school_credentials",
      highSchoolDiploma: "high_school_diploma",
      transcript: "transcript",
      birthCertificate: "birth_certificate",
      employmentCertificate: "employment_certificate",
      nbiClearance: "nbi_clearance",
      marriageCertificate: "marriage_certificate",
      businessRegistration: "business_registration",
      certificates: "certificates",
    };

    Object.keys(fileFields).forEach((key) => {
      const val = formData[key];
      if (!val) return;
      if (Array.isArray(val)) val.forEach((f) => data.append(fileFields[key], f));
      else data.append(fileFields[key], val);
    });

    try {
      const storedUser = localStorage.getItem("user");
      const userId = storedUser ? JSON.parse(storedUser).id : null;

      if (draftId) data.append('draft_id', draftId);

      const res = await fetch("http://localhost:5000/submit_application/draft", {
        method: "POST",
        body: data,
        credentials: "include",
        headers: userId ? { "x-user-id": String(userId) } : {},
      });
      const result = await res.json();
      if (!res.ok) {
        alert(`Error saving draft: ${result.message || "Unknown error"}`);
        return;
      }
      alert(result.message || "Draft saved");
      // optionally navigate or close modal
      setShowModal(false);
      if (result.draftId) setDraftId(result.draftId);
    } catch (err) {
      console.error(err);
      alert("Failed to save draft.");
    }
  };

  // If navigated with a draft in location.state, populate formData
  useEffect(() => {
    const draft = location.state?.draft;
    if (!draft) return;
    setDraftId(draft.id || null);
    const map = { ...initialFormData };
    // simple mapping of fields
    if (draft.full_name) map.fullName = draft.full_name;
    if (draft.email) map.email = draft.email;
    if (draft.phone) map.phone = draft.phone;
    if (draft.marital_status) map.maritalStatus = draft.marital_status;
    if (typeof draft.is_business_owner !== 'undefined') map.isBusinessOwner = draft.is_business_owner ? 'Yes' : 'No';
    if (draft.business_name) map.businessName = draft.business_name;

    // file fields (paths) - assign string path so preview shows filename
    const fileMap = {
      letter_of_intent: 'letterOfIntent',
      resume: 'resume',
      picture: 'picture',
      application_form: 'applicationForm',
      recommendation_letter: 'recommendationLetter',
      school_credentials: 'schoolCredentials',
      high_school_diploma: 'highSchoolDiploma',
      transcript: 'transcript',
      birth_certificate: 'birthCertificate',
      employment_certificate: 'employmentCertificate',
      nbi_clearance: 'nbiClearance',
      marriage_certificate: 'marriageCertificate',
      business_registration: 'businessRegistration',
      certificates: 'certificates',
    };

    Object.keys(fileMap).forEach(k => {
      if (draft[k]) {
        const target = fileMap[k];
        // multiple vs single
        if (['employment_certificate','certificates'].includes(k)) {
          map[target] = [draft[k]]; // keep as array of path strings
        } else {
          map[target] = draft[k];
        }
      }
    });

    setFormData(map);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Prefill fullName and email from URL params or logged-in user (skip when a draft is present)
  useEffect(() => {
    try {
      const draft = location.state?.draft;
      if (draft) return; // don't override draft data

      const params = new URLSearchParams(window.location.search);
      const nameParam = params.get('fullname') || params.get('name');
      const emailParam = params.get('email');

      const stored = localStorage.getItem('user');
      const parsed = stored ? JSON.parse(stored) : null;

      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || nameParam || (parsed && parsed.fullname) || "",
        email: prev.email || emailParam || (parsed && parsed.email) || "",
      }));
    } catch (e) {
      // ignore
    }
  }, [location.state]);

  // -------------------------
  // UI
  // -------------------------
  return (
    <main className="max-w-5xl mx-auto px-6 py-20">
      <button
        onClick={() => navigate("/programs")}
        className="mb-8 px-4 py-2 rounded-md bg-blue-800 text-white hover:bg-blue-700"
      >
        ← Back to Programs
      </button>

      <h1 className="text-3xl font-bold text-blue-800 mb-8 text-center">
        Apply for {programName}
      </h1>

      <form className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        {/* Personal Info */}
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            className="w-full border rounded-md px-4 py-2"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
          />
          <input
            type="email"
            placeholder="Email Address"
            className="w-full border rounded-md px-4 py-2"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Phone Number (optional)"
            className="w-full border rounded-md px-4 py-2"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          <div>
            <label className="font-semibold">Marital Status *</label>
            <select
              className="w-full border rounded-md px-4 py-2 mt-1"
              value={formData.maritalStatus}
              onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
            >
              <option value="Single">Single</option>
              <option value="Married">Married</option>
            </select>
          </div>

          <div>
            <label className="font-semibold">Business Owner? *</label>
            <select
              className="w-full border rounded-md px-4 py-2 mt-1"
              value={formData.isBusinessOwner}
              onChange={(e) => setFormData({ ...formData, isBusinessOwner: e.target.value })}
            >
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </div>

          {formData.isBusinessOwner === "Yes" && (
            <input
              type="text"
              placeholder="Business Name"
              className="w-full border rounded-md px-4 py-2"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              required
            />
          )}
        </div>

        {/* Documents */}
        <h2 className="text-xl font-semibold text-blue-800 mt-6 mb-4">Upload Documents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderFileInput("A. Letter of Intent", "letterOfIntent")}
          {renderFileInput("B. Résumé / CV", "resume")}
          {renderFileInput("C. Formal Picture", "picture", true, true)}
          {renderFileInput("D. ETEEAP Application Form", "applicationForm")}
          {renderFileInput("E. Recommendation Letter", "recommendationLetter")}
          {renderFileInput("F. School Credentials", "schoolCredentials")}
          {renderFileInput("G. High School Diploma / PEPT", "highSchoolDiploma")}
          {renderFileInput("H. Transcript", "transcript")}
          {renderFileInput("I. Birth Certificate", "birthCertificate")}
          {formData.maritalStatus === "Married" && renderFileInput("J. Marriage Certificate", "marriageCertificate")}
          {renderFileInput("K. Certificate of Employment (4 max)", "employmentCertificate", true, false, 4)}
          {renderFileInput("L. NBI Clearance", "nbiClearance")}
          {formData.isBusinessOwner === "Yes" && renderFileInput("M. Business Registration", "businessRegistration")}
          {renderFileInput("N. Certificates (10 max)", "certificates", false, false, 10)}
        </div>

        <div className="mt-6 text-center">
          {(() => {
            const missing = validateRequired();
            if (missing.length > 0) {
              return (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-6 py-2 rounded-md bg-gray-600 text-white hover:bg-gray-700"
                >
                  Save Progress
                </button>
              );
            }
            return (
              <button
                type="button"
                onClick={handleReview}
                className="px-6 py-2 rounded-md bg-blue-800 text-white hover:bg-blue-700"
              >
                Review Application
              </button>
            );
          })()}
        </div>
      </form>

      {/* Review Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full">
            <h2 className="text-2xl font-bold text-blue-800 mb-4">Review Your Application</h2>
            <div className="max-h-96 overflow-y-auto space-y-4 border-t border-b py-4">
              <div>
                <h3 className="font-semibold text-blue-700">Personal Info</h3>
                <p><strong>Name:</strong> {formData.fullName}</p>
                <p><strong>Email:</strong> {formData.email}</p>
                <p><strong>Phone:</strong> {formData.phone}</p>
                <p><strong>Marital Status:</strong> {formData.maritalStatus}</p>
                {formData.isBusinessOwner === "Yes" && <p><strong>Business Name:</strong> {formData.businessName}</p>}
              </div>

              <div>
                <h3 className="font-semibold text-blue-700">Documents</h3>
                <table className="w-full text-left text-sm">
                  <tbody>
                    {Object.keys(initialFormData).map((key) => {
                      if (!formData[key]) return null;
                      if (key === "picture") return <tr key={key}><td>{formData[key].name}</td></tr>;
                      if (Array.isArray(formData[key])) return formData[key].map((f, idx) => <tr key={idx}><td>{f.name}</td></tr>);
                      return formData[key].name ? <tr key={key}><td>{formData[key].name}</td></tr> : null;
                    })}
                  </tbody>
                </table>
              </div>
            </div>

              <div className="mt-6 flex justify-end gap-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border">Edit</button>
              <button onClick={handleSaveDraft} className="px-6 py-2 rounded-md bg-gray-400 text-white hover:bg-gray-500">Save Draft</button>
              <button onClick={handleSubmit} className="px-6 py-2 rounded-md bg-blue-800 text-white">Submit</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default ProgramDetails;
