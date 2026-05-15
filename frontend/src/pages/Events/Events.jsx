import React, { useEffect, useState } from "react";
import "./eve.css";
import { useNavigate } from "react-router-dom";
import EventDetailsModal from "./EventDetailsModal.jsx";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import heroImg from "../../assets/hero.png";
import { toast } from "react-toastify";

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [categories, setCategories] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
      if (events.length === 0) setLoading(true);

      try {
        const params = new URLSearchParams();
        if (search) params.append("title", search);
        if (category && category !== "All") params.append("category", category);

        const res = await api.get(`/events/all?${params.toString()}`);
        setEvents(res.data);
      } catch (err) {
        setError("Failed to load events");
        console.error("Error fetching events:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchEvents();
    }, 600); 

    return () => clearTimeout(timer);
  }, [search, category]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get("/events/categories");
        const serverCats = res.data?.categories || [];
        const base = ["Professional & Educational", "Entertainment", "Arts", "Tech", "Festival", "Sports", "Other"];
        const combined = Array.from(new Set([...base, ...serverCats]));
        combined.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        setCategories(combined);
      } catch {
        const base = ["Professional & Educational", "Entertainment", "Arts", "Tech", "Festival", "Sports", "Other"];
        setCategories(base);
      }
    };
    fetchCategories();
  }, []);

  const filtered = events;

  const openDetails = async (event) => {
    try {
      const res = await api.get(`/events/${event._id}`);
      setSelectedEvent(res.data);
    } catch {
      setSelectedEvent(event);
    } finally {
      setModalOpen(true);
    }
  };

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const bookNow = async () => {
    if (!user) return navigate("/login");
    if (!selectedEvent?._id) return;

    setBookingBusy(true);
    try {
      const orderRes = await api.post("/bookings/create-order", { eventId: selectedEvent._id });
      const ok = await loadRazorpayScript();
      if (!ok) {
        toast.error("Razorpay script failed to load.");
        return;
      }

      const { bookingId, order, keyId } = orderRes.data;
      if (!keyId) {
        toast.error("Razorpay key id missing from backend.");
        return;
      }

      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "EventHub",
        description: selectedEvent.title,
        order_id: order.id,
        handler: async (response) => {
          try {
            await api.post("/bookings/verify", { bookingId, ...response });
            toast.success("Booking confirmed!");
            setModalOpen(false);
            navigate("/my-bookings", { state: { openTicketId: bookingId } });
          } catch (err) {
            toast.error(err.response?.data?.message || "Payment verification failed");
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: { color: "#f97316" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      const data = err.response?.data;
      const details =
        data?.details ? (typeof data.details === "string" ? data.details : JSON.stringify(data.details)) : null;
      const status = data?.status ? `Status: ${data.status}` : null;
      const msg = [data?.message, status].filter(Boolean).join(" · ") || "Booking failed";
      toast.error(msg);
      if (details) console.error("Booking error details:", details);
    } finally {
      setBookingBusy(false);
    }
  };

  if (loading) return <div className="text-center mt-5 text-white">Loading events...</div>;
  if (error) return <div className="text-center mt-5 text-danger">{error}</div>;

  return (
    <div className="featured-section container">
      <div className="eh-controls">
        <div className="eh-search-container">
          <input
            className="eh-search"
            placeholder="Search events by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="eh-category-tabs">
          <button
            className={`category-tab ${category === "All" ? "active" : ""}`}
            onClick={() => setCategory("All")}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`category-tab ${category === c ? "active" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="events-container">
        {filtered.length > 0 ? (
          Array.from({ length: Math.ceil(filtered.length / 3) }, (_, i) =>
            filtered.slice(i * 3, i * 3 + 3)
          ).map((chunk, chunkIdx) => (
            <div className="events-grid" key={chunkIdx}>
              {chunk.map((event) => (
                <div className="event-item-card" key={event._id}>
                  <div className="event-banner">
                    <img src={event.image || heroImg} alt={event.title} />
                  </div>

                  <div className="card-top">
                    <h3>{event.title}</h3>
                    <span className="category-pill">{event.category}</span>
                  </div>

                  <div className="card-mid">
                    <p>
                      <i className="bi bi-calendar3"></i> {new Date(event.date).toDateString()}
                    </p>
                    <p>
                      <i className="bi bi-geo-alt"></i> {event.location}
                    </p>
                    <p>
                      <i className="bi bi-people"></i> {event.attendees?.length || 0} attending
                    </p>
                  </div>

                  <div className="divider-line">
                    <div className="card-bottom-line">
                      <span className="price-tag">₹{event.price}.00</span>
                      <button className="btn-view-details" onClick={() => openDetails(event)}>
                        View Details →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="no-events-found">
            <p className="text-secondary">No events available at the moment.</p>
          </div>
        )}
      </div>

      <EventDetailsModal
        open={modalOpen}
        event={selectedEvent}
        onClose={() => setModalOpen(false)}
        onBookNow={bookNow}
        bookingBusy={bookingBusy}
      />
    </div>
  );
};

export default Events;
