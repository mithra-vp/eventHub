const crypto = require("crypto");
const EventModel = require("../models/eventModel");
const BookingModel = require("../models/bookingModel");
const ActivityLogModel = require("../models/activityLogModel");

const writeActivityLog = async ({ userId, eventId, bookingId, type, message, meta = {} }) => {
  try {
    await ActivityLogModel.create({
      user: userId || null,
      event: eventId || null,
      booking: bookingId || null,
      type,
      message,
      meta,
    });
  } catch (error) {
    console.error("Failed to write activity log:", error);
  }
};

const getRazorpayAuthHeader = () => {
  const keyId = (process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();

  if (!keyId || !keySecret) {
    return null;
  }

  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return `Basic ${token}`;
};

const fetchRazorpayPayment = async (paymentId, authHeader) => {
  const paymentResp = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
  });

  const paymentJson = await paymentResp.json();
  return { ok: paymentResp.ok, status: paymentResp.status, data: paymentJson };
};

const createOrder = async (req, res) => {
  try {
    if (typeof fetch !== "function") {
      return res.status(500).json({ message: "Node fetch() not available in this runtime" });
    }

    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ message: "eventId is required" });

    const event = await EventModel.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const authHeader = getRazorpayAuthHeader();
    if (!authHeader) {
      return res.status(500).json({
        message: "Razorpay keys missing in environment (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET)",
      });
    }

    const amountPaise = Math.round(Number(event.price) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ message: "Invalid event price" });
    }
    if (amountPaise > 1000000000) {
      return res.status(400).json({ message: "Event price too large for Razorpay" });
    }

    const receipt = `evt_${String(event._id).slice(-8)}_${Date.now().toString(36)}`;

    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: {
          eventId: String(event._id),
          userId: String(req.user._id),
        },
      }),
    });

    const orderJson = await orderResponse.json();
    if (!orderResponse.ok) {
      console.error("Razorpay order creation failed:", orderResponse.status, orderJson);
      return res.status(502).json({
        message: "Razorpay order creation failed",
        status: orderResponse.status,
        details: orderJson,
      });
    }

    const booking = await BookingModel.create({
      user: req.user._id,
      event: event._id,
      amount: Number(event.price),
      currency: orderJson.currency || "INR",
      razorpayOrderId: orderJson.id,
      status: "created",
    });

    res.status(201).json({
      bookingId: booking._id,
      order: orderJson,
      keyId: (process.env.RAZORPAY_KEY_ID || "").trim(),
      event: {
        id: event._id,
        title: event.title,
      },
      amount: booking.amount,
      currency: booking.currency,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    if (booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Order id mismatch" });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return res.status(500).json({ message: "Razorpay secret missing in environment" });

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      console.error("Razorpay signature mismatch:", {
        bookingId,
        razorpay_order_id,
        razorpay_payment_id,
      });
      await BookingModel.findByIdAndUpdate(bookingId, { status: "failed" });
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    booking.status = "paid";
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    await booking.save();

    const event = await EventModel.findById(booking.event);
    if (event && !event.attendees.some((id) => id.toString() === req.user._id.toString())) {
      event.attendees.push(req.user._id);
      await event.save();
    }

    res.status(200).json({ success: true, message: "Payment verified. Booking confirmed." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const cancelAndRefund = async (req, res) => {
  try {
    if (typeof fetch !== "function") {
      return res.status(500).json({ message: "Node fetch() not available in this runtime" });
    }

    const booking = await BookingModel.findById(req.params.id).populate("event");
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const isOwner = booking.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ message: "Not allowed" });

    if (booking.status === "refunded") {
      return res.status(409).json({
        message: "Booking already refunded",
        currentStatus: booking.status,
      });
    }

    if (booking.status === "created") {
      booking.status = "cancelled";
      await booking.save();
      await writeActivityLog({
        userId: req.user._id,
        eventId: booking.event?._id || booking.event,
        bookingId: booking._id,
        type: "booking_cancelled",
        message: `${req.user.name} cancelled the event booking.`,
        meta: {
          bookingStatus: "cancelled",
          refundGranted: false,
        },
      });
      return res.status(200).json({ success: true, message: "Booking cancelled" });
    }

    if (booking.status !== "paid") {
      return res.status(400).json({
        message: "Only created/paid bookings can be cancelled",
        currentStatus: booking.status,
      });
    }
    if (!booking.razorpayPaymentId) {
      return res.status(400).json({ message: "Missing razorpayPaymentId for refund" });
    }

    const authHeader = getRazorpayAuthHeader();
    if (!authHeader) {
      return res.status(500).json({
        message: "Razorpay keys missing in environment (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET)",
      });
    }

    const amountPaise = Math.round(Number(booking.amount) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ message: "Invalid booking amount" });
    }

    const paymentLookup = await fetchRazorpayPayment(booking.razorpayPaymentId, authHeader);
    if (!paymentLookup.ok) {
      booking.status = "refund_failed";
      await booking.save();
      return res.status(502).json({
        message: "Unable to verify payment before refund",
        status: paymentLookup.status,
        details: paymentLookup.data,
      });
    }

    const paymentStatus = paymentLookup.data?.status;
    const amountRefunded = Number(paymentLookup.data?.amount_refunded || 0);
    const paymentAmount = Number(paymentLookup.data?.amount || 0);

    if (amountRefunded >= paymentAmount && paymentAmount > 0) {
      booking.status = "refunded";
      booking.refundStatus = "processed";
      booking.refundedAt = booking.refundedAt || new Date();
      await booking.save();
      return res.status(409).json({
        message: "Payment was already refunded in Razorpay",
        currentStatus: booking.status,
      });
    }

    if (paymentStatus !== "captured" && paymentStatus !== "authorized") {
      booking.status = "refund_failed";
      await booking.save();
      return res.status(400).json({
        message: `Refund unavailable because Razorpay payment status is ${paymentStatus || "unknown"}`,
        currentStatus: booking.status,
        paymentStatus,
      });
    }

    const refundResp = await fetch(
      `https://api.razorpay.com/v1/payments/${booking.razorpayPaymentId}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          notes: {
            bookingId: String(booking._id),
            eventId: String(booking.event?._id || ""),
            userId: String(booking.user),
          },
        }),
      },
    );

    const refundJson = await refundResp.json();
    if (!refundResp.ok) {
      console.error("Razorpay refund failed:", refundResp.status, refundJson);
      booking.status = "refund_failed";
      await booking.save();
      const razorpayReason =
        refundJson?.error?.description ||
        refundJson?.error?.reason ||
        refundJson?.description ||
        refundJson?.message ||
        null;
      return res.status(502).json({
        message: razorpayReason ? `Razorpay refund failed: ${razorpayReason}` : "Razorpay refund failed",
        status: refundResp.status,
        details: refundJson,
      });
    }

    booking.status = "refunded";
    booking.refundId = refundJson.id || null;
    booking.refundStatus = refundJson.status || null;
    booking.refundedAt = new Date();
    await booking.save();

    if (booking.event) {
      const event = await EventModel.findById(booking.event._id);
      if (event) {
        event.attendees = (event.attendees || []).filter(
          (id) => id.toString() !== booking.user.toString(),
        );
        await event.save();
      }
    }

    await writeActivityLog({
      userId: req.user._id,
      eventId: booking.event?._id || booking.event,
      bookingId: booking._id,
      type: "refund_granted",
      message: `${req.user.name} cancelled the event and refund granted.`,
      meta: {
        bookingStatus: booking.status,
        refundId: booking.refundId,
        refundStatus: booking.refundStatus,
        refundGranted: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Booking cancelled and refund granted",
      refund: refundJson,
      refundGranted: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const myBookings = async (req, res) => {
  const bookings = await BookingModel.find({ user: req.user._id })
    .populate("event")
    .sort({ createdAt: -1 });

  res.status(200).json({ bookings });
};

const myCalendar = async (req, res) => {
  const bookings = await BookingModel.find({ user: req.user._id, status: "paid" })
    .populate("event", "title date category location image price")
    .sort({ createdAt: -1 });

  const events = bookings
    .filter((b) => b.event)
    .map((b) => ({
      bookingId: b._id,
      eventId: b.event._id,
      title: b.event.title,
      date: b.event.date,
      category: b.event.category,
      location: b.event.location,
      image: b.event.image || null,
      price: b.event.price,
    }));

  res.status(200).json({ events });
};

module.exports = {
  createOrder,
  verifyPayment,
  cancelAndRefund,
  myBookings,
  myCalendar,
};
