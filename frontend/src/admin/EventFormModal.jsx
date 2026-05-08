import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { toast } from "react-toastify";
import "./eventFormModal.css";
import { FiX, FiUploadCloud, FiType, FiCalendar, FiMapPin, FiTag, FiDollarSign, FiAlignLeft, FiClock } from "react-icons/fi";

const BASE_CATEGORIES = [
  "Professional & Educational",
  "Entertainment",
  "Arts",
  "Tech",
  "Festival",
  "Sports",
  "Other",
];

const emptyForm = {
  title: "",
  description: "",
  date: "",
  time: "18:00",
  location: "",
  category: "Entertainment",
  price: "",
};

const toFormState = (event) => ({
  title: event?.title || "",
  description: event?.description || "",
  date: event?.date ? new Date(event.date).toISOString().slice(0, 10) : "",
  time: event?.date ? new Date(event.date).toTimeString().slice(0, 5) : "18:00",
  location: event?.location || "",
  category: event?.category || "Entertainment",
  price: event?.price ?? "",
});

const EventFormModal = ({ mode = "create", event = null, onClose, onSaved }) => {
  const [formData, setFormData] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    setFormData(mode === "edit" && event ? toFormState(event) : emptyForm);
    setImageFile(null);
    setPreview(mode === "edit" ? event?.image || null : null);
  }, [event, mode]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await api.get("/events/categories");
        setCategories(res.data?.categories || []);
      } catch {
        setCategories([]);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const onKeyDown = (evt) => {
      if (evt.key === "Escape" && !submitting) onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  const categorySuggestions = useMemo(() => {
    const all = [...BASE_CATEGORIES, ...(categories || [])].filter(Boolean);
    const uniq = Array.from(new Set(all.map((value) => String(value).trim()).filter((value) => value.length)));
    uniq.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return uniq;
  }, [categories]);

  const handleChange = (evt) => {
    const { name, value } = evt.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (evt) => {
    const file = evt.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
      return;
    }
    setPreview(mode === "edit" ? event?.image || null : null);
  };

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    if (submitting) return;
    if (mode === "create" && !imageFile) {
      toast.error("Please choose an event banner image");
      return;
    }

    const data = new FormData();
    data.append("title", formData.title);
    data.append("description", formData.description);
    
    // Combine date and time
    const combinedDate = `${formData.date}T${formData.time}:00`;
    data.append("date", combinedDate);
    data.append("time", formData.time);
    
    data.append("location", formData.location);
    data.append("category", formData.category);
    data.append("price", Number(formData.price));
    if (imageFile) data.append("image", imageFile);

    try {
      setSubmitting(true);
      const response =
        mode === "edit" && event?._id
          ? await api.put(`/events/update/${event._id}`, data)
          : await api.post("/events/create", data);

      toast.success(mode === "edit" ? "Event updated successfully" : "Event created successfully");
      onSaved(response.data);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="event-modal-overlay" onClick={submitting ? undefined : onClose}>
      <div
        className="event-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        onClick={(evt) => evt.stopPropagation()}
      >
        <div className="event-modal-header">
          <div className="header-info">
            <h2 id="event-modal-title">{mode === "edit" ? "Edit Event" : "Create New Event"}</h2>
            <p>{mode === "edit" ? "Modify the details for this event listing." : "Fill in the details to launch your event."}</p>
          </div>
          <button type="button" className="event-modal-close" onClick={onClose} disabled={submitting} aria-label="Close">
            <FiX size={20} />
          </button>
        </div>

        <form className="event-modal-form" onSubmit={handleSubmit}>
          <div className="form-scroll-area">
            <div className="event-field">
              <label htmlFor="event-title"><FiType /> Event Title</label>
              <input id="event-title" name="title" value={formData.title} onChange={handleChange} placeholder="e.g. Summer Music Fest 2026" required />
            </div>

            <div className="event-form-row">
              <div className="event-field">
                <label htmlFor="event-date"><FiCalendar /> Date</label>
                <input id="event-date" type="date" name="date" value={formData.date} onChange={handleChange} required />
              </div>
              <div className="event-field">
                <label htmlFor="event-time"><FiClock /> Time</label>
                <input id="event-time" type="time" name="time" value={formData.time} onChange={handleChange} required />
              </div>
            </div>

            <div className="event-field">
              <label htmlFor="event-category"><FiTag /> Category</label>
              <select id="event-category" name="category" value={formData.category} onChange={handleChange} required>
                <option value="" disabled>Select category</option>
                {categorySuggestions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="event-field">
              <label><FiUploadCloud /> Event Banner</label>
              <div className="image-upload-zone">
                <input id="event-image" type="file" accept="image/*" onChange={handleImageChange} required={mode === "create"} className="hidden-input" />
                <label htmlFor="event-image" className="upload-trigger">
                  {preview ? (
                    <img src={preview} alt="Preview" className="upload-preview" />
                  ) : (
                    <div className="upload-placeholder">
                      <FiUploadCloud size={32} />
                      <p>Click to upload banner image</p>
                      <span>Supports: JPG, PNG, WEBP</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="event-form-row">
              <div className="event-field">
                <label htmlFor="event-location"><FiMapPin /> Location</label>
                <input id="event-location" name="location" value={formData.location} onChange={handleChange} placeholder="Venue address" required />
              </div>
              <div className="event-field">
                <label htmlFor="event-price"><FiDollarSign /> Price (₹)</label>
                <input id="event-price" type="number" min="0" name="price" value={formData.price} onChange={handleChange} placeholder="Ticket cost" required />
              </div>
            </div>

            <div className="event-field">
              <label htmlFor="event-description"><FiAlignLeft /> Description</label>
              <textarea
                id="event-description"
                name="description"
                rows="4"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell attendees what to expect..."
                required
              />
            </div>
          </div>

          <div className="event-modal-actions">
            <button type="button" className="event-secondary-btn" onClick={onClose} disabled={submitting}>
              Discard
            </button>
            <button type="submit" className="event-primary-btn" disabled={submitting}>
              {submitting ? "Saving..." : mode === "edit" ? "Update Event" : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventFormModal;
