const jwt = require("jsonwebtoken");
const UserModel = require("../models/userModel");

const protect = async (req, res, next) => {
  // 1. Get token from cookies (sent via withCredentials)
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
    
    // 2. Attach user to request so your controller can use req.user._id
    // We check both id and _id to be safe
    const user = await UserModel.findById(decoded.id || decoded._id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Admin access required" });
  }
};

module.exports = { protect, isAdmin };