import React, { useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./verify.css"; 


const VerifyResetOTP = () => {
  const [otp, setOtp] = useState(new Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Retrieve email from ForgotPass state
  const email = location.state?.email || "";

  const handleChange = (element, index) => {
    if (isNaN(element.value)) return false;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    // Focus next input
    if (element.nextSibling && element.value !== "") {
      element.nextSibling.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (otp[index] === "" && e.target.previousSibling) {
        e.target.previousSibling.focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const data = e.clipboardData.getData("text").trim().slice(0, 6);
    if (!/^\d+$/.test(data)) return;

    const newOtp = [...otp];
    data.split("").forEach((char, index) => {
      newOtp[index] = char;
    });
    setOtp(newOtp);

    // Focus appropriate field
    const inputs = document.querySelectorAll(".otp-field");
    const nextIndex = Math.min(data.length, 5);
    inputs[nextIndex]?.focus();
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const otpValue = otp.join("");
    // Regex check: Ensure exactly 6 digits
    if (!/^\d{6}$/.test(otpValue)) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        "http://localhost:8000/api/auth/verify-reset-otp",
        { email, otp: otp.join("") },
      );

      toast.success("Identity Verified!");

      // IMPORTANT: Pass email and OTP to the final reset page
      // so the backend knows which user is changing the password.
      setTimeout(() => {
        navigate("/reset-password", { state: { email, otp: otp.join("") } });
      }, 800);
    } catch (err) {             
      toast.error(err.response?.data?.message || "Invalid or expired OTP");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-image-side">
          <div className="auth-overlay">
            <h1>Reset verification.</h1>
            <p>Enter the 6‑digit OTP sent to {email || "your email"}.</p>
          </div>
        </div>
        <div className="auth-form-side">
          <div className="auth-form">
            <h2>Verify OTP</h2>
            <p className="subtitle">Confirm your identity to reset password</p>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>OTP Code</label>
                <div className="otp-container">
                  {otp.map((data, index) => (
                    <input
                      key={index}
                      className="otp-field"
                      type="text"
                      name="otp"
                      maxLength="1"
                      value={data}
                      onChange={(e) => handleChange(e.target, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      onFocus={(e) => e.target.select()}
                      onPaste={handlePaste}
                      required
                    />
                  ))}
                </div>
              </div>

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyResetOTP;


//Event1@
