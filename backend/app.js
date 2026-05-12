const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const connect_db = require('./config/db');
const authRoute = require('./routes/authRoute');
const cookieParser = require('cookie-parser');
const eventRoute = require('./routes/eventRoute');
const userRoute = require("./routes/userRoute");
const bookingRoute = require("./routes/bookingRoute");
const adminRoute = require("./routes/adminRoute");
const reviewRoute = require("./routes/reviewRoute");

const app = express();
connect_db();
const allowAllCors = (process.env.ALLOW_ALL_CORS || "").toLowerCase() === "true";

const parseCsv = (value) =>
  (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://event-hub-hjic.vercel.app",
];

const envAllowedOrigins = parseCsv(process.env.CORS_ORIGINS);
const exactAllowedOrigins = new Set([...defaultAllowedOrigins, ...envAllowedOrigins]);

const envAllowedHostSuffixes = parseCsv(process.env.CORS_ALLOWED_HOST_SUFFIXES)
  .map((s) => s.toLowerCase())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (allowAllCors) return true;
  if (!origin) return true; // server-to-server / curl / postman
  if (exactAllowedOrigins.has(origin)) return true;

  try {
    const { hostname, protocol } = new URL(origin);

    // Always allow localhost dev origins on any port
    if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) return true;

    if (protocol !== "https:") return false;

    // Backward-compatible default: allow this project's Vercel URLs.
    if (hostname === "event-hub-hjic.vercel.app") return true;
    if (hostname.startsWith("event-hub-hjic-") && hostname.endsWith(".vercel.app")) return true;

    // Deployment-safe extension: allow custom host suffixes via env
    // Example: CORS_ALLOWED_HOST_SUFFIXES=.vercel.app,.netlify.app
    if (envAllowedHostSuffixes.some((suffix) => hostname.endsWith(suffix))) return true;
  } catch (_) {
    return false;
  }

  return false;
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin || "unknown"}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api", (req, res) => {
  res.status(200).json({ 
    message: "EventHub API is live and running!"
  });
});

app.use('/api/auth', authRoute);
app.use('/api/events', eventRoute);
app.use("/api/users", userRoute);
app.use("/api/bookings", bookingRoute);
app.use("/api/admin", adminRoute);
app.use("/api/reviews", reviewRoute);

app.use((err, req, res, next) => {
  if (err?.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image too large (max 2MB)"
        : err.message || "Upload error";
    return res.status(400).json({ message });
  }

  const cloudinaryCode = err?.http_code || err?.statusCode || err?.status;
  const isCloudinary403 =
    cloudinaryCode === 403 ||
    (typeof err?.message === "string" &&
      err.message.includes("Server returned unexpected status code - 403"));

  if (isCloudinary403) {
    console.error("Cloudinary upload error (403):", err);

    const detail =
      err?.error?.message ||
      err?.message ||
      "Forbidden";
    return res.status(502).json({
      message:
        `Cloudinary upload failed (403). ${detail}. Check CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET and Cloudinary account permissions.`,
    });
  }

  if (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }

  return next();
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
