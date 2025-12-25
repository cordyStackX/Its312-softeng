import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "./Toast";
import brumaImg from "../assets/bruma.jpg";
import ellenImg from "../assets/ellen.jpg";

const programs = [
  {
    name: "Bachelor of Arts in English Language Studies",
    description:
      "Here’s a degree program for those who seek to attain high level of proficiency in English language and apply it in government, law, education, media, business, and the industry as an official language of the Philippines.",
  },
  {
    name: "Bachelor of Science in Business Administration - Human Resource Management",
    description:
      "Business organizations and institutions in the Philippines have become more particular about employing people with the right educational qualifications. If you are thinking about pursuing a career in human resource management, it’s best for you to earn the right career foundations by pursuing a bachelor’s degree in this field. LCC Bacolod’s Human Resource Management courses are taught by qualified faculty with robust industry experience.",
  },
  {
    name: "Bachelor of Science in Business Administration - Marketing Management",
    description:
      "Our ever-changing business environment influenced by a multitude of factors among them the negative impacts of COVID 19 pandemic and the boundless opportunities offered by technology, calls for businesses to develop strategies that will keep them buoyant amid this crisis. This situation makes imperative the role of competent marketing managers in the business.",
  },
  {
    name: "Bachelor of Science in Hospitality Management",
    description:
      "Here’s a degree program for those who want to work in world class hotels, resorts, restaurants, cruise and airline industries. The comprehensive education and training in operations and management of various areas of the hospitality industry. Graduates of BS in Hospitality Management may pursue a career path in hotel, resort, events management companies, and travel and tour companies or agencies. After this pandemic, the hospitality industry will be vibrant once more with people eager to go places. The time to prepare for this bright future is now.",
  },
];

// Coordinators (local images)
const staff = [
  { name: "Renell Bruma", image: brumaImg, link: "#" },
  { name: "Ellen Glice Sesante", image: ellenImg, link: "#" },
];

function Programs() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const [toast, setToast] = useState(null);

  const handleApply = async (programName) => {
    if (!user) {
      navigate("/signup", { state: { programName } });
      return;
    }

    try {
      const headers = user ? { "x-user-id": String(user.id) } : {};
      const res = await fetch("http://localhost:5000/profile/applications", {
        method: "GET",
        credentials: "include",
        headers,
      });

      if (res.status === 401) {
        // couldn't verify via session; show message and continue to program details
        setToast("Unable to verify application status — proceeding to apply.");
        setTimeout(() => setToast(null), 3000);
        navigate("/program-details", { state: { programName } });
        return;
      }

      const data = await res.json().catch(() => []);
      if (Array.isArray(data) && data.length > 0) {
        setToast("Only one application is allowed per account.");
        setTimeout(() => setToast(null), 4000);
        return;
      }

      navigate("/program-details", { state: { programName } });
    } catch (err) {
      console.error("Error checking existing application:", err);
      setToast("Unable to check application status. Try again.");
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-20">
      {/* Programs header */}

      <h1 className="text-4xl font-bold text-center mb-12 text-blue-800">
        Program Offerings
      </h1>

      <div className="grid md:grid-cols-2 gap-10">
        {programs.map((program, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-lg p-6 flex flex-col justify-between transition-all duration-200 hover:shadow-xl"
          >
            <div>
              <h2 className="text-2xl font-semibold mb-3 text-blue-800">
                {program.name}
              </h2>
              <p className="text-gray-700 mb-4">{program.description}</p>
            </div>
            <button
              onClick={() => handleApply(program.name)}
              className="bg-blue-800 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700 transition self-start"
            >
              Apply
            </button>
          </div>
        ))}
      </div>

      {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}

      {/* ---------------------- */}
      {/* Coordinators (previously Faculty) - moved below programs */}
      {/* ---------------------- */}
      <h2 className="text-3xl font-bold text-center mt-12 mb-8 text-blue-800">
        Coordinators
      </h2>
      <div className="flex flex-col md:flex-row justify-center gap-12 mt-4">
        {staff.map((member, index) => (
          <a
            key={index}
            href={member.link}
            className="flex flex-col items-center transition-transform duration-200 hover:-translate-y-1 hover:shadow-md"
          >
            <img
              src={member.image}
              alt={member.name}
              className="w-24 h-24 rounded-full object-cover mb-2"
            />
            <span className="text-lg font-semibold text-blue-800 hover:underline cursor-pointer">
              {member.name}
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}

export default Programs;
