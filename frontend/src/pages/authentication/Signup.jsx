import React, { useState } from 'react';
import { api } from "../../api/client";
import { useNavigate, Link } from 'react-router-dom';
import { FiX } from "react-icons/fi";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './signup.css';

const Signup = ({ isModal = false }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'user'
    });

    // State to track validation errors
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const navigate = useNavigate();

    // Regex Patterns
    const patterns = {
        name: /^[a-zA-Z\s]{3,30}$/, // 3-30 chars, letters and spaces only
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        password: /^[A-Za-z\d]{6,}$/ 
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });

        // Real-time validation
        if (patterns[name]) {
            const isValid = patterns[name].test(value);
            let errorMsg = "";
            
            if (!isValid) {
                if (name === "name") errorMsg = "Name must be 3-30 letters.";
                if (name === "email") errorMsg = "Enter a valid email address.";
                if (name === "password") errorMsg = "Password needs 6+ chars, 1 letter, 1 number.";
            }

            setErrors({ ...errors, [name]: errorMsg });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;

        // Check if there are any error messages before sending
        if (errors.name || errors.email || errors.password) {
            toast.error("Please fix the errors in the form.");
            return;
        }

        setSubmitting(true);
        try {
            const normalizedEmail = formData.email.toLowerCase().trim();
            const payload = { ...formData, email: normalizedEmail };
            const res = await api.post('/auth/signup', payload);
            toast.success(res.data.message || "OTP sent to your email!");
            sessionStorage.setItem("pendingSignupEmail", normalizedEmail);
            
            setTimeout(() => {
                const email = encodeURIComponent(normalizedEmail);
                navigate(`/verify-otp?email=${email}`);
            }, 800);
        } catch (err) {
            const status = err.response?.status;
            const message = err.response?.data?.message || "Signup failed!";
            toast.error(message);
            // If the email already exists (verified), guide user to login
            if (status === 409) {
                sessionStorage.removeItem("pendingSignupEmail");
                setTimeout(() => navigate('/login'), 900);
            }
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
                    <h1>Join EventHub.</h1>
                    <p>Join our community of event enthusiasts. Create an account to start exploring and booking amazing experiences.</p>
                </div>
            </div>
            <div className="auth-form-side">
                <div className="auth-form">
                    <h2>Create Account</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label>Full Name</label>
                            <input
                                type="text"
                                name="name"
                                placeholder="Enter your name"
                                className={errors.name ? "input-error" : ""}
                                onChange={handleChange}
                                required
                            />
                            {errors.name && <span className="error-msg">{errors.name}</span>}
                        </div>

                        <div className="input-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                name="email"
                                placeholder="Enter your email"
                                className={errors.email ? "input-error" : ""}
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
                                placeholder="Create a password"
                                className={errors.password ? "input-error" : ""}
                                onChange={handleChange}
                                required
                            />
                            {errors.password && <span className="error-msg">{errors.password}</span>}
                        </div>

                    <div className="input-group">
                        <label>Register As</label>
                        <div className="role-toggle" role="group" aria-label="Register as">
                            <button
                                type="button"
                                className={`role-btn ${formData.role === "user" ? "active" : ""}`}
                                onClick={() => setFormData({ ...formData, role: "user" })}
                            >
                                User
                            </button>
                            <button
                                type="button"
                                className={`role-btn ${formData.role === "admin" ? "active" : ""}`}
                                onClick={() => setFormData({ ...formData, role: "admin" })}
                            >
                                Admin
                            </button>
                        </div>
                    </div>

                        <button type="submit" className="auth-btn" disabled={submitting}>
                            {submitting ? "Sending..." : "Send OTP"}
                        </button>

                        <div className="auth-footer">
                            <p className="footer-text">
                                Already have an account? <Link to="/login" state={{ backgroundLocation: isModal ? -1 : null }}>Login here</Link>
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

export default Signup;
