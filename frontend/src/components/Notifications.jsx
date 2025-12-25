import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await axios.get("http://localhost:5000/notifications", { headers: { "x-user-id": user.id }, withCredentials: true });
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch notifications:", err.response?.data || err.message);
      setNotifications([]);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // navigation handled by clicking each notification

  return (
    <main className="max-w-4xl mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold mb-4">Notifications</h1>

      <div className="bg-white rounded-lg shadow p-4">
        {notifications.length === 0 ? (
          <p className="text-gray-600">No new notifications</p>
        ) : (
          notifications.map((n, idx) => (
            <div key={idx} className="border-b last:border-b-0 py-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{n.title}</div>
                  <div className="text-sm text-gray-700">{n.message}</div>
                  <div className="text-xs text-gray-400 mt-1">{new Date(n.date).toLocaleString()}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {n.type === "remark" && (
                    <button
                      onClick={async () => {
                        try {
                          const stored = localStorage.getItem('user');
                          const user = stored ? JSON.parse(stored) : null;
                          if (n.notification_key) await axios.post(
                            "http://localhost:5000/notifications/mark-read",
                            { notification_key: n.notification_key },
                            { headers: user ? { 'x-user-id': user.id } : {}, withCredentials: true }
                          );
                        } catch (e) {
                          console.error("Mark read failed:", e?.response?.data || e.message);
                        }
                        navigate(`/my-application?appId=${n.application_id}&doc=${encodeURIComponent(n.document_name)}`);
                      }}
                      className="px-3 py-1 bg-yellow-100 rounded text-sm"
                    >
                      View / Resubmit
                    </button>
                  )}
                  {n.type === "status" && (
                    <button
                      onClick={async () => {
                        try {
                          const stored = localStorage.getItem('user');
                          const user = stored ? JSON.parse(stored) : null;
                          if (n.notification_key) await axios.post(
                            "http://localhost:5000/notifications/mark-read",
                            { notification_key: n.notification_key },
                            { headers: user ? { 'x-user-id': user.id } : {}, withCredentials: true }
                          );
                        } catch (e) {
                          console.error("Mark read failed:", e?.response?.data || e.message);
                        }
                        navigate(`/my-application?appId=${n.application_id}`);
                      }}
                      className="px-3 py-1 bg-blue-100 rounded text-sm"
                    >
                      View Progress
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resubmission moved to Application Details page; click a notification to view */}
    </main>
  );
}

export default Notifications;