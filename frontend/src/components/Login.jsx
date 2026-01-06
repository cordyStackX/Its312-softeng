import React, { useState, useEffect, useContext } from "react";
import { FaUser, FaLock, FaSpinner, FaGoogle } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { UserContext } from "./UserContext";
import bgImage from "../assets/lccbg.jpg";

const Login = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Redirect away from login page if already authenticated
  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") navigate("/admin", { replace: true });
    else navigate("/", { replace: true });
  }, [user, navigate]);

  const showTempMessage = (msg, type = "error") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const logActivity = async (action, userId = "GUEST") => {
    try {
      await fetch("http://localhost:5000/log_activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, details: { user_id: userId } }),
      });
    } catch (err) {
      console.error("Activity log failed:", err);
    }
  };

  // --- Normal login ---
  const handleLogin = async () => {
    if (!email || !password) {
      showTempMessage("Please fill all fields");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("http://localhost:5000/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      // Try to parse JSON; if that fails read text so we can show useful error info
      let result = null;
      let text = null;
      try {
        result = await res.json();
      } catch (e) {
        try { text = await res.text(); } catch (e2) { text = null; }
      }

      if (res.ok && result) {
        await logActivity("User logged in", result.user.id);
        localStorage.setItem("user", JSON.stringify(result.user));
        showTempMessage(result.message, "success");

        setEmail("");
        setPassword("");

        if (result.user.role === "admin") navigate("/admin", { replace: true });
        else navigate("/", { replace: true });
      } else if (result) {
        await logActivity("Failed login attempt", "GUEST");
        showTempMessage(result.message || "Login failed");
      } else if (text) {
        // Server returned non-JSON (HTML or text) — show status and text to help debug
        showTempMessage(`Server ${res.status}: ${String(text).slice(0, 200)}`);
      } else {
        showTempMessage("Unexpected server response");
      }
    } catch (err) {
      console.error(err);
      showTempMessage("Network error. Try again");
    } finally {
      setLoading(false);
    }
  };

  // --- Forgot Password ---
  const handleForgotPassword = async () => {
    if (!email) {
      showTempMessage("Please enter your email");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("http://localhost:5000/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await res.json().catch(() => null);

      if (res.ok && result) {
        showTempMessage(result.message || "Reset link sent! Check your email.", "success");
      } else if (result) {
        showTempMessage(result.message || "Email not found");
      } else {
        showTempMessage("Unexpected server response");
      }
    } catch (err) {
      console.error(err);
      showTempMessage("Network error. Try again");
    } finally {
      setLoading(false);
    }
  };

  // --- Google login ---
  const handleGoogleLogin = () => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    window.open(
      "http://localhost:5000/auth/google",
      "GoogleLogin",
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== "http://localhost:5000") return;
      const user = event.data;
      if (user && user.id) {
        localStorage.setItem("user", JSON.stringify(user));
        showTempMessage(`Welcome, ${user.fullname}`, "success");
        setTimeout(() => {
          if (user.role === "admin") navigate("/admin", { replace: true });
          else {
            navigate("/", { replace: true });
            // If profile looks incomplete, open profile modal so user can update details
            if (!user.profile_picture || !user.fullname) {
              try { window.dispatchEvent(new CustomEvent('openProfile')); } catch (e) {}
            }
          }
        }, 1000);
      } else if (user && user.message) {
        alert(user.message); // Google account not registered
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  return (
    <div
      className="h-screen w-full flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="bg-blue-100/40 backdrop-blur-md border border-white/40 p-8 rounded-lg shadow-xl w-96">
        <h2 className="text-2xl font-bold text-center text-blue-700 mb-6">
          Sign In to Continue
        </h2>

        {/* Email */}
        <div className="mb-4 relative">
          <FaUser className="absolute top-3 left-3 text-gray-400" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Password */}
        <div className="mb-2 relative">
          <FaLock className="absolute top-3 left-3 text-gray-400" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Forgot Password */}
        <div className="text-right mb-4">
          <button
            onClick={handleForgotPassword}
            disabled={loading}
            className="text-sm text-blue-600 hover:underline"
          >
            Forgot Password?
          </button>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded mb-3"
        >
          {loading && <FaSpinner className="animate-spin" />}
          {loading ? "Processing..." : "Login"}
        </button>

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 border border-gray-400 hover:bg-gray-100 text-gray-700 font-semibold py-2 rounded mb-3"
        >
          <FaGoogle className="text-red-500" /> Login with Google
        </button>

        {/* Signup */}
        <p className="text-center text-sm mt-2">
          Don’t have an account?{" "}
          <Link to="/signup" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>

        {/* Popup Message */}
        {message && (
          <div
            className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 text-white font-semibold transform transition-all duration-300 ${
              message.type === "error" ? "bg-red-600" : "bg-green-600"
            }`}
          >
            {message.type === "error" ? "❌" : "✅"} {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
