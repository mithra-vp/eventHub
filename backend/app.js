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

// 1. CORS FIRST
app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true,
}));

// 2. PARSERS SECOND (This prepares the data)
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
// 3. ROUTES LAST (This uses the prepared data)

app.get("/", (req, res) => {
  res.status(200).json({ 
    message: "EventHub API is live and running!",
    status: "Healthy" 
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
