const UserModel = require("../models/userModel");
const EventModel = require("../models/eventModel");
const BookingModel = require("../models/bookingModel");
const ReviewModel = require("../models/reviewModel");
const ActivityLogModel = require("../models/activityLogModel");

const verifiedUsersFilter = {
  $or: [
    { isVerified: true },
    // Backward compatibility for older records that pre-date isVerified
    { isVerified: { $exists: false }, "otp.value": null },
  ],
};

const listUsers = async (req, res) => {
  const users = await UserModel.find(verifiedUsersFilter)
    .select("-password -otp")
    .sort({ createdAt: -1 });
  res.status(200).json({ users });
};

const listPayments = async (req, res) => {
  const bookings = await BookingModel.find({ status: "paid" })
    .populate("user", "name email role")
    .populate("event", "title date category location price")
    .sort({ createdAt: -1 });

  res.status(200).json({ payments: bookings });
};

const monthlyRevenue = async (req, res) => {
  const now = new Date();
  const year = Number.parseInt(req.query.year, 10) || now.getFullYear();

  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const bookings = await BookingModel.find({
    status: "paid",
    createdAt: { $gte: start, $lt: end },
  }).select("amount createdAt");

  const months = Array.from({ length: 12 }, () => 0);
  for (const b of bookings) {
    const m = new Date(b.createdAt).getMonth();
    months[m] += Number(b.amount) || 0;
  }

  res.status(200).json({
    year,
    months: months.map((value, idx) => ({ month: idx + 1, revenue: value })),
    total: months.reduce((a, b) => a + b, 0),
  });
};

const upcomingReminders = async (req, res) => {
  const days = Number.parseInt(req.query.days, 10) || 30;
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const events = await EventModel.find({
    date: { $gte: now, $lte: end },
  })
    .select("title date category location image price attendees")
    .sort({ date: 1 });

  res.status(200).json({ days, events });
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  await UserModel.findByIdAndDelete(id);
  res.status(200).json({ message: "User deleted successfully" });
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;
  const user = await UserModel.findByIdAndUpdate(
    id,
    { name, email, role },
    { new: true }
  );
  res.status(200).json({ user });
};

const deletePayment = async (req, res) => {
  const { id } = req.params;
  await BookingModel.findByIdAndDelete(id);
  res.status(200).json({ message: "Payment record deleted successfully" });
};

const getActivityLog = async (req, res) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 25, 100);

    const [bookings, events, reviews, latestUsers, activityEntries] = await Promise.all([
      BookingModel.find()
        .populate("user", "name email")
        .populate("event", "title date")
        .sort({ createdAt: -1 })
        .limit(limit),

      EventModel.find()
        .populate("attendees", "name email")
        .select("title date attendees")
        .sort({ date: -1 })
        .limit(limit),

      ReviewModel.find()
        .populate("user", "name email")
        .populate("event", "title")
        .sort({ createdAt: -1 })
        .limit(limit),

      UserModel.find(verifiedUsersFilter)
        .select("name email role createdAt")
        .sort({ createdAt: -1 })
        .limit(10),

      ActivityLogModel.find()
        .populate("user", "name email")
        .populate("event", "title date attendees")
        .sort({ createdAt: -1 })
        .limit(limit),
    ]);

    res.status(200).json({
      bookings,
      eventStats: events,
      reviews,
      latestUsers,
      activityEntries,
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching activity log" });
  }
};

module.exports = {
  listUsers,
  listPayments,
  monthlyRevenue,
  upcomingReminders,
  deleteUser,
  updateUser,
  deletePayment,
  getActivityLog,
};
