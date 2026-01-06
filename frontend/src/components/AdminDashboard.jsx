// AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { Menu, X, LayoutDashboard, Users, Settings, LogOut } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import axios from "axios";

import logoImg from "../assets/ETEEAP_LOGO.png";

import AdminApplicants from "./AdminApplicants";
import AdminActivityLog from "./AdminActivityLog";
import AdminSettings from "./AdminSettings";

function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");

  const [adminName, setAdminName] = useState("Renell L. Bruma");
  // Use logoImg as the default profile picture (do not bundle a built-in admin image)
  const [adminPicture, setAdminPicture] = useState(logoImg);

  const [stats, setStats] = useState({
    totalApplicants: 0,
    pendingVerifications: 0,
    accepted: 0,
    rejected: 0,
    programDistribution: [],
    monthlyApplicants: [],
  });

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "applicants", label: "Applicants", icon: Users },
    { key: "logs", label: "Activity Log", icon: Settings },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get("http://localhost:5000/admin/dashboard-stats");
        const data = res.data;

        // Make sure all numeric fields are numbers
        setStats({
          totalApplicants: Number(data.totalApplicants ?? 0),
          pendingVerifications: Number(data.pendingVerifications ?? 0),
          accepted: Number(data.accepted ?? 0),
          rejected: Number(data.rejected ?? 0),
          docsAwaiting: Number(data.docsAwaiting ?? 0),
          incompleteRequirements: Number(data.incompleteRequirements ?? 0),
          programDistribution: Array.isArray(data.programDistribution) ? data.programDistribution : [],
          monthlyApplicants: Array.isArray(data.monthlyApplicants) ? data.monthlyApplicants : [],
        });
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      }
    };
    fetchStats();
  }, []);

  // Load admin profile from localStorage and listen for updates from AdminSettings
  useEffect(() => {
    const loadProfile = () => {
      try {
        const stored = localStorage.getItem('user');
        const u = stored ? JSON.parse(stored) : null;
        if (u) {
          setAdminName(u.fullname || 'Admin');
          const pic = u.profile_picture || null;
          if (pic && String(pic).toLowerCase().startsWith('http')) {
            setAdminPicture(pic);
          } else if (pic) {
            setAdminPicture(`http://localhost:5000/${String(pic).replace(/^\//, '')}`);
          } else {
            setAdminPicture(adminImg || logoImg);
          }
        }
      } catch (e) { /* ignore */ }
    };

    loadProfile();

    const handler = (e) => {
      const d = e?.detail || {};
      setAdminName(d.fullname || adminName);
      if (d.profile_picture) {
        const p = d.profile_picture;
        if (String(p).toLowerCase().startsWith('http')) setAdminPicture(p);
        else setAdminPicture(`http://localhost:5000/${String(p).replace(/^\//, '')}`);
      }
    };
    window.addEventListener('profileUpdated', handler);
    return () => window.removeEventListener('profileUpdated', handler);
  }, []);

  // Prevent navigating back out of admin dashboard when an admin is logged in
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      const u = stored ? JSON.parse(stored) : null;
      if (!u || u.role !== 'admin') return;

      // Push a history state so that pressing Back stays on the admin page
      window.history.pushState(null, '', window.location.href);
      const onPopState = () => {
        window.history.pushState(null, '', window.location.href);
      };
      window.addEventListener('popstate', onPopState);
      return () => window.removeEventListener('popstate', onPopState);
    } catch (e) {
      // ignore
    }
  }, []);

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#a4de6c", "#d0ed57"];

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              {[
                { label: "Total Applicants", value: stats.totalApplicants, color: "blue-800" },
                { label: "Pending", value: stats.pendingVerifications, color: "yellow-500" },
                { label: "Accepted", value: stats.accepted, color: "green-600" },
                { label: "Rejected", value: stats.rejected, color: "red-600" },
              ].map(stat => (
                <div key={stat.label} className={`bg-white rounded-xl shadow p-4 border-l-4 border-${stat.color}`}>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                  <div className={`text-2xl font-bold text-${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Monthly Applicants */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">Monthly Applicants</h3>
                {stats.monthlyApplicants.length === 0 ? (
                  <div className="h-44 bg-gray-50 rounded flex items-center justify-center text-gray-400 text-xs">
                    No data
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={stats.monthlyApplicants}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#4f46e5" barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Program Distribution */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">Program Distribution</h3>
                {(() => {
                  const programData = (stats.programDistribution || []).filter(e => {
                    const name = (e.program || '').toString();
                    if (!name) return false;
                    if (['Incomplete requirements', 'Docs Awaiting Review', 'Awaiting review'].includes(name)) return false;
                    return Number(e.count) > 0;
                  });

                  if (!programData || programData.length === 0) {
                    return (
                      <div className="h-44 bg-gray-50 rounded flex items-center justify-center text-gray-400 text-xs">
                        No data
                      </div>
                    );
                  }

                  return (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={programData}
                          dataKey="count"
                          nameKey="program"
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={60}
                          label
                        >
                          {programData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">Quick Actions</h3>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setActiveSection("applicants")} className="px-3 py-2 bg-blue-700 text-white rounded hover:bg-blue-600">
                    Applicants
                  </button>
                  <button onClick={() => setActiveSection("logs")} className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300">
                    Activity Logs
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case "applicants":
        return <AdminApplicants />;
      case "logs":
        return <AdminActivityLog />;
      case "settings":
        return <AdminSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed lg:static top-0 left-0 h-full z-30
        ${sidebarOpen ? "w-64" : "w-20"}
        ${mobileSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        bg-blue-800 text-white flex flex-col transition-all duration-300`}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="ETEEAP" className="w-10 h-10 rounded-full" />
            {sidebarOpen && (
              <div>
                <h2 className="font-bold text-lg">ETEEAP Admin</h2>
                <p className="text-xs text-blue-200">Control Center</p>
              </div>
            )}
          </div>
          <button className="lg:hidden p-1" onClick={() => setMobileSidebar(false)}><X /></button>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setActiveSection(key); setMobileSidebar(false); }}
              className={`flex items-center gap-3 p-3 rounded-lg transition ${activeSection===key?"bg-blue-600":"hover:bg-blue-700"}`}>
              <Icon size={18} />
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto p-3">
          <button onClick={() => { localStorage.removeItem("user"); window.location.href="/login"; }}
            className="w-full flex items-center gap-3 p-2 rounded bg-blue-700 hover:bg-blue-600">
            <LogOut size={18} /> {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between bg-white p-4 shadow">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMobileSidebar(true)}><Menu size={24} /></button>
            <div className="text-xl font-semibold text-blue-800">Admin Portal</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="font-semibold text-gray-700">{adminName}</div>
              <div className="text-xs text-gray-500">Coordinator</div>
            </div>
            <img src={adminPicture} className="w-10 h-10 rounded-full border" />
          </div>
        </header>
        <main className="flex-1 p-4 overflow-y-auto">{renderSection()}</main>
      </div>
    </div>
  );
}

export default AdminDashboard;
