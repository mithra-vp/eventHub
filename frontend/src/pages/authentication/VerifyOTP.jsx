import React, { useMemo, useState } from "react";
import { api } from "../../api/client";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./login.css";
import "./verify.css";

const VerifyOTP = () => {
  const [otp, setOtp] = useState(new Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const email = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("email") || location.state?.email || "";
  }, [location.search, location.state]);

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
    if (!email) return toast.error("Missing email. Please sign up again.");

    setLoading(true);
    try {
      const res = await api.post(
        "/auth/verify-otp",
        { email, otp: otp.join("") }
      );
      toast.success(res.data?.message || "Verified");
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      toast.error(err.response?.data?.message || "Verification failed");
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resending) return;
    if (!email) return toast.error("Missing email. Please sign up again.");

    try {
      setResending(true);
      const res = await api.post("/auth/resend-otp", { email });
      toast.success(res.data?.message || "OTP re-sent");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-image-side">
          <div className="auth-overlay">
            <h1>Verify your email.</h1>
            <p>Enter the 6-digit code sent to {email || "your email"}.</p>
          </div>
        </div>
        <div className="auth-form-side">
          <div className="auth-form">
            <h2>Verify Email</h2>
            <p className="subtitle">Enter the OTP to complete registration</p>

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
                {loading ? "Verifying..." : "Verify Account"}
              </button>
            </form>

            <div className="auth-footer">
              <p className="footer-text">
                Didn&apos;t get the code?{" "}
                <button type="button" className="linklike" onClick={resendOtp} disabled={resending}>
                  {resending ? "Resending..." : "Resend OTP"}
                </button>
              </p>
              <p className="footer-text">
                Want to change email? <Link to="/signup">Go back</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
