const EventModel = require("../models/eventModel");

const normalizeCategory = (value) => {
  if (value === undefined || value === null) return value;
  const trimmed = String(value).trim();
  return trimmed.replace(/\s+/g, " ");
};

// --- ADMIN ONLY: Create a New Event ---
const createEvent = async (req, res) => {
  try {
    const now = Date.now();
    const windowMs = 2 * 60 * 1000; // 2 minutes
    const parsedDate = req.body?.date ? new Date(req.body.date) : null;

    const recentDuplicate = await EventModel.findOne({
      organizer: req.user._id,
      title: req.body?.title,
      description: req.body?.description,
      date: parsedDate || req.body?.date,
      location: req.body?.location,
      category: req.body?.category,
      price: Number(req.body?.price),
      createdAt: { $gte: new Date(now - windowMs) },
    });

    if (recentDuplicate) {
      return res.status(409).json({ message: "This event was already created. Please refresh the dashboard." });
    }

    const eventData = {
      ...req.body,
      category: normalizeCategory(req.body?.category),
      organizer: req.user._id,
      image: req.file ? req.file.path : null 
    };
    
    const newEvent = await EventModel.create(eventData);
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getEventCategories = async (req, res) => {
  try {
    const categories = await EventModel.distinct("category");
    const clean = (categories || [])
      .map((c) => normalizeCategory(c))
      .filter((c) => typeof c === "string" && c.length > 0);

    const unique = Array.from(new Set(clean.map((c) => c)));
    unique.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    res.status(200).json({ categories: unique });
  } catch (error) {
    res.status(500).json({ message: "Error fetching categories" });
  }
};

const getAllEvents = async (req, res) => {
  try {
    const { title, category } = req.query;
    const filter = {};

    if (title) {
      filter.title = { $regex: title, $options: "i" };
    }

    if (category && category !== "All") {
      filter.category = { $regex: `^${category}$`, $options: "i" };
    }

    const events = await EventModel.find(filter).populate("organizer", "name").sort({ date: 1 });
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: "Error fetching events" });
  }
};

const getFeaturedEvents = async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 3;
    const safeLimit = Math.min(Math.max(limit, 1), 12);

    const events = await EventModel.find()
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .populate("organizer", "name");

    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: "Error fetching featured events" });
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await EventModel.findById(req.params.id).populate("organizer", "name");
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.status(200).json(event);
  } catch (error) {
    res.status(400).json({ message: "Invalid event id" });
  }
};

// --- USER: Book an Event ---
const bookEvent = async (req, res) => {
  try {
    const event = await EventModel.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.attendees.includes(req.user.id)) {
      return res
        .status(400)
        .json({ message: "You have already booked this event" });
    }

    event.attendees.push(req.user.id);
    await event.save();

    res.status(200).json({ success: true, message: "Booking successful!" });
  } catch (error) {
    res.status(500).json({ message: "Booking failed", error: error.message });
  }
};

// --- ADMIN ONLY: Update Event ---
const updateEvent = async (req, res) => {
  try {
    const updates = {
      ...req.body,
    };

    if (updates.category !== undefined) {
      updates.category = normalizeCategory(updates.category);
    }

    if (req.file?.path) {
      updates.image = req.file.path;
    }

    const updatedEvent = await EventModel.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({ message: "Event updated", event: updatedEvent });
  } catch (error) {
    res.status(500).json({ message: "Update failed" });
  }
};

// --- ADMIN ONLY: Delete Event ---
const deleteEvent = async (req, res) => {
  try {
    await EventModel.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
};

module.exports = {
  createEvent,
  getEventCategories,
  getAllEvents,
  getFeaturedEvents,
  getEventById,
  bookEvent,
  updateEvent,
  deleteEvent,
};
