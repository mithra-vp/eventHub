const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/userModel"); // Ensure the path and case match your file

const trimEnv = (key) => (process.env[key] || "").toString().trim();

const getEmailConfig = () => {
  const gmailUser = trimEnv("GMAIL_USER");
  const gmailClientId = trimEnv("GMAIL_CLIENT_ID");
  const gmailClientSecret = trimEnv("GMAIL_CLIENT_SECRET");
  const gmailRefreshToken = trimEnv("GMAIL_REFRESH_TOKEN");
  const fromEmail = trimEnv("EMAIL_FROM") || trimEnv("MAIL_FROM") || gmailUser;
  const fromName = trimEnv("EMAIL_FROM_NAME");

  if (!gmailUser || !gmailClientId || !gmailClientSecret || !gmailRefreshToken) {
    return null;
  }

  return {
    gmailUser,
    gmailClientId,
    gmailClientSecret,
    gmailRefreshToken,
    from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
  };
};

const mapNetworkErrorCode = (error) => {
  const known = error?.code || error?.cause?.code;
  if (!known) return "ECONNECTION";
  return known;
};

const toBase64Url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const getGmailAccessToken = async (emailConfig) => {
  let response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: emailConfig.gmailClientId,
        client_secret: emailConfig.gmailClientSecret,
        refresh_token: emailConfig.gmailRefreshToken,
        grant_type: "refresh_token",
      }),
    });
  } catch (error) {
    const err = new Error("Could not reach Google OAuth token endpoint.");
    err.code = mapNetworkErrorCode(error);
    throw err;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.access_token) {
    const err = new Error(payload?.error_description || payload?.error || "Failed to get Gmail access token.");
    if (response.status === 401 || response.status === 403) {
      err.code = "EOAUTH2";
    } else if (response.status === 429) {
      err.code = "EMAIL_RATE_LIMITED";
    } else if (response.status >= 500) {
      err.code = "EMAIL_PROVIDER_UNAVAILABLE";
    } else {
      err.code = "EOAUTH2_TOKEN";
    }
    err.responseCode = response.status;
    err.response = payload;
    throw err;
  }

  return payload.access_token;
};

