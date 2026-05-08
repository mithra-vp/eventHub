const UserModel = require("../models/userModel");
const EventModel = require("../models/eventModel");

const getProfile = async (req, res) => {
  res.status(200).json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      avatarUrl: req.user.avatarUrl || null,
      phone: req.user.phone || "",
      favorites: req.user.favorites || [],
    },
  });
};

const updateProfile = async (req, res) => {
  try {
    const updates = {};

    if (typeof req.body?.name === "string") updates.name = req.body.name.trim();
    if (typeof req.body?.phone === "string") updates.phone = req.body.phone.trim();

    if (req.file?.path) {
      updates.avatarUrl = req.file.path;
    }

    const user = await UserModel.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.status(200).json({
      message: "Profile updated",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || null,
        phone: user.phone || "",
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const toggleFavorite = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await EventModel.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const user = await UserModel.findById(req.user._id);
    const already = user.favorites?.some((id) => id.toString() === eventId);

    if (already) {
      user.favorites = user.favorites.filter((id) => id.toString() !== eventId);
    } else {
      user.favorites.push(eventId);
    }
    await user.save();

    res.status(200).json({
      message: already ? "Removed from favorites" : "Added to favorites",
      favorites: user.favorites,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getFavorites = async (req, res) => {
  const user = await UserModel.findById(req.user._id)
    .populate("favorites")
    .select("-password");

  res.status(200).json({ favorites: user.favorites || [] });
};

module.exports = {
  getProfile,
  updateProfile,
  toggleFavorite,
  getFavorites,
};

