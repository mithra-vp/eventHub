import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "./mybookings.css";
import { api } from "../../api/client.js";
import { toast } from "react-toastify";
import TicketModal from "./TicketModal.jsx";
import { HiTicket } from "react-icons/hi";
import { useAuth } from "../../context/AuthContext.jsx";

const MyBookings = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const [myReviewByEventId, setMyReviewByEventId] = useState({});
  const [reviewOpenFor, setReviewOpenFor] = useState(null); // bookingId
  const [reviewDraft, setReviewDraft] = useState({ rating: 5, text: "" });
  const [submittingReviewFor, setSubmittingReviewFor] = useState(null);
  const [ticketBooking, setTicketBooking] = useState(null);
  const { user } = useAuth();
  const location = useLocation();

  const loadMyReviews = useCallback(async () => {
    try {
      const res = await api.get("/reviews/mine");
      const list = res.data?.reviews || [];
      const map = {};
      for (const r of list) {
        const eventId = typeof r?.event === "string" ? r.event : r?.event?._id;
        if (eventId) map[String(eventId)] = r;
      }
      setMyReviewByEventId(map);
    } catch {
      setMyReviewByEventId({});
    }
  }, []);

  const load = useCallback(async (opts = { initial: false }) => {
    try {
      if (opts.initial) setLoading(true);
      else setRefreshing(true);

      const [bookingsRes] = await Promise.all([api.get("/bookings/my"), loadMyReviews()]);
      setBookings(bookingsRes.data?.bookings || []);
    } catch {
      setBookings([]);
      setMyReviewByEventId({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadMyReviews]);

  useEffect(() => {
    load({ initial: true });
  }, [load]);

  useEffect(() => {
    if (!loading && location.state?.openTicketId && bookings.length > 0) {
      const b = bookings.find(x => x._id === location.state.openTicketId);
      if (b && b.status?.toLowerCase() === "paid") {
        setTicketBooking(b);
        window.history.replaceState({}, document.title);
      }
    }
  }, [loading, location.state, bookings]);

  const confirmWithToast = useCallback((message) => {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (v) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };

      toast(
        ({ closeToast }) => (
          <div className="mb-confirm">
            <div className="mb-confirm-text">{message}</div>
            <div className="mb-confirm-actions">
              <button
                type="button"
                className="mb-confirm-cancel"
                onClick={() => {
                  settle(false);
                  closeToast?.();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mb-confirm-ok"
                onClick={() => {
                  settle(true);
                  closeToast?.();
                }}
              >
                OK
              </button>
            </div>
          </div>
        ),
        {
          toastId: `confirm:${String(message).slice(0, 80)}`,
          autoClose: false,
          closeOnClick: false,
          draggable: false,
          closeButton: false,
          onClose: () => settle(false),
        },
      );
    });
  }, []);

  const canCancel = (b) => ["paid", "created", "refund_failed"].includes(b.status?.toLowerCase());

  const cancelLabel = (b) =>
    ["paid", "refund_failed"].includes(b.status?.toLowerCase()) ? "Cancel & Refund" : "Cancel Booking";

  const cancelHint = (b) =>
    ["paid", "refund_failed"].includes(b.status?.toLowerCase())
      ? "Refund is processed by Razorpay and may take some time."
      : "Cancels a pending booking (no payment).";

  const cancelConfirmText = (b) =>
    ["paid", "refund_failed"].includes(b.status?.toLowerCase())
      ? "Cancel this booking and request a full refund?"
      : "Cancel this booking?";

  const cancelSuccessText = (b) =>
    ["paid", "refund_failed"].includes(b.status?.toLowerCase())
      ? "Booking cancelled."
      : "Cancelled.";

  const cancelDisabledReason = (b) => {
    if (!["paid", "created", "refund_failed"].includes(b.status?.toLowerCase())) {
      return "Only created/paid/refund-failed bookings can be cancelled";
    }
    return null;
  };

  const cancelBooking = async (bookingId) => {
    const booking = bookings.find((x) => x._id === bookingId);
    if (!booking) return;

    if (!canCancel(booking)) {
      toast.error(cancelDisabledReason(booking) || "Cannot cancel this booking");
      return;
    }

    const ok = await confirmWithToast(cancelConfirmText(booking));
    if (!ok) return;
    try {
      setCancellingId(bookingId);
      const res = await api.post(`/bookings/${bookingId}/cancel`);
      await load();
      toast.success(cancelSuccessText(booking));
      if (res.data?.refundGranted) {
        toast.success("Refund granted successfully.");
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.currentStatus) {
        await load();
      }
      if (data?.currentStatus === "refunded") {
        toast.info("This booking was already refunded. The list has been refreshed.");
        return;
      }
      if (data?.currentStatus === "cancelled") {
        toast.info("This booking was already cancelled. The list has been refreshed.");
        return;
      }
      if (data?.paymentStatus) {
        toast.error(`Refund failed: payment status is ${data.paymentStatus}.`);
        return;
      }
      const status = data?.status ? `Status: ${data.status}` : null;
      const msg = [data?.message, status].filter(Boolean).join(" - ") || "Cancel failed";
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  };

  const canReview = (b) => {
    if (!b?.event?._id) return false;
    if (b.status?.toLowerCase() !== "paid") return false;
    return !myReviewByEventId[String(b.event._id)];
  };

  const openReview = (b) => {
    if (!canReview(b)) return;
    setReviewOpenFor(b._id);
    setReviewDraft({ rating: 5, text: "" });
  };

  const closeReview = () => {
    setReviewOpenFor(null);
    setReviewDraft({ rating: 5, text: "" });
  };

  const submitReview = async (b) => {
    if (!b?.event?._id) return;
    const rating = Number(reviewDraft.rating);
    const text = String(reviewDraft.text || "").trim();

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return toast.error("Please select a rating (1 to 5)");
    if (text.length < 5) return toast.error("Please write a short review (min 5 characters)");

    try {
      setSubmittingReviewFor(b._id);
      await api.post("/reviews", { eventId: b.event._id, rating, text });
      await loadMyReviews();
      toast.success("Review submitted");
      closeReview();
    } catch (err) {
      const data = err.response?.data;
      toast.error(data?.message || "Failed to submit review");
    } finally {
      setSubmittingReviewFor(null);
    }
  };

  const renderStars = (value) => {
    const n = Number(value);
    const filled = Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n))) : 0;
    const full = "\u2605\u2605\u2605\u2605\u2605";
    const empty = "\u2606\u2606\u2606\u2606\u2606";
    return full.slice(0, filled) + empty.slice(0, 5 - filled);
  };

  const existingReviewFor = (b) => (b?.event?._id ? myReviewByEventId[String(b.event._id)] : null);

  return (
    <div className="mb-page">
      <div className="mb-card">
        <div className="mb-head">
          <h2>
            My <span>Bookings</span>
          </h2>
        </div>

        {loading ? (
          <p className="mb-muted">Loading...</p>
        ) : bookings.length ? (
          <div className="mb-list">
            {bookings.map((b) => {
              const existingReview = existingReviewFor(b);
              return (
                <div key={b._id} className="mb-item">
                  <div className="mb-top">
                    {b.event?.image ? (
                      <div className="mb-thumb">
                        <img src={b.event.image} alt={b.event?.title || "event"} />
                      </div>
                    ) : null}
                    <div className="mb-info">
                      <div className="mb-title">{b.event?.title || "Event"}</div>
                      <div className="mb-meta">
                        {b.event?.date ? new Date(b.event.date).toDateString() : ""} - {b.event?.location || ""}
                      </div>
                      <div className="mb-meta">{b.event?.category || ""}</div>
                    </div>
                  </div>

                  <div className="mb-meta">
                    Order: <span className="mb-mono">{b.razorpayOrderId}</span>
                  </div>

                  {b.status?.toLowerCase() === "paid" ? (
                    <div className="mb-review">
                      {existingReview ? (
                        <div className="mb-reviewed">
                          <div className="mb-reviewed-head">
                            <span className="mb-reviewed-label">Your review</span>
                            <span className="mb-stars" aria-label="Your rating">
                              {renderStars(existingReview?.rating)}
                            </span>
                          </div>
                          <div className="mb-reviewed-text">{existingReview?.text || ""}</div>
                        </div>
                      ) : (
                        <div className="mb-review-cta">
                          <button type="button" className="mb-review-btn" onClick={() => openReview(b)}>
                            Add Review
                          </button>
                          <span className="mb-muted">Help others by rating your experience.</span>
                        </div>
                      )}

                      {reviewOpenFor === b._id ? (
                        <div className="mb-review-form" role="dialog" aria-label="Add review">
                          <div className="mb-review-form-row">
                            <span className="mb-review-form-label">Rating</span>
                            <div className="mb-star-pick" role="radiogroup" aria-label="Pick rating">
                              {[1, 2, 3, 4, 5].map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  className={`mb-star ${reviewDraft.rating >= v ? "on" : ""}`}
                                  onClick={() => setReviewDraft((d) => ({ ...d, rating: v }))}
                                  aria-label={`${v} star`}
                                >
                                  {"\u2605"}
                                </button>
                              ))}
                            </div>
                          </div>

                          <textarea
                            className="mb-review-textarea"
                            placeholder="Write your review..."
                            value={reviewDraft.text}
                            onChange={(e) => setReviewDraft((d) => ({ ...d, text: e.target.value }))}
                            maxLength={500}
                          />

                          <div className="mb-review-form-actions">
                            <button type="button" className="mb-review-cancel" onClick={closeReview}>
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="mb-review-submit"
                              onClick={() => submitReview(b)}
                              disabled={submittingReviewFor === b._id}
                            >
                              {submittingReviewFor === b._id ? "Submitting..." : "Submit Review"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mb-row">
                    <span className={`mb-status ${b.status}`}>{b.status}</span>
                    <div className="mb-actions">
                      <button
                        type="button"
                        className="mb-cancel"
                        onClick={() => cancelBooking(b._id)}
                        disabled={!canCancel(b) || cancellingId === b._id}
                        title={canCancel(b) ? cancelHint(b) : cancelDisabledReason(b) || "Not available"}
                      >
                        {cancellingId === b._id ? "Cancelling..." : cancelLabel(b)}
                      </button>
                      {b.status?.toLowerCase() === "paid" && (
                        <button
                          type="button"
                          className="eh-btn-nav"
                          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
                          onClick={() => setTicketBooking(b)}
                        >
                          <HiTicket size={16} /> Get Ticket
                        </button>
                      )}
                      <span className="mb-amt">
                        {"\u20B9"}
                        {b.amount}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mb-empty">
            <p className="mb-muted">No bookings yet.</p>
          </div>
        )}
      </div>

      <TicketModal 
        isOpen={!!ticketBooking} 
        onClose={() => setTicketBooking(null)} 
        booking={ticketBooking ? { ...ticketBooking, userName: user?.name } : null}
      />
    </div>
  );
};

export default MyBookings;
