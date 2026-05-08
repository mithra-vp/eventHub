import React from "react";
import "./EventDetailsModal.css";

const EventDetailsModal = ({ open, event, onClose, onBookNow, bookingBusy }) => {
  if (!open || !event) return null;

  const eventDate = event.date ? new Date(event.date).toDateString() : "Date to be announced";
  const eventTime = event.date ? new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
  const attendeeCount = event.attendees?.length || 0;
  const priceLabel = `Rs. ${event.price}`;

  return (
    <div className="event-detail-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="event-detail-modal" onClick={(evt) => evt.stopPropagation()}>
        <div className="event-detail-layout">
          {event.image ? (
            <div className="event-detail-visual">
              <img src={event.image} alt={event.title} className="event-detail-image" />
              <div className="event-detail-visual-overlay" />
              <div className="event-detail-visual-copy">
                <span className="event-detail-kicker">Live experience</span>
                <h3>{event.title}</h3>
                <p>{event.category}</p>
              </div>
            </div>
          ) : null}

          <div className="event-detail-content">
            <div className="event-detail-header">
              <div>
                <span className="event-detail-kicker">Event details</span>
                <h3 className="event-detail-title">{event.title}</h3>
              </div>
              <div className="event-detail-header-side">
                <span className="category-pill">{event.category}</span>
                <button type="button" className="event-detail-close" onClick={onClose} aria-label="Close details">
                  x
                </button>
              </div>
            </div>

            <p className="event-detail-description">{event.description}</p>

            <div className="event-detail-stats">
              <div className="event-detail-stat">
                <span className="event-detail-stat-label">Date & Time</span>
                <strong>{eventDate}</strong>
                <span className="event-detail-stat-label" style={{marginTop: '4px', opacity: 0.8}}>{eventTime}</span>
              </div>
              <div className="event-detail-stat">
                <span className="event-detail-stat-label">Attendees</span>
                <strong>{attendeeCount} going</strong>
              </div>
              <div className="event-detail-stat">
                <span className="event-detail-stat-label">Ticket</span>
                <strong>{priceLabel}</strong>
              </div>
            </div>

            <div className="event-detail-location">
              <span className="event-detail-location-label">Venue</span>
              <p>{event.location}</p>
            </div>

            <div className="event-detail-actions">
              <button
                type="button"
                className="event-detail-book"
                onClick={onBookNow}
                disabled={bookingBusy}
              >
                {bookingBusy ? "Processing..." : `Book ticket - ${priceLabel}`}
              </button>
              <p className="event-detail-note">Secure checkout powered by Razorpay.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailsModal;
