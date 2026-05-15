import React, { useState } from "react";
import { api } from "../../api/client";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./for.css";

const ForgotPass = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(
        "/auth/forgot-password",
        { email },
      );

      toast.success(res.data.message || "Reset link sent!");

      setTimeout(() => {
        navigate("/verify-reset-otp", { state: { email } });
      }, 800);
    } catch (err) {
      toast.error(err.response?.data?.message || "Error");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-image-side">
          <div className="auth-overlay">
            <h1>Forgot password?</h1>
            <p>Enter your email to receive a 6‑digit OTP to reset your password.</p>
          </div>
        </div>
        <div className="auth-form-side">
          <div className="auth-form">
            <h2>Forgot Password</h2>
            <p className="subtitle">We’ll send an OTP to your email</p>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPass;