const sendMail = async ({ to, subject, text }) => {
  const emailConfig = getEmailConfig();
  if (!emailConfig) {
    const err = new Error(
      "Email service is not configured. Set Gmail API OAuth credentials in environment variables.",
    );
    err.code = "EMAIL_NOT_CONFIGURED";
    throw err;
  }

  const accessToken = await getGmailAccessToken(emailConfig);
  const mimeMessage = [
    `From: ${emailConfig.from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    text,
  ].join("\r\n");

  const raw = toBase64Url(mimeMessage);

  let response;
  try {
    response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
  } catch (error) {
    const err = new Error("Could not reach Gmail API send endpoint.");
    err.code = mapNetworkErrorCode(error);
    throw err;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(payload?.error?.message || "Gmail API failed to send email.");
    if (response.status === 401 || response.status === 403) {
      err.code = "EOAUTH2";
    } else if (response.status === 429) {
      err.code = "EMAIL_RATE_LIMITED";
    } else if (response.status === 408) {
      err.code = "ETIMEDOUT";
    } else if (response.status >= 500) {
      err.code = "EMAIL_PROVIDER_UNAVAILABLE";
    } else {
      err.code = "EMAIL_DELIVERY_FAILED";
    }
    err.responseCode = response.status;
    err.response = payload;
    throw err;
  }

  return payload;
};

const normalizeEmail = (email) => (email || "").toString().trim().toLowerCase();
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 30 * 1000;

const generateOtp = () => {
  const value = Math.floor(100000 + Math.random() * 900000);
  const now = Date.now();
  return {
    value,
    expire: now + OTP_EXPIRY_MS,
    cooldown: now + OTP_COOLDOWN_MS,
  };
};

const shouldUseSecureCookie = (req) => {
  return (
    process.env.NODE_ENV === "production" ||
    req.secure ||
    req.headers["x-forwarded-proto"] === "https"
  );
};

const getAuthCookieOptions = (req) => {
  const secure = shouldUseSecureCookie(req);
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "None" : "Lax",
    maxAge: 24 * 60 * 60 * 1000,
  };
};

const allowOtpDebugFallback = () => {
  const flag = (process.env.ALLOW_OTP_DEBUG_FALLBACK || "").toLowerCase();
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "production";
};

const extractOtpFromText = (text) => {
  const match = String(text || "").match(/\b(\d{6})\b/);
  return match?.[1] || null;
};

const sendOtpMail = async ({ to, subject, text }) => {
  try {
    await sendMail({ to, subject, text });
    return { delivered: true, fallback: false, debugOtp: null };
  } catch (emailErr) {
    if (!allowOtpDebugFallback()) {
      throw emailErr;
    }

    const debugOtp = extractOtpFromText(text);
    console.warn("OTP email delivery failed; using debug fallback in non-production mode.", {
      to,
      subject,
      code: emailErr?.code,
    });

    return {
      delivered: false,
      fallback: true,
      debugOtp,
      error: emailErr,
    };
  }
};

const handleEmailFailure = (res, error) => {
  const code = error?.code;
  const message = error?.message || "Email delivery failed";
  const responseCode = error?.responseCode;
  const response = error?.response;

  console.error("Email send failed:", { code, message, responseCode, response });

  if (code === "EMAIL_NOT_CONFIGURED") {
    return res.status(503).json({
      message:
        "Signup email service is not configured on server. Configure Gmail app password or Gmail API OAuth credentials and redeploy.",
      emailFallbackCode: "config_missing",
    });
  }

  if (code === "EAUTH" || code === "ENOAUTH" || code === "EOAUTH2" || code === "EOAUTH2_TOKEN") {
    return res.status(503).json({
      message:
        "Email authentication failed on server. Update Gmail credentials and redeploy.",
      emailFallbackCode: "auth_failed",
    });
  }

  if (code === "ETIMEDOUT") {
    return res.status(503).json({
      message:
        "Email provider timeout from server. Please retry in a moment.",
      emailFallbackCode: "timeout",
    });
  }

  if (code === "EMAIL_RATE_LIMITED") {
    return res.status(429).json({
      message:
        "Email sending is rate-limited by Google right now. Please wait and try again.",
      emailFallbackCode: "rate_limited",
    });
  }

  if (code === "EMAIL_PROVIDER_UNAVAILABLE") {
    return res.status(503).json({
      message:
        "Google email service is temporarily unavailable. Please retry shortly.",
      emailFallbackCode: "provider_unavailable",
    });
  }

  if (code === "ECONNECTION" || code === "ESOCKET" || code === "EDNS" || code === "ETLS") {
    return res.status(503).json({
      message:
        "Server could not connect to Google email endpoints. Check network/firewall and retry.",
      emailFallbackCode: "connection_failed",
    });
  }

  return res.status(503).json({
    message:
      "Could not send OTP email right now. Please try again in a moment or contact support.",
    emailFallbackCode: "delivery_failed",
  });
};

const findUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const exact = await UserModel.findOne({ email: normalizedEmail });
  if (exact) return exact;

  return UserModel.findOne({
    email: { $regex: new RegExp(`^${escapeRegExp(normalizedEmail)}$`, "i") },
  });
};

const isUserVerified = (user) => {
  if (!user) return false;
  if (typeof user.isVerified === "boolean") return user.isVerified;
  // Legacy behavior: if they have no pending OTP, treat as verified
  return !user.otp?.value;
};

const resendSignupOTP = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) return res.status(400).json({ message: "Invalid email" });

    const user = await findUserByEmail(normalizedEmail);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (isUserVerified(user)) {
      return res.status(409).json({ message: "Account already verified. Please login." });
    }

    if (user.otp?.cooldown && user.otp.cooldown > Date.now()) {
      return res.status(429).json({
        message: "OTP recently sent. Please wait 30 seconds and try again.",
      });
    }

    const otp = generateOtp();
    user.otp = otp;
    await user.save();

    const delivery = await sendOtpMail({
      to: normalizedEmail,
      subject: "Verify your Event Management Account",
      text: `Your verification OTP is ${otp.value}. Valid for 10 minutes.`,
    });

    if (delivery.fallback) {
      return res.status(200).json({
        message: "OTP generated locally because email service is unavailable.",
        debugOtp: delivery.debugOtp,
        emailDeliveryMode: "dev_fallback",
      });
    }

    return res.status(200).json({ message: "OTP re-sent to email. Please verify." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Strong Validation (Regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^[A-Za-z\d]{6,}$/;

    if (!emailRegex.test(normalizedEmail))
      return res.status(400).json({ message: "Invalid email" });
    if (!passwordRegex.test(password))
      return res
        .status(400)
        .json({
          message: "Password must be at least 6 characters (letters/numbers).",
        });

    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      if (isUserVerified(existingUser)) {
        return res.status(409).json({ message: "Email already exists" });
      }

      if (existingUser.otp?.cooldown && existingUser.otp.cooldown > Date.now()) {
        return res.status(429).json({
          message: "OTP recently sent. Please wait 30 seconds and try again.",
        });
      }

      const otp = generateOtp();
      existingUser.otp = otp;
      await existingUser.save();

      const delivery = await sendOtpMail({
        to: normalizedEmail,
        subject: "Verify your Event Management Account",
        text: `Your verification OTP is ${otp.value}. Valid for 10 minutes.`,
      });

      if (delivery.fallback) {
        return res.status(200).json({
          message: "OTP generated locally because email service is unavailable.",
          debugOtp: delivery.debugOtp,
          emailDeliveryMode: "dev_fallback",
        });
      }

      return res.status(200).json({ message: "OTP re-sent to email. Please verify." });
    }

    const otp = generateOtp();

    const hashedPassword = await bcrypt.hash(password, 10);

    await UserModel.create({
      name: (name || "").toString().trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role || "user",
      isVerified: false,
      otp,
    });

    const delivery = await sendOtpMail({
      to: normalizedEmail,
      subject: "Verify your Event Management Account",
      text: `Your verification OTP is ${otp.value}. Valid for 10 minutes.`,
    });

    if (delivery.fallback) {
      return res.status(201).json({
        message: "OTP generated locally because email service is unavailable.",
        debugOtp: delivery.debugOtp,
        emailDeliveryMode: "dev_fallback",
      });
    }

    res.status(201).json({ message: "OTP sent to email. Please verify." });
  } catch (error) {
    if (error?.code === 11000) {
      try {
        const normalizedEmail = normalizeEmail(req.body?.email);
        const existingUser = await findUserByEmail(normalizedEmail);
        if (existingUser && !isUserVerified(existingUser)) {
          if (existingUser.otp?.cooldown && existingUser.otp.cooldown > Date.now()) {
            return res.status(429).json({
              message: "OTP recently sent. Please wait 30 seconds and try again.",
            });
          }

          const otp = generateOtp();
          existingUser.otp = otp;
          await existingUser.save();
          const delivery = await sendOtpMail({
            to: normalizedEmail,
            subject: "Verify your Event Management Account",
            text: `Your verification OTP is ${otp.value}. Valid for 10 minutes.`,
          });

          if (delivery.fallback) {
            return res.status(200).json({
              message: "OTP generated locally because email service is unavailable.",
              debugOtp: delivery.debugOtp,
              emailDeliveryMode: "dev_fallback",
            });
          }
          return res.status(200).json({ message: "OTP re-sent to email. Please verify." });
        }
      } catch (_) {
      }

      return res.status(409).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

// 2. VERIFY OTP
const verifyOTP = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const otpRaw = (req.body?.otp || "").toString().trim();

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!/^\d{6}$/.test(otpRaw)) {
      return res.status(400).json({ message: "OTP must be a 6-digit code" });
    }

    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    if (isUserVerified(user)) {
      return res.status(409).json({ message: "Account already verified. Please login." });
    }

    if (
      !user.otp?.value ||
      user.otp.value !== parseInt(otpRaw, 10) ||
      !user.otp?.expire ||
      user.otp.expire < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.isVerified = true;
    user.otp.value = null;
    user.otp.expire = null;
    user.otp.cooldown = null;
    await user.save();

    res.status(200).json({ message: "Signup successful. Your email is verified. Please login." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const user = await findUserByEmail(email);

    if (!user) {
      // eslint-disable-next-line no-console
      console.warn("Login failed: user not found", { email: normalizedEmail });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!isUserVerified(user)) {
      return res.status(403).json({ message: "Please verify your email first" });
    }

    const candidatePassword = (password || "").toString().trim();
    const stored = (user.password || "").toString();
    const looksHashed = stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$");

    let ok = false;
    if (looksHashed) {
      ok = await bcrypt.compare(candidatePassword, stored);
    } else {
      // If someone manually inserted users into DB with plaintext password, allow one-time migration
      ok = candidatePassword === stored;
      if (ok) {
        user.password = await bcrypt.hash(candidatePassword, 10);
        await user.save();
      }
    }

    if (!ok) {
      console.warn("Login failed: password mismatch", { email: normalizedEmail, looksHashed });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_PRIVATE_KEY,
      { expiresIn: "1d" },
    );

    // Set Cookie
    res.cookie("token", token, getAuthCookieOptions(req));

    res.status(200).json({
      message: "Login successful",
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const logout = async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: shouldUseSecureCookie(req) ? "None" : "Lax",
    secure: shouldUseSecureCookie(req),
  });
  res.status(200).json({ message: "Logged out" });
};

const me = async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(200).json({ user: null });
    }

    const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
    const user = await UserModel.findById(decoded.id || decoded._id).select("-password");

    if (!user) {
      return res.status(200).json({ user: null });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || null,
        phone: user.phone || "",
      },
    });
  } catch (_) {
    return res.status(200).json({ user: null });
  }
};
// 4. FORGOT PASSWORD
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const user = await findUserByEmail(normalizedEmail);
    if (!user) return res.status(404).json({ message: "User not found" });

    const otpValue = Math.floor(100000 + Math.random() * 900000);
    user.otp = {
      value: otpValue,
      expire: Date.now() + 10 * 60 * 1000,
      cooldown: Date.now() + 30 * 1000,
    };
    await user.save();

    const delivery = await sendOtpMail({
      to: normalizedEmail,
      subject: "Password Reset OTP",
      text: `Your reset OTP is ${otpValue}`,
    });

    if (delivery.fallback) {
      return res.status(200).json({
        message: "Reset OTP generated locally because email service is unavailable.",
        debugOtp: delivery.debugOtp,
        emailDeliveryMode: "dev_fallback",
      });
    }

    res.status(200).json({ message: "Reset OTP sent to email" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }


    if (!user.otp?.value || user.otp.value.toString() !== otp.toString()) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otp.expire < Date.now()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    user.otp.cooldown = null;

    res.status(200).json({
      success: true,
      message: "OTP verified successfully."
    });

  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
// 5. RESET PASSWORD
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await findUserByEmail(email);

    if (
      !user ||
      user.otp.value !== parseInt(otp) ||
      user.otp.expire < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp.value = null;
    user.otp.expire = null;
    user.otp.cooldown = null;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 6. UPLOAD FILE (Cloudinary)
const uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    return res.status(201).json({
      message: "File uploaded successfully",
      imageUrl: req.file.path,
      publicId: req.file.filename,
    });
  } catch (error) {
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
};

module.exports = {
  signup,
  resendSignupOTP,
  verifyOTP,
  login,
  logout,
  me,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  uploadFile,
};
