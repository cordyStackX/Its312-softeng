import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";

const statusMap = (s) => {
  // Normalize various backend statuses into limited set
  if (!s) return { label: "Pending / Under Review", color: "yellow" };
  const low = String(s).toLowerCase();
  if (low.includes("accept")) return { label: "Accepted", color: "green" };
  if (low.includes("reject")) return { label: "Rejected", color: "red" };
  return { label: "Pending / Under Review", color: "yellow" };
};

export default function MyApplication() {
  const [applications, setApplications] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [appsRes, draftsRes] = await Promise.all([
          axios.get('http://localhost:5000/profile/applications', { withCredentials: true }),
          axios.get('http://localhost:5000/submit_application/drafts', { headers: user ? { 'x-user-id': user.id } : {}, withCredentials: true }),
        ]);
        setApplications(Array.isArray(appsRes.data) ? appsRes.data : []);
        setDrafts(Array.isArray(draftsRes.data) ? draftsRes.data : []);
        const appId = searchParams.get('appId');
        if (appId) setSelectedAppId(String(appId));
        else if (appsRes.data && appsRes.data.length > 0) setSelectedAppId(String(appsRes.data[0].id));
      } catch (err) {
        console.error('Failed to fetch applications/drafts:', err?.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;

  const selected = applications.find(a => String(a.id) === String(selectedAppId)) || applications[0] || null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-20">
      <h1 className="text-2xl font-bold mb-4">My Application</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <aside className="col-span-1">
          <div className="bg-white rounded-md shadow p-4 mb-4">
            <h2 className="font-semibold mb-2">Submitted Applications</h2>
            {applications.length === 0 ? (
              <p className="text-gray-600">No submitted applications yet.</p>
            ) : (
              <ul className="space-y-2">
                {applications.map((a) => {
                  const st = statusMap(a.status || a.application_status || a.state);
                  return (
                    <li key={a.id}>
                      <button
                        onClick={() => setSelectedAppId(String(a.id))}
                        className={`w-full text-left p-2 rounded-md hover:bg-gray-50 flex justify-between items-center ${selectedAppId==a.id ? 'ring-2 ring-blue-300' : ''}`}>
                        <div>
                          <div className="font-semibold">{a.program_name}</div>
                          <div className="text-xs text-gray-500">Submitted: {new Date(a.created_at).toLocaleString()}</div>
                        </div>
                        <div>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${st.color==='green'?'bg-green-100 text-green-800':st.color==='red'?'bg-red-100 text-red-800':'bg-yellow-100 text-yellow-800'}`}>{st.label}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-md shadow p-4">
            <h2 className="font-semibold mb-2">Drafts</h2>
            {drafts.length === 0 ? (
              <p className="text-gray-600">No drafts. Start a new application.</p>
            ) : (
              <ul className="space-y-2">
                {drafts.map(d => (
                  <li key={d.id} className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{d.program_name || '(No program)'}</div>
                      <div className="text-xs text-gray-500">{d.full_name || '—'}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => navigate('/program-details', { state: { programName: d.program_name, draft: d } })} className="px-3 py-1 bg-blue-700 text-white rounded">Continue</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="col-span-2">
          <div className="bg-white rounded-md shadow p-6">
            {!selected ? (
              <div>
                <h3 className="text-lg font-semibold">No submitted application</h3>
                <p className="text-gray-600">You can start a new application from the Programs page.</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{selected.program_name}</h3>
                    <div className="text-sm text-gray-500">Submitted: {new Date(selected.created_at).toLocaleString()}</div>
                  </div>
                  <div>
                    {(() => { const st = statusMap(selected.status || selected.application_status || selected.state); return (<span className={`px-3 py-1 rounded ${st.color==='green'?'bg-green-100 text-green-800':'bg-yellow-100 text-yellow-800'}`}>{st.label}</span>); })()}
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-semibold">Admin Remarks</h4>
                  {selected.admin_remarks ? (
                    <div className="mt-2 p-3 bg-gray-50 border rounded text-sm text-gray-800">{selected.admin_remarks}</div>
                  ) : (
                    <p className="text-gray-600 mt-2">No remarks provided.</p>
                  )}
                </div>

                <div className="mt-6">
                  <h4 className="font-semibold">Documents</h4>
                  <div className="mt-2 text-sm text-gray-700">
                    {/* List major documents if present */}
                    {selected.letter_of_intent && <div><strong>Letter of Intent:</strong> {typeof selected.letter_of_intent==='string'?selected.letter_of_intent.split('/').pop(): selected.letter_of_intent.name}</div>}
                    {selected.resume && <div><strong>Resume:</strong> {typeof selected.resume==='string'?selected.resume.split('/').pop(): selected.resume.name}</div>}
                    {selected.picture && <div><strong>Picture:</strong> {typeof selected.picture==='string'?selected.picture.split('/').pop(): selected.picture.name}</div>}
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button onClick={() => navigate(`/applications/${selected.id}`)} className="px-4 py-2 bg-blue-700 text-white rounded">Open Details</button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
