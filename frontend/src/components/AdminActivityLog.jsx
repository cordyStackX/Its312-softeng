import React, { useState, useEffect } from "react";
// Removed CSV export (security / audit requirement)
import axios from "axios";
axios.defaults.withCredentials = true;

function AdminActivityLog() {
  const [search, setSearch] = useState("");
  const [actionCategory, setActionCategory] = useState("All");
  const [filterDate, setFilterDate] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Fetch logs from backend ---
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await axios.get("http://localhost:5000/admin/activity-logs", {
          headers: {
            "x-user-id": localStorage.getItem("userId") || "",
          },
        });

        // Ensure each log has the required fields
        const safeLogs = (response.data || []).map((log) => ({
          id: log.id,
          date: log.date || "",
          user_id: log.user_id || null,
          user: log.user || "Unknown User",
          role: (log.role || "").toString().toLowerCase(),
          action: log.action || "",
          details: log.details || "",
        }));

        setLogs(safeLogs);

        // no per-action dropdown; filtering uses category/search/date only
      } catch (err) {
        console.error("Error fetching activity logs:", err);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  // --- Filter logs ---
  const filtered = logs.filter((log) => {
    const m1 =
      log.user.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());
  const m2 = true;
    const m3 = filterDate ? log.date.includes(filterDate) : true;
    // Category filtering (preset groups)
    const cat = actionCategory;
    let m5 = true;
    if (cat === "accept") {
      m5 = /\baccept(ed)?\b/i.test(log.action) && !/\breject(ed)?\b/i.test(log.action);
    } else if (cat === "reject") {
      m5 = /\breject(ed)?\b/i.test(log.action) && !/\baccept(ed)?\b/i.test(log.action);
    } else if (cat === "verify") {
      m5 = /verify/i.test(log.action) && !/unverify/i.test(log.action);
    } else if (cat === "unverify") {
      m5 = /unverify|unverified/i.test(log.action);
    } else if (cat === "delete") {
      m5 = /delete|removed|deleted/i.test(log.action);
    } else if (cat === "remark") {
      m5 = /remark|remarked|add_document_remark/i.test(log.action);
    } else if (cat === "restore") {
      m5 = /restore|restored/i.test(log.action);
    } else if (cat === "login") {
      m5 = /\blogin\b|admin login/i.test(log.action);
    } else if (cat === "create_admin") {
      m5 = /create_admin|create admin/i.test(log.action);
    } else if (cat === "update_profile") {
      m5 = /update_profile|update profile/i.test(log.action);
    } else if (cat === "update_profile_picture") {
      m5 = /update_profile_picture|profile picture|update picture/i.test(log.action);
    }

    return m1 && m2 && m3 && m5;
  });


  if (loading) {
    return <div className="p-4 text-center">Loading activity logs...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 sm:p-6">
      <h2 className="text-2xl font-bold text-blue-800 mb-5">Activity Log</h2>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2 mb-5 flex-wrap">
        <input
          type="text"
          placeholder="Search activity..."
          className="border px-3 py-2 rounded-lg shadow-sm flex-1 min-w-[180px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />



        <select
          className="border px-3 py-2 rounded-lg shadow-sm min-w-[140px] w-full sm:w-auto"
          value={actionCategory}
          onChange={(e) => setActionCategory(e.target.value)}
        >
          <option value="All">All</option>
          <option value="accept">Accept</option>
          <option value="reject">Reject</option>
          <option value="verify">Verify</option>
          <option value="unverify">Unverify</option>
          <option value="delete">Delete</option>
          <option value="remark">Add Remark</option>
          <option value="restore">Restore</option>
          <option value="login">Login</option>
          <option value="create_admin">Create Admin</option>
          <option value="update_profile">Update Profile</option>
          <option value="update_profile_picture">Update Profile Picture</option>
        </select>


        <input
          type="date"
          className="border px-3 py-2 rounded-lg shadow-sm min-w-[140px]"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />

        {/* CSV export disabled — audit logs are admin-only and not exportable from UI */}
      </div>

      {/* Table for medium and up screens */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[600px] text-left">
          <thead className="bg-blue-800 text-white">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">User</th>
              <th className="p-3">Action</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filtered.length === 0 && (
              <tr>
                <td colSpan="4" className="p-4 text-center text-gray-500">
                  No matching activity found.
                </td>
              </tr>
            )}

            {filtered.map((log) => (
              <tr key={log.id} className="border-b hover:bg-gray-50 transition">
                <td className="p-3">{log.date}</td>
                <td className="p-3">{log.user}</td>
                <td className="p-3 font-semibold text-blue-700">{log.action}</td>
                <td className="p-3">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card layout for small screens */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="p-4 text-center text-gray-500 border rounded-lg">
            No matching activity found.
          </div>
        )}

        {filtered.map((log) => (
          <div key={log.id} className="border rounded-lg p-4 shadow-sm bg-white">
            <div className="flex justify-between mb-2">
              <span className="font-semibold text-gray-600">Date:</span>
              <span>{log.date}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="font-semibold text-gray-600">User:</span>
              <span>{log.user}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="font-semibold text-gray-600">Action:</span>
              <span className="font-semibold text-blue-700">{log.action}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">Details:</span>
              <span>{log.details}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminActivityLog;
