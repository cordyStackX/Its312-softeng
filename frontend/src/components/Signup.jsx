import React, { useState, useEffect, useContext } from "react";
import { FaUser, FaEnvelope, FaLock, FaGoogle, FaSpinner } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { UserContext } from "./UserContext";
import bgImage from "../assets/lccbg.jpg";

const Signup = () => {
  const { user } = useContext(UserContext);
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  // Redirect away from signup page if already authenticated
  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") navigate("/admin", { replace: true });
    else navigate("/", { replace: true });
  }, [user, navigate]);

  // Google OAuth listener
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== "http://localhost:5000") return;
      const user = event.data;
      if (user && user.id) {
        console.log("Google user:", user);
        // Persist user so the app treats them as logged in
        try { localStorage.setItem("user", JSON.stringify(user)); } catch (e) { console.error(e); }
        setMessage({ type: "success", text: `Welcome, ${user.fullname}` });
        setTimeout(() => {
          navigate("/", { replace: true });
          // If profile incomplete, open profile modal to prompt user to complete details
          if (!user.profile_picture || !user.fullname) {
            try { window.dispatchEvent(new CustomEvent('openProfile')); } catch (e) {}
          }
        }, 1500);
      } else if (user && user.message) {
        // Signup flow: backend returns a message and DOES NOT auto-login
        setMessage({ type: "success", text: user.message });
        setTimeout(() => navigate("/login"), 1500);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // --------------------------
  // ACTIVITY SIGNUP FUNCTION
  // --------------------------
  const logSignupActivity = async (email) => {
    try {
      await fetch("http://localhost:5000/log_activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: 'signup', details: { email } }),
      });
    } catch (err) {
      console.error("Activity Signup Error:", err);
    }
  };

  const handleSignup = async () => {
    if (!agreed) {
      setMessage({ type: "error", text: "You must agree to the privacy policy." });
      return;
    }

    if (!fullname || !email || !password) {
      setMessage({ type: "error", text: "Please fill all fields." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("http://localhost:5000/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullname, email, password }),
      });

      const result = await response.json();

      if (response.ok) {
        // Signup succeeded — do NOT auto-login. Prompt user to login.
        setMessage({ type: "success", text: result.message || "Signup successful. Please login." });

        // CLEAR INPUTS
        setFullname("");
        setEmail("");
        setPassword("");
        setAgreed(false);

        // 🔥 ADD SIGNUP ACTIVITY LOG
        await logSignupActivity(email);

        // REDIRECT to login
        setTimeout(() => navigate("/login", { replace: true }), 1500);
      } else {
        setMessage({ type: "error", text: result.message || "Signup failed" });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    window.open(
      "http://localhost:5000/auth/google/signup",
      "GoogleSignUp",
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  return (
    <div
      className="h-screen w-full flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="bg-blue-100/40 backdrop-blur-md border border-white/40 p-8 rounded-lg shadow-xl w-96 transform transition-all duration-500 hover:scale-105 hover:shadow-2xl animate-fadeIn relative z-10">
        <h2 className="text-2xl font-bold text-center text-blue-700 mb-6">
          Create an Account
        </h2>

        {/* Full Name */}
        <div className="mb-4 relative">
          <FaUser className="absolute top-3 left-3 text-gray-400" />
          <input
            type="text"
            placeholder="Full Name"
            value={fullname}
            onChange={(e) => setFullname(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Email */}
        <div className="mb-4 relative">
          <FaEnvelope className="absolute top-3 left-3 text-gray-400" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Password */}
        <div className="mb-4 relative">
          <FaLock className="absolute top-3 left-3 text-gray-400" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Agreement */}
        <div className="mb-4 flex items-start gap-2">
          <input
            type="checkbox"
            id="agreement"
            checked={agreed}
            onChange={() => setAgreed(!agreed)}
            className="mt-1"
          />
          <label htmlFor="agreement" className="text-sm text-gray-700">
            I agree that my personal data will be collected and processed for ETEEAP application purposes.{" "}
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={() => setShowPolicy(true)}
            >
              View Privacy Policy
            </button>
          </label>
        </div>

        {/* Signup Button */}
        <button
          onClick={handleSignup}
          disabled={!agreed || loading}
          className={`w-full font-semibold py-2 rounded mb-3 flex justify-center items-center gap-2 ${
            agreed ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-400 text-gray-200 cursor-not-allowed"
          }`}
        >
          {loading && <FaSpinner className="animate-spin" />}
          {loading ? "Signing Up..." : "Sign Up"}
        </button>

        {/* Google Signup */}
        <button
          onClick={handleGoogleSignup}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 py-2 rounded hover:bg-gray-100 transition mb-4"
        >
          <FaGoogle className="text-red-500" /> Sign Up with Google
        </button>

        {/* Login link */}
        <p className="text-center text-sm mt-2">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 hover:underline">
            Login
          </Link>
        </p>

        {/* Message popup */}
        {message && (
          <div
            className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 text-white font-semibold transform transition-all duration-300 ${
              message.type === "success" ? "bg-green-600 animate-slideUp" : "bg-red-600 animate-slideUp"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Privacy Policy Modal */}
        {showPolicy && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeInModal">
            <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative transform transition-all animate-slideUp">
              <h3 className="text-xl font-bold mb-4">Privacy Policy</h3>
              <p className="text-gray-700 mb-4 max-h-80 overflow-y-auto">
                Your personal data collected during the application process will be used solely for processing your ETEEAP application. This includes verifying your qualifications, contacting you regarding your application, and storing necessary documents. We ensure the protection and confidentiality of your information, and it will not be shared with unauthorized parties. All data handling practices strictly comply with the Data Privacy Act of 2012 (RA 10173).
              </p>
              <div className="text-right">
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  onClick={() => setShowPolicy(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Animations */}
        <style>{`
          @keyframes fadeInModal { 0% { opacity: 0; } 100% { opacity: 1; } }
          .animate-fadeInModal { animation: fadeInModal 0.3s ease-out; }

          @keyframes slideUp { 0% { transform: translateY(50px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
          .animate-slideUp { animation: slideUp 0.3s ease-out; }

          .animate-spin { animation: spin 1s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
};

export default Signup;
