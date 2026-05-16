const { Router } = require("express");
const reviewController = require("../controllers/reviewController");
const { protect } = require("../middlewares/authMiddleware");

const reviewRoute = Router();

reviewRoute.get("/latest", reviewController.getLatestReviews);
reviewRoute.get("/event/:eventId", reviewController.getEventReviews);
reviewRoute.get("/event/:eventId/stats", reviewController.getEventRatingStats);

reviewRoute.get("/mine", protect, reviewController.myReviews);

reviewRoute.post("/", protect, reviewController.createReview);

module.exports = reviewRoute;
