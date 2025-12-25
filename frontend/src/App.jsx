import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import Navbar from "./components/Navbar";
import Home from "./components/Home";
import Footer from "./components/Footer";
import ProgramDetails from "./components/ProgramDetails";
import About from "./components/About";
import Programs from "./components/Programs";
import FAQ from "./components/FAQ";
import Messages from "./components/Messages";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ResetPassword from "./components/ResetPassword"; // ✅ Added
import AdminDashboard from "./components/AdminDashboard";
import AdminApplicants from "./components/AdminApplicants";
import AdminActivityLog from "./components/AdminActivityLog";
import AdminSettings from "./components/AdminSettings";
import Notifications from "./components/Notifications";
import ApplicationDetails from "./components/ApplicationDetails";
import MyDrafts from "./components/MyDrafts";
import MyApplication from "./components/MyApplication"; // New import for MyApplication

// User Context
import { UserProvider } from "./components/UserContext";

function AnimatedRoutes() {
  const location = useLocation();

  // ref used by CSSTransition to avoid findDOMNode (StrictMode safe)
  const nodeRef = React.useRef(null);

  // Hide navbar/footer for login, signup, reset-password, and admin routes
  const hideFooter = ["/login", "/signup", "/reset-password"].includes(location.pathname);
  const hideNavbarAndFooter = location.pathname.startsWith("/admin") || location.pathname === "/reset-password";

  return (
    <div className="flex flex-col min-h-screen">
      <TransitionGroup component={null}>
          <CSSTransition key={location.key} nodeRef={nodeRef} classNames="fade" timeout={300}>
            <div ref={nodeRef} className={`flex-1 ${!hideNavbarAndFooter ? "mt-16" : ""}`}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/program-details" element={<ProgramDetails />} />
              <Route path="/programs" element={<Programs />} />
              <Route path="/my-drafts" element={<MyDrafts />} />
              <Route path="/faqs" element={<FAQ />} />

              <Route path="/my-application" element={<MyApplication />} /> {/* New route for My Application */}
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/applications/:id" element={<ApplicationDetails />} />

              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/reset-password" element={<ResetPassword />} /> {/* ✅ Reset Password */}

              {/* Admin routes */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/applicants" element={<AdminApplicants />} />
              <Route path="/admin/activity-log" element={<AdminActivityLog />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Routes>
          </div>
        </CSSTransition>
      </TransitionGroup>

      {!hideFooter && !hideNavbarAndFooter && <Footer />}
    </div>
  );
}

function App() {
  const location = useLocation();
  const hideNavbar = location.pathname.startsWith("/admin") || location.pathname === "/reset-password";

  return (
    <>
      {!hideNavbar && <Navbar />}
      <AnimatedRoutes />
    </>
  );
}

export default function AppWrapper() {
  return (
    <UserProvider>
      <Router>
        <App />
      </Router>
    </UserProvider>
  );
}
