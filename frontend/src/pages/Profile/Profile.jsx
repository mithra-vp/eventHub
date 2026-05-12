import React, { useEffect, useState } from "react";
import "./profile.css";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { toast } from "react-toastify";
import { FiCamera, FiUser, FiPhone, FiMail, FiSave } from "react-icons/fi";

const Profile = () => {
  const { user, refresh, login } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [avatarFile, setAvatarFile] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!user) return;
    setForm({ name: user.name || "", phone: user.phone || "", email: user.email || "" });
    setPreview(user.avatarUrl || null);
  }, [user]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onAvatar = (e) => {
    const file = e.target.files?.[0];
    setAvatarFile(file || null);
    if (file) setPreview(URL.createObjectURL(file));
  };

  const onSave = async (e) => {
    e.preventDefault();
    const normalizedEmail = (form.email || "").trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setSaving(true);
    try {
      const data = new FormData();
      data.append("name", form.name);
      data.append("phone", form.phone);
      data.append("email", normalizedEmail);
      if (avatarFile) data.append("avatar", avatarFile);

      const res = await api.put("/users/me", data);
      login(res.data.user);
      await refresh();
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <h1 className="profile-title">Account <span>Settings</span></h1>
          <p className="profile-subtitle">Manage your personal information and preferences.</p>
        </div>

        <form onSubmit={onSave} className="profile-grid">
          <div className="profile-card profile-visual-side">
            <div className="profile-avatar-wrapper">
              <div className="avatar-preview">
                {preview ? <img src={preview} alt="avatar" /> : <div className="avatar-placeholder">{(user?.name || "U")[0].toUpperCase()}</div>}
                <label className="avatar-upload-label" htmlFor="avatar-input">
                  <FiCamera size={20} />
                </label>
              </div>
              <input id="avatar-input" type="file" accept="image/*" onChange={onAvatar} style={{display: 'none'}} />
              <div className="profile-id-info">
                <h3>{user?.name}</h3>
                <p>{user?.role?.toUpperCase()}</p>
              </div>
            </div>
          </div>

          <div className="profile-card profile-form-side">
            <div className="profile-form-group">
              <label><FiUser size={14} /> Full Name</label>
              <input name="name" value={form.name} onChange={onChange} required placeholder="Enter your name" />
            </div>

            <div className="profile-form-group">
              <label><FiPhone size={14} /> Phone Number</label>
              <input name="phone" value={form.phone} onChange={onChange} placeholder="e.g. +91 9876543210" />
            </div>

            <div className="profile-form-group">
              <label><FiMail size={14} /> Email Address</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                placeholder="Enter your email address"
                required
              />
              <span className="input-hint">Use an active email you can access.</span>
            </div>

            <button className="eh-btn-nav" type="submit" disabled={saving} style={{width: '100%', marginTop: '12px', justifyContent: 'center'}}>
              <FiSave style={{marginRight: '8px'}} /> {saving ? "Saving Changes..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
