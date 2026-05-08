const { Router } = require("express");
const reviewController = require("../controllers/reviewController");
const { protect } = require("../middlewares/authMiddleware");

const reviewRoute = Router();

// Public
reviewRoute.get("/latest", reviewController.getLatestReviews);
reviewRoute.get("/event/:eventId", reviewController.getEventReviews);
reviewRoute.get("/event/:eventId/stats", reviewController.getEventRatingStats);

// Protected: current user's reviews
reviewRoute.get("/mine", protect, reviewController.myReviews);

// User only (protected) - controller enforces role=user and paid booking
reviewRoute.post("/", protect, reviewController.createReview);

module.exports = reviewRoute;
