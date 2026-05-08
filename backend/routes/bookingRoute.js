const { Router } = require("express");
const { protect } = require("../middlewares/authMiddleware");
const bookingController = require("../controllers/bookingController");

const bookingRoute = Router();

bookingRoute.post("/create-order", protect, bookingController.createOrder);
bookingRoute.post("/verify", protect, bookingController.verifyPayment);
bookingRoute.post("/:id/cancel", protect, bookingController.cancelAndRefund);
bookingRoute.get("/my", protect, bookingController.myBookings);
bookingRoute.get("/my-calendar", protect, bookingController.myCalendar);

module.exports = bookingRoute;
