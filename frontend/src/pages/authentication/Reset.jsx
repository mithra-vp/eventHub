import React, { useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./reset.css";

const Reset = () => {
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Get email and otp passed from the VerifyResetOTP page
  const email = location.state?.email || "";
  const otp = location.state?.otp || "";

  // Your specific 6-character alphanumeric regex
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Validation for the new password field
    if (name === "newPassword") {
      if (!passwordRegex.test(value)) {
        setError("Min 6 chars, at least 1 letter and 1 number.");
      } else {
        setError("");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }

    if (error) {
      toast.error("Please meet the password requirements.");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post("http://localhost:8000/api/auth/reset-password", {
        email,
        otp,
        newPassword: formData.newPassword,
      });

      toast.success(res.data.message || "Password updated successfully!");
      
      // Redirect to login after success
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reset password.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-image-side">
          <div className="auth-overlay">
            <h1>Set a new password.</h1>
            <p>Use a strong password (min 6 characters, at least 1 letter and 1 number).</p>
          </div>
        </div>
        <div className="auth-form-side">
          <div className="auth-form">
            <h2>Reset Password</h2>
            <p className="subtitle">Create a new password for your account</p>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  placeholder="Enter new password"
                  className={error ? "input-error" : ""}
                  onChange={handleChange}
                  required
                />
                {error && <span className="error-msg">{error}</span>}
              </div>

              <div className="input-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm new password"
                  onChange={handleChange}
                  required
                />
              </div>

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reset;
