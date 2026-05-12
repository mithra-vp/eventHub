const { Router } = require('express');
const authController = require('../controllers/authController');
const { upload } = require('../middlewares/upload'); 
const { protect } = require('../middlewares/authMiddleware');
const systemController = require("../controllers/systemController");

const authRoute = Router();

authRoute.post('/signup', authController.signup);
authRoute.post('/resend-otp', authController.resendSignupOTP);

authRoute.post('/verify-otp', authController.verifyOTP);

authRoute.post('/login', authController.login);
authRoute.post('/logout', authController.logout);
authRoute.get('/me', authController.me);

authRoute.post('/forgot-password', authController.forgotPassword);
authRoute.post('/verify-reset-otp', authController.verifyResetOTP);

authRoute.post('/reset-password', authController.resetPassword);

authRoute.post('/upload', upload.single('file'), authController.uploadFile);
authRoute.get("/cloudinary-ping", protect, systemController.cloudinaryPing);
authRoute.get("/razorpay-ping", protect, systemController.razorpayPing);
authRoute.get("/mongo-status", protect, systemController.mongoStatus);
authRoute.get("/health", systemController.health);

module.exports = authRoute;
