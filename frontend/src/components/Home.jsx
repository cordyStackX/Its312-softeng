// src/components/Homepage.jsx
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { FaClock, FaCertificate, FaUsers, FaGraduationCap, FaBriefcase, FaFileAlt, FaBell } from "react-icons/fa";
import heroImage from "../assets/groupic.jpg";
import logoImg from "../assets/ETEEAP_LOGO.png";

const Particles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <span
        key={i}
        className="absolute w-2 h-2 bg-white rounded-full opacity-70 animate-float"
        style={{
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`,
        }}
      />
    ))}
    <style>
      {`
        @keyframes float {
          0% { transform: translateY(0px); opacity: 0.7; }
          50% { transform: translateY(-20px); opacity: 0.4; }
          100% { transform: translateY(0px); opacity: 0.7; }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }

        @keyframes floatImage {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-float-image { animation: floatImage 6s ease-in-out infinite; }
      `}
    </style>
  </div>
);

const Home = () => {

  useEffect(() => {
    import("aos").then(AOS => {
      AOS.init({ duration: 800, once: true });
    });
  }, []);

  // Ensure home page is scrolled to top when mounted (fixes leftover scroll position after logout/navigation)
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (e) {
      // ignore
    }
  }, []);

  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <div className="font-sans text-gray-800 bg-white">

      {/* Hero Section */}
      <section className="bg-blue-600 text-white relative overflow-hidden">


        <Particles />
        <div className="max-w-7xl mx-auto px-6 py-24 flex flex-col lg:flex-row items-center relative z-10">
          <div className="lg:w-1/2" data-aos="fade-right">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              Welcome to LCCB ETEEAP 
              Online Application
            </h1>
            <p className="text-lg mb-2 italic">Achieve Your Degree, Recognize Your Experience</p>
            <p className="mb-6 text-lg">
              Streamline your application process and submit your requirements online. Join the ETEEAP community today!
            </p>
            <div className="flex gap-4">
              <Link
                to={user ? "/programs" : "/signup"}
                className="bg-white text-blue-600 font-semibold px-6 py-3 rounded-lg hover:bg-gray-100 transition"
              >
                Apply Now
              </Link>
              <Link
                to="/about"
                className="bg-blue-500 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition"
              >
                Learn More
              </Link>
            </div>
          </div>
          <div className="lg:w-1/2 mt-10 lg:mt-0 animate-float-image" data-aos="fade-left">
            <img src={heroImage} alt="ETEEAP Hero" className="rounded-lg shadow-lg" />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-blue-50" data-aos="fade-up">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-6">About ETEEAP</h2>
          <p className="text-lg mb-4">
            The Expanded Tertiary Education Equivalency and Accreditation Program (ETEEAP) provides an opportunity for working adults to earn a baccalaureate degree in just 10 months through recognition of prior learning and work experience.
          </p>
          <p className="text-lg">
            Deputized Higher Education Institutions, like LCC Bacolod, conduct competency-based assessments using written tests, interviews, and practical evaluations to award appropriate degrees. Programs include Business Administration, Liberal Arts, and Hospitality Management, with Saturday classes for working professionals.
          </p>
        </div>
      </section>

      {/* Why Choose ETEEAP */}
      <section className="py-20 max-w-7xl mx-auto px-6" data-aos="fade-up">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose ETEEAP?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
          <div className="bg-blue-50 p-6 rounded-xl shadow hover:shadow-lg transition text-center">
            <FaClock className="text-blue-600 text-3xl mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Fast Degree Completion</h3>
            <p>Earn your baccalaureate degree within a 10-month period.</p>
          </div>
          <div className="bg-blue-50 p-6 rounded-xl shadow hover:shadow-lg transition text-center">
            <FaCertificate className="text-blue-600 text-3xl mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Competency-Based Assessment</h3>
            <p>Recognize prior learning through tests, interviews, and practical evaluations.</p>
          </div>
          <div className="bg-blue-50 p-6 rounded-xl shadow hover:shadow-lg transition text-center">
            <FaUsers className="text-blue-600 text-3xl mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Flexible Schedule</h3>
            <p>Saturday classes make it convenient for working adults.</p>
          </div>
          <div className="bg-blue-50 p-6 rounded-xl shadow hover:shadow-lg transition text-center">
            <FaGraduationCap className="text-blue-600 text-3xl mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Recognized Programs</h3>
            <p>Offered in Business, Liberal Arts, and Hospitality, accredited by CHED.</p>
          </div>
          <div className="bg-blue-50 p-6 rounded-xl shadow hover:shadow-lg transition text-center">
            <FaBriefcase className="text-blue-600 text-3xl mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Career Advancement</h3>
            <p>Enhance your skills and professional opportunities with a recognized degree.</p>
          </div>
        </div>
      </section>

      {/* Admission Highlights */}
      <section className="py-20 bg-white" data-aos="fade-up">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-8">Admission Qualification</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-6 rounded-xl shadow hover:shadow-lg transition">
              <h3 className="font-semibold mb-2">Age Requirement</h3>
              <p>At least 23 years old</p>
            </div>
            <div className="bg-blue-50 p-6 rounded-xl shadow hover:shadow-lg transition">
              <h3 className="font-semibold mb-2">Education</h3>
              <p>High school graduate or PEPT equivalent to 1st-year college</p>
            </div>
            <div className="bg-blue-50 p-6 rounded-xl shadow hover:shadow-lg transition">
              <h3 className="font-semibold mb-2">Experience</h3>
              <p>At least 5 years relevant work experience</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-blue-50" data-aos="fade-up">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-12">Success Stories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
              <p className="italic mb-4">“ETEEAP helped me complete my degree while working full-time. Highly recommended!”</p>
              <h3 className="font-semibold">– Jane D., BSBA Graduate</h3>
            </div>
            <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
              <p className="italic mb-4">“The competency-based assessment really recognized my experience and skills. It was a life-changing program.”</p>
              <h3 className="font-semibold">– Mark R., Hospitality Management Graduate</h3>
            </div>
          </div>
        </div>
      </section>

      {/* Call-to-Action */}
      <section className="py-20 bg-blue-600 text-white text-center" data-aos="fade-up">
        <h2 className="text-3xl font-bold mb-6">Ready to Start Your ETEEAP Journey at LCCB?</h2>
        <p className="mb-6">Apply today and take the next step in your career while earning your degree.</p>
        <div className="flex justify-center gap-4">
          <Link
            to={user ? "/programs" : "/signup"}
            className="bg-white text-blue-600 font-semibold px-6 py-3 rounded-lg hover:bg-gray-100 transition"
          >
            Apply Now
          </Link>
          <Link
            to="/about"
            className="bg-blue-500 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition"
          >
            Learn More
          </Link>
        </div>
      </section>

    </div>
  );
};

export default Home;
