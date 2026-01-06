import React, { createContext, useState, useEffect } from "react";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check localStorage for a stored user and verify against backend session
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return;

    let parsed = null;
    try { parsed = JSON.parse(storedUser); } catch (e) { parsed = null; }
    if (!parsed) {
      localStorage.removeItem("user");
      return;
    }

    // Verify session on server; if session is invalid, clear stored user to avoid stale admin redirects
    (async () => {
      try {
        const res = await fetch("http://localhost:5000/profile", {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          const serverUser = await res.json().catch(() => null);
          // Prefer server authoritative user; fall back to local copy
          const finalUser = serverUser && serverUser.id ? { ...parsed, ...serverUser } : parsed;
          setUser(finalUser);
          localStorage.setItem("user", JSON.stringify(finalUser));
        } else {
          // Session invalid — remove local storage copy
          localStorage.removeItem("user");
          setUser(null);
        }
      } catch (err) {
        // Network error: keep local copy but set into state so app remains usable offline
        setUser(parsed);
      }
    })();
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};
