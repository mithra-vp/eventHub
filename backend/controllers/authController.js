const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const UserModel = require("../models/userModel"); // Ensure the path and case match your file

const trimEnv = (key) => (process.env[key] || "").toString().trim();

const getMailerConfig = () => {
  const smtpHost = trimEnv("SMTP_HOST");
  const smtpUser = trimEnv("SMTP_USER");
  const smtpPass = trimEnv("SMTP_PASS");
  const connectionTimeout = Number.parseInt(trimEnv("SMTP_CONNECTION_TIMEOUT") || "15000", 10);
  const greetingTimeout = Number.parseInt(trimEnv("SMTP_GREETING_TIMEOUT") || "10000", 10);
  const socketTimeout = Number.parseInt(trimEnv("SMTP_SOCKET_TIMEOUT") || "20000", 10);
  const dnsTimeout = Number.parseInt(trimEnv("SMTP_DNS_TIMEOUT") || "10000", 10);

  if (smtpHost && smtpUser && smtpPass) {
    const smtpPort = Number.parseInt(trimEnv("SMTP_PORT") || "587", 10);
    const smtpSecureRaw = trimEnv("SMTP_SECURE").toLowerCase();
    const smtpSecure = smtpSecureRaw ? smtpSecureRaw === "true" : smtpPort === 465;

    return {
      transport: {
        host: smtpHost,
        port: Number.isFinite(smtpPort) ? smtpPort : 587,
        secure: smtpSecure,
        connectionTimeout,
        greetingTimeout,
        socketTimeout,
        dnsTimeout,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      },
      from: trimEnv("MAIL_FROM") || smtpUser,
    };
  }

  const gmailUser = trimEnv("GMAIL_USER");
  const gmailPass = trimEnv("GMAIL_PASS");

  if (gmailUser && gmailPass) {
    return {
      transport: {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        connectionTimeout,
        greetingTimeout,
        socketTimeout,
        dnsTimeout,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      },
      from: trimEnv("MAIL_FROM") || gmailUser,
    };
  }

  return null;
};

const sendMail = async ({ to, subject, text }) => {
  const mailerConfig = getMailerConfig();
  if (!mailerConfig) {
    const err = new Error(
      "Email service is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS (recommended) or GMAIL_USER/GMAIL_PASS.",
    );
    err.code = "EMAIL_NOT_CONFIGURED";
    throw err;
  }

  const transporter = nodemailer.createTransport(mailerConfig.transport);
  return transporter.sendMail({
    from: mailerConfig.from,
    to,
    subject,
    text,
  });
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

const handleEmailFailure = (res, error) => {
  const code = error?.code;
  const message = error?.message || "Email delivery failed";

  // eslint-disable-next-line no-console
  console.error("Email send failed:", { code, message });

  if (code === "EMAIL_NOT_CONFIGURED") {
    return res.status(503).json({
      message:
        "Signup email service is not configured on server. Please configure SMTP/Gmail env vars and redeploy.",
    });
  }

  return res.status(503).json({
    message:
      "Could not send OTP email right now. Please try again in a moment or contact support.",
  });
};

const findUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  // Fast path: exact match on normalized email
  const exact = await UserModel.findOne({ email: normalizedEmail });
  if (exact) return exact;

  // Backward-compat: handle older data with uppercase/spaces in email
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

// Re-send signup OTP (for existing, unverified users)
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

    try {
      await sendMail({
        to: normalizedEmail,
        subject: "Verify your Event Management Account",
        text: `Your verification OTP is ${otp.value}. Valid for 10 minutes.`,
      });
    } catch (emailErr) {
      return handleEmailFailure(res, emailErr);
    }

    return res.status(200).json({ message: "OTP re-sent to email. Please verify." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// 1. SIGNUP with OTP Generation
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

      try {
        await sendMail({
          to: normalizedEmail,
          subject: "Verify your Event Management Account",
          text: `Your verification OTP is ${otp.value}. Valid for 10 minutes.`,
        });
      } catch (emailErr) {
        return handleEmailFailure(res, emailErr);
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

    try {
      await sendMail({
        to: normalizedEmail,
        subject: "Verify your Event Management Account",
        text: `Your verification OTP is ${otp.value}. Valid for 10 minutes.`,
      });
    } catch (emailErr) {
      return handleEmailFailure(res, emailErr);
    }

    res.status(201).json({ message: "OTP sent to email. Please verify." });
  } catch (error) {
    if (error?.code === 11000) {
      // Duplicate email (race condition). Try to resend OTP if the user isn't verified.
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
          try {
            await sendMail({
              to: normalizedEmail,
              subject: "Verify your Event Management Account",
              text: `Your verification OTP is ${otp.value}. Valid for 10 minutes.`,
            });
          } catch (emailErr) {
            return handleEmailFailure(res, emailErr);
          }
          return res.status(200).json({ message: "OTP re-sent to email. Please verify." });
        }
      } catch (_) {
        // Fall through to generic error response
      }

      return res.status(409).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

// 2. VERIFY OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await findUserByEmail(email);

    if (
      !user ||
      user.otp.value !== parseInt(otp) ||
      user.otp.expire < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.isVerified = true;
    user.otp.value = null;
    user.otp.expire = null;
    user.otp.cooldown = null;
    await user.save();

    res.status(200).json({ message: "Account verified successfully!" });
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
      // eslint-disable-next-line no-console
      console.warn("Login failed: password mismatch", { email: normalizedEmail, looksHashed });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_PRIVATE_KEY,
      { expiresIn: "1d" },
    );

    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

    // Set Cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // Required for sameSite: "None"
      sameSite: "None", // Required for cross-domain cookies
      maxAge: 24 * 60 * 60 * 1000,
    });

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
    sameSite: "None",
    secure: true,
  });
  res.status(200).json({ message: "Logged out" });
};

const me = async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

    // Logged-out is not an error for this endpoint; return a neutral auth state.
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
    user.otp = { value: otpValue, expire: Date.now() + 10 * 60 * 1000 };
    await user.save();

    try {
      await sendMail({
        to: normalizedEmail,
        subject: "Password Reset OTP",
        text: `Your reset OTP is ${otpValue}`,
      });
    } catch (emailErr) {
      return handleEmailFailure(res, emailErr);
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

    // --- FIX STARTS HERE ---
    // 1. Access the nested 'otp.value' from your schema
    // 2. Convert both to String to avoid "String vs Number" comparison errors
    if (!user.otp?.value || user.otp.value.toString() !== otp.toString()) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // 3. Check 'otp.expire' from your schema
    if (user.otp.expire < Date.now()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }
    // --- FIX ENDS HERE ---

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
