const { Router } = require("express");
const { protect } = require("../middlewares/authMiddleware");
const { upload } = require("../middlewares/upload");
const userController = require("../controllers/userController");

const userRoute = Router();

userRoute.get("/me", protect, userController.getProfile);
userRoute.put("/me", protect, upload.single("avatar"), userController.updateProfile);

module.exports = userRoute;
