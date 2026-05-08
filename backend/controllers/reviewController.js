const mongoose = require("mongoose");
const ReviewModel = require("../models/reviewModel");
const BookingModel = require("../models/bookingModel");
const EventModel = require("../models/eventModel");

const parseLimit = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, 50);
};

// USER ONLY: create a review (only if user has a paid booking for the event)
const createReview = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== "user") return res.status(403).json({ message: "Only users can add reviews" });

    const { eventId, rating, text } = req.body || {};
    if (!eventId) return res.status(400).json({ message: "eventId is required" });
    if (!mongoose.Types.ObjectId.isValid(eventId)) return res.status(400).json({ message: "Invalid eventId" });

    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "rating must be a number between 1 and 5" });
    }

    const reviewText = String(text || "").trim();
    if (reviewText.length < 5) return res.status(400).json({ message: "text is required" });
    if (reviewText.length > 500) return res.status(400).json({ message: "text too long (max 500 chars)" });

    const event = await EventModel.findById(eventId).select("_id");
    if (!event) return res.status(404).json({ message: "Event not found" });

    const hasPaidBooking = await BookingModel.exists({
      user: req.user._id,
      event: event._id,
      status: "paid",
    });
    if (!hasPaidBooking) {
      return res.status(403).json({ message: "You can review only after a successful booking" });
    }

    const created = await ReviewModel.create({
      user: req.user._id,
      event: event._id,
      rating: numericRating,
      text: reviewText,
    });

    const populated = await ReviewModel.findById(created._id).populate("user", "name avatarUrl");
    return res.status(201).json({ message: "Review added", review: populated });
  } catch (error) {
    // duplicate key (one review per user per event)
    if (error?.code === 11000) {
      return res.status(409).json({ message: "You already reviewed this event" });
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// PUBLIC: list reviews for an event
const getEventReviews = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) return res.status(400).json({ message: "Invalid eventId" });

    const limit = parseLimit(req.query.limit, 20);
    const reviews = await ReviewModel.find({ event: eventId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("user", "name avatarUrl");

    return res.status(200).json({ reviews });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// PUBLIC: latest reviews for Home carousel
const getLatestReviews = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 8);
    const reviews = await ReviewModel.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("user", "name avatarUrl")
      .populate("event", "title");

    return res.status(200).json({ reviews });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// PUBLIC: rating stats for an event (avg + count)
const getEventRatingStats = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) return res.status(400).json({ message: "Invalid eventId" });

    const agg = await ReviewModel.aggregate([
      { $match: { event: new mongoose.Types.ObjectId(eventId) } },
      {
        $group: {
          _id: "$event",
          count: { $sum: 1 },
          avgRating: { $avg: "$rating" },
        },
      },
    ]);

    const row = agg[0] || { count: 0, avgRating: 0 };
    return res.status(200).json({
      count: row.count || 0,
      avgRating: row.avgRating ? Math.round(row.avgRating * 10) / 10 : 0,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

module.exports = {
  createReview,
  getEventReviews,
  getLatestReviews,
  getEventRatingStats,
  // Protected helpers
  myReviews: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      const query = { user: req.user._id };
      if (req.query?.eventId) query.event = req.query.eventId;

      const reviews = await ReviewModel.find(query)
        .sort({ createdAt: -1 })
        .populate("event", "title");

      return res.status(200).json({ reviews });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Server error" });
    }
  },
};
