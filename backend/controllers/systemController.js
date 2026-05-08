const mongoose = require("mongoose");
const { cloudinary } = require("../middlewares/upload");

const getRazorpayAuthHeader = () => {
  const keyId = (process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();

  if (!keyId || !keySecret) return null;

  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return `Basic ${token}`;
};

const cloudinaryPing = async (req, res) => {
  try {
    const result = await cloudinary.api.ping();
    res.status(200).json({
      ok: true,
      cloud_name: cloudinary.config().cloud_name,
      result,
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      cloud_name: cloudinary.config().cloud_name,
      message: error?.message || "Cloudinary ping failed",
      http_code: error?.http_code || null,
      name: error?.name || null,
    });
  }
};

const razorpayPing = async (req, res) => {
  try {
    if (typeof fetch !== "function") {
      return res.status(500).json({ ok: false, message: "Node fetch() not available in this runtime" });
    }

    const authHeader = getRazorpayAuthHeader();
    if (!authHeader) {
      return res.status(500).json({
        ok: false,
        message: "Razorpay keys missing in environment (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET)",
      });
    }

    const resp = await fetch("https://api.razorpay.com/v1/orders?count=1", {
      method: "GET",
      headers: { Authorization: authHeader },
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(502).json({
        ok: false,
        status: resp.status,
        message: "Razorpay ping failed",
        details: json,
      });
    }

    return res.status(200).json({ ok: true, status: resp.status });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      message: error?.message || "Razorpay ping failed",
    });
  }
};

const mongoStatus = async (req, res) => {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.status(200).json({
    ok: mongoose.connection.readyState === 1,
    state: states[mongoose.connection.readyState] || "unknown",
    db: mongoose.connection?.db?.databaseName || null,
  });
};

const health = async (req, res) => {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.status(200).json({
    ok: true,
    mongo: {
      ok: mongoose.connection.readyState === 1,
      state: states[mongoose.connection.readyState] || "unknown",
      db: mongoose.connection?.db?.databaseName || null,
    },
  });
};

module.exports = { cloudinaryPing, razorpayPing, mongoStatus, health };
