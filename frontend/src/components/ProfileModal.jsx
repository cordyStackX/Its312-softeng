import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function ProfileModal({ user, onClose }) {
  const [formData, setFormData] = useState({ fullname: user?.fullname || "", email: user?.email || "", profile_picture: null });
  const [preview, setPreview] = useState(user?.profile_picture || null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("user");
    onClose();
    // Go to home after logout and ensure viewport is at the top
    navigate("/", { replace: true });
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (e) {
      // ignore
    }
  }; 

  const getProfileImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    if (path.startsWith("/")) return `http://localhost:5000${path}`;
    return `http://localhost:5000/${path}`;
  };

  const handleChange = (e) => {
    const { name, files, value } = e.target;
    if (name === "profile_picture") {
      setFormData((prev) => ({ ...prev, profile_picture: files[0] }));
      setPreview(URL.createObjectURL(files[0]));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      data.append("fullname", formData.fullname);
      data.append("email", formData.email);
      if (formData.profile_picture) data.append("profile_picture", formData.profile_picture);

      const res = await axios.put("http://localhost:5000/profile/update", data, {
        headers: { "Content-Type": "multipart/form-data", "x-user-id": user?.id },
        withCredentials: true,
      });

      localStorage.setItem("user", JSON.stringify(res.data.user));
      alert("Profile updated successfully!");
      onClose();
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert("Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white p-6 rounded-md w-96 relative">
        <button className="absolute top-2 right-2 text-gray-500 hover:text-red-500" onClick={onClose}>✖</button>
        <h2 className="text-xl font-semibold mb-4 text-center">Edit Profile</h2>

        <form className="flex flex-col items-center" onSubmit={handleSubmit}>
          <div className="mb-4">
            {preview ? (
              <img src={getProfileImageUrl(preview)} alt="Profile" className="w-24 h-24 rounded-full border border-gray-300 mb-2" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-100 mb-2 flex items-center justify-center text-gray-400">No Image</div>
            )}
            <input type="file" name="profile_picture" accept="image/*" onChange={handleChange} className="mt-2" />
          </div>

          <input type="text" name="fullname" value={formData.fullname} onChange={handleChange} placeholder="Full Name" className="w-full mb-3 px-3 py-2 border rounded" required />

          <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="w-full mb-3 px-3 py-2 border rounded" required />

          <div className="flex flex-col w-full items-center gap-3">
            <button type="submit" disabled={loading} className="w-full px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              {loading ? "Updating..." : "Update Profile"}
            </button>

            <button type="button" onClick={handleLogout} className="w-full px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700">
              Logout
            </button>

          </div>
        </form>
      </div>
    </div>
  );
}

export default ProfileModal;
