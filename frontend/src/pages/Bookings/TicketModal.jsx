import React, { useRef } from "react";
import html2canvas from "html2canvas";
import "./TicketModal.css";
import { FiDownload, FiX, FiMapPin, FiCalendar, FiClock, FiUser, FiHash } from "react-icons/fi";

const TicketModal = ({ isOpen, onClose, booking }) => {
  const ticketRef = useRef(null);
  if (!isOpen || !booking) return null;

  const event = booking.event || {};
  const eventDate = event.date ? new Date(event.date).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : "Date TBD";
  
  const eventTime = event.date ? new Date(event.date).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  }) : "Time TBD";

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    try {
      const canvas = await html2canvas(ticketRef.current, {
        backgroundColor: "#ffffff",
        scale: 2, // Higher quality
        useCORS: true,
        logging: false
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `ticket-${booking._id.slice(-6)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  return (
    <div className="ticket-overlay" onClick={onClose}>
      <div className="ticket-container" ref={ticketRef} onClick={(e) => e.stopPropagation()}>
        <div className="ticket-header">
          <div className="ticket-logo">
            Event<span>Hub</span>
          </div>
          <div className="ticket-status-pill">
            Verified Ticket
          </div>
        </div>

        <div className="ticket-body">
          <div className="ticket-event-title">{event.title || "Special Event"}</div>
          
          <div className="ticket-details-grid">
            <div className="ticket-detail-item">
              <span className="ticket-label"><FiCalendar size={12} style={{marginRight: '4px'}}/> Date</span>
              <span className="ticket-value">{eventDate}</span>
            </div>
            <div className="ticket-detail-item">
              <span className="ticket-label"><FiClock size={12} style={{marginRight: '4px'}}/> Time</span>
              <span className="ticket-value">{eventTime}</span>
            </div>
            <div className="ticket-detail-item">
              <span className="ticket-label"><FiMapPin size={12} style={{marginRight: '4px'}}/> Venue</span>
              <span className="ticket-value">{event.location || "Venue TBD"}</span>
            </div>
            <div className="ticket-detail-item">
              <span className="ticket-label"><FiUser size={12} style={{marginRight: '4px'}}/> Attendee</span>
              <span className="ticket-value">{booking.userName || "Guest"}</span>
            </div>
          </div>

          <div className="ticket-details-grid" style={{marginBottom: 0}}>
            <div className="ticket-detail-item">
              <span className="ticket-label"><FiHash size={12} style={{marginRight: '4px'}}/> Booking ID</span>
              <span className="ticket-value" style={{fontFamily: 'monospace'}}>{booking._id}</span>
            </div>
            <div className="ticket-detail-item">
              <span className="ticket-label">Price Paid</span>
              <span className="ticket-value">₹{booking.amount}</span>
            </div>
          </div>
        </div>

        <div className="ticket-divider"></div>

        <div className="ticket-footer">
          <div className="ticket-info-summary">
            <span className="barcode-text">Order Ref: {booking.razorpayOrderId}</span>
          </div>
          <button className="eh-btn-nav" style={{padding: '10px 20px'}} onClick={handleDownload}>
            <FiDownload style={{marginRight: '8px'}} /> Download Ticket
          </button>
        </div>

        <div style={{padding: '0 32px 32px'}}>
          <button className="ticket-close-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketModal;
