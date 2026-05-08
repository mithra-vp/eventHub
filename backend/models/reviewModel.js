const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 500,
    },
  },
  { timestamps: true },
);

// One review per user per event
reviewSchema.index({ user: 1, event: 1 }, { unique: true });

const ReviewModel = mongoose.model("Review", reviewSchema);
module.exports = ReviewModel;

