const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: false },
    location: { type: String, required: true },
    category: { 
      type: String, 
      required: true,
      trim: true,
      enum: ["Professional & Educational", "Entertainment", "Arts", "Tech", "Festival", "Sports", "Other"],
      default: "Other"
    },
    price: { type: Number, required: true },
    image: { type: String, required: false }, // Set to false until you add upload logic
    
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    attendees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

const EventModel = mongoose.model("Event", eventSchema);
module.exports = EventModel;
