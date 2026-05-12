import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import "./login.css"; 
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";

const Login = ({ isModal = false }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" }); // To track regex errors
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Define your Regex patterns
  const patterns = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    password: /^[A-Za-z\d]{6,}$/ 
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Validate as the user types
    if (patterns[name]) {
      const isValid = patterns[name].test(value);
      setErrors({
        ...errors,
        [name]: isValid ? "" : `Invalid ${name} format`
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    
    // Final check before sending to backend
    if (errors.email || errors.password) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post("/auth/login", formData);
      login(res.data.user);
      toast.success("Login Successful!");
      setTimeout(() => {
        if (res.data.user?.role === "admin") navigate("/dashboard");
        else navigate("/");
      }, 1200);
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
      setSubmitting(false);
    }
  };

  const content = (
    <div className="auth-shell">
      {isModal && (
        <button className="auth-modal-close" onClick={() => navigate(-1)}>
          <FiX size={20} />
        </button>
      )}
      <div className="auth-image-side">
        <div className="auth-overlay">
          <h1>Hello, EventHub.</h1>
          <p>Sign in to access your dashboard, discover exclusive events, and manage your bookings effortlessly.</p>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-form">
          <h2>Login</h2>
          <p className="subtitle">Welcome back — let’s continue</p>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                className={errors.email ? "input-error" : ""}
                placeholder="Enter your email"
                onChange={handleChange}
                required
              />
              {errors.email && <span className="error-msg">{errors.email}</span>}
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                className={errors.password ? "input-error" : ""}
                placeholder="Enter your password"
                onChange={handleChange}
                required
              />
              {errors.password && <span className="error-msg">{errors.password}</span>}
            </div>

            <button type="submit" className="auth-btn" disabled={submitting}>
              {submitting ? "Logging in..." : "Login"}
            </button>

            <div className="auth-footer">
              <p className="redirect-text">
                Don't have an account? <Link to="/signup" state={{ backgroundLocation: isModal ? -1 : null }}>Register here</Link>
              </p>
              <p className="redirect-text">
                <Link to="/forgot-password">Forgot Password?</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="auth-modal-overlay" onClick={() => navigate(-1)}>
        <div className="auth-modal-container" onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      {content}
    </div>
  );
};

export default Login;
