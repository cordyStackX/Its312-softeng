import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const nameFor = (v) => {
  if (!v) return null;
  if (typeof v === "string") return v.split("/").pop();
  return v.name || null;
};

export default function ReviewApplication() {
  const location = useLocation();
  const navigate = useNavigate();
  const { formData = {}, draftId = null, programName = "" } = location.state || {};
  // Ensure we land at the top of the review page when navigated here
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (e) {
      // ignore in non-browser environments
    }
  }, []);

  const [loading, setLoading] = useState(false);

  const labels = {
    letterOfIntent: "Letter of Intent",
    resume: "Résumé / CV",
    picture: "Formal Picture",
    applicationForm: "ETEEAP Application Form",
    recommendationLetter: "Recommendation Letter",
    schoolCredentials: "School Credentials",
    highSchoolDiploma: "High School Diploma / PEPT",
    transcript: "Transcript",
    birthCertificate: "Birth Certificate",
    employmentCertificate: "Certificate of Employment",
    nbiClearance: "NBI Clearance",
    marriageCertificate: "Marriage Certificate",
    businessRegistration: "Business Registration",
    certificates: "Certificates",
  };

  const buildFormData = (includeDraftId = true) => {
    const data = new FormData();
    data.append("program_name", programName || "");
    data.append("full_name", formData.fullName || "");
    data.append("email", formData.email || "");
    data.append("phone", formData.phone || "");
    data.append("marital_status", formData.maritalStatus || "");
    data.append("is_business_owner", formData.isBusinessOwner || "");
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
      if (Array.isArray(val)) {
        val.forEach((f) => {
          if (f instanceof File || f instanceof Blob) data.append(fileFields[key], f);
        });
      } else {
        if (val instanceof File || val instanceof Blob) data.append(fileFields[key], val);
      }
    });

    if (includeDraftId && draftId) data.append("draft_id", draftId);
    return data;
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      const data = buildFormData(true);
      const storedUser = localStorage.getItem("user");
      const userId = storedUser ? JSON.parse(storedUser).id : null;
      const res = await fetch("http://localhost:5000/submit_application/draft", {
        method: "POST",
        body: data,
        credentials: "include",
        headers: userId ? { "x-user-id": String(userId) } : {},
      });
      const result = await res.json();
      if (!res.ok) {
        alert(`Error saving draft: ${result.message || "Unknown error"}`);
        setLoading(false);
        return;
      }
      alert(result.message || "Draft saved");
      if (result.draftId) {
        // update local draft id so submit can use it
        // we won't persist it here but navigate back to program details with updated state
        navigate("/program-details", { state: { draft: { id: result.draftId } } });
        return;
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save draft.");
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!window.confirm("Are you sure you want to submit this application?")) return;
    setLoading(true);
    try {
      // If this is a draft with no new files (all file fields are server-side paths), call lightweight endpoint
      const fileFields = [
        'letterOfIntent','resume','picture','applicationForm','recommendationLetter','schoolCredentials',
        'highSchoolDiploma','transcript','birthCertificate','employmentCertificate','nbiClearance','marriageCertificate',
        'businessRegistration','certificates'
      ];
      const hasNewFiles = fileFields.some(k => {
        const v = formData[k];
        if (!v) return false;
        if (Array.isArray(v)) return v.some(f => f instanceof File || f instanceof Blob);
        return v instanceof File || v instanceof Blob;
      });

      const storedUser = localStorage.getItem("user");
      const userId = storedUser ? JSON.parse(storedUser).id : null;

      if (draftId && !hasNewFiles) {
        // lightweight submit-draft
        const res = await fetch("http://localhost:5000/submit_application/submit-draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(userId ? { "x-user-id": String(userId) } : {}),
          },
          credentials: "include",
          body: JSON.stringify({ draft_id: draftId }),
        });
        const result = await res.json();
        if (!res.ok) {
          alert(`Error: ${result.message || "Unknown error"}`);
          setLoading(false);
          return;
        }
        alert(result.message || "Submitted");
        navigate("/programs");
        return;
      }

      // Fallback to full multipart submit (handles new file uploads)
      const data = buildFormData(true);
      const res = await fetch("http://localhost:5000/submit_application", {
        method: "POST",
        body: data,
        credentials: "include",
        headers: userId ? { "x-user-id": String(userId) } : {},
      });
      const result = await res.json();
      if (!res.ok) {
        alert(`Error: ${result.message || "Unknown error"}`);
        setLoading(false);
        return;
      }
      alert(result.message || "Submitted");
      navigate("/programs");
    } catch (err) {
      console.error(err);
      alert("Submission failed.");
    }
    setLoading(false);
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-20">
      <h1 className="text-3xl font-bold text-blue-800 mb-6">Review Your Application</h1>
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-blue-700">Personal Info</h2>
          <p><strong>Name:</strong> {formData.fullName}</p>
          <p><strong>Email:</strong> {formData.email}</p>
          <p><strong>Phone:</strong> {formData.phone}</p>
          <p><strong>Marital Status:</strong> {formData.maritalStatus}</p>
          {formData.isBusinessOwner === "Yes" && <p><strong>Business Name:</strong> {formData.businessName}</p>}
        </div>

        <div>
          <h2 className="text-xl font-semibold text-blue-700">Documents</h2>
          <table className="w-full text-left text-sm mt-2">
            <tbody>
              {Object.keys(labels).map((key) => {
                const val = formData[key];
                if (!val) return null;
                if (Array.isArray(val)) {
                  return (
                    <tr key={key}>
                      <td>
                        <strong>{labels[key]}:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {val.map((f, idx) => (
                            <li key={idx}>{nameFor(f) || `File ${idx + 1}`}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  );
                }
                const nm = nameFor(val);
                return nm ? (
                  <tr key={key}>
                    <td><strong>{labels[key]}:</strong> {nm}</td>
                  </tr>
                ) : null;
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-md border">Edit</button>
          <button onClick={handleSaveDraft} disabled={loading} className="px-6 py-2 rounded-md bg-gray-400 text-white">{loading ? 'Saving...' : 'Save Draft'}</button>
          <button onClick={handleSubmit} disabled={loading} className="px-6 py-2 rounded-md bg-blue-800 text-white">{loading ? 'Submitting...' : 'Submit'}</button>
        </div>
      </div>
    </main>
  );
}
