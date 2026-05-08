import React, { useCallback, useEffect, useState } from "react";
import "./home.css";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import musicImg from "../../assets/music.jpg";
import foodImg from "../../assets/food.jpg";
import djImg from "../../assets/dj night.jpg";
import aboutHeroImg from "../../assets/about_hero_v2.png";

const Home = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviews, setReviews] = useState([]);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const location = useLocation();

  const reloadReviews = useCallback(async () => {
    try {
      const res = await api.get("/reviews/latest?limit=8");
      const next = res.data?.reviews || [];
      setReviews(next);
      setReviewIndex((i) => (next.length ? Math.min(i, next.length - 1) : 0));
    } catch {
      setReviews([]);
      setReviewIndex(0);
    }
  }, []);

  useEffect(() => {
    reloadReviews();

    const onVis = () => {
      if (document.visibilityState === "visible") reloadReviews();
    };
    document.addEventListener("visibilitychange", onVis);

    const id = setInterval(() => reloadReviews(), 15000);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reloadReviews]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.get("/events/featured?limit=3");
        setEvents(res.data);
      } catch (err) {
        console.error("Error fetching events:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  useEffect(() => {
    if (!reviews.length) return;
    const id = setInterval(() => {
      setReviewIndex((v) => (v + 1) % reviews.length);
    }, 4500);
    return () => clearInterval(id);
  }, [reviews.length]);

  const currentReview = reviews[reviewIndex] || reviews[0];

  useEffect(() => {
    if (location.hash !== "#about") return;
    // Let the route render before scrolling
    const id = setTimeout(() => {
      const el = document.getElementById("about");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => clearTimeout(id);
  }, [location.hash]);

  return (
    <div className="home-page">
      <section className="hero-banner">
        <div className="hero-container">
          <div className="hero-text">
            <span className="mini-badge">EventHub - Book faster. Host smarter.</span>
            <h1>
              Plan, Promote &amp; <span className="highlight">Book</span> Events <br />
              With a Professional Experience
            </h1>
            <p>
              Discover curated events and book your next adventure with total ease and security.
            </p>

            <div className="hero-cta">
              <button className="eh-btn eh-btn-primary" onClick={() => navigate("/events")}>
                Explore Events
              </button>
              {isAdmin ? (
                <button className="eh-btn eh-btn-ghost" onClick={() => navigate("/dashboard")}>
                  Open Dashboard
                </button>
              ) : user ? (
                <button className="eh-btn eh-btn-ghost" onClick={() => navigate("/my-bookings")}>
                  My Bookings
                </button>
              ) : (
                <button className="eh-btn eh-btn-ghost" onClick={() => navigate("/signup")}>
                  Create Account
                </button>
              )}
            </div>
          </div>

          <div className="hero-showcase" aria-hidden="true">
            <div className="showcase-card">
              <div className="showcase-top">
                <div className="dot pink" />
                <div className="dot orange" />
                <div className="dot gray" />
              </div>
              <div className="showcase-grid">
                <div className="showcase-img">
                  <img src={musicImg} alt="" />
                </div>
                <div className="showcase-img">
                  <img src={foodImg} alt="" />
                </div>
                <div className="showcase-img wide">
                  <img src={djImg} alt="" />
                </div>
              </div>
              <div className="showcase-badges">
                <span>Calendar</span>
                <span>Refunds</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-highlights">
        <div className="home-wrap">
          <div className="hi-card">
            <h3>Find your vibe</h3>
            <p>Discover events tailored to your vibe. From music to tech, find what excites you.</p>
          </div>
          <div className="hi-card">
            <h3>Entertainment</h3>
            <p>Experience fun and unforgettable moments. Discover events that keep you entertained.</p>
          </div>
          <div className="hi-card">
            <h3>Reviews</h3>
            <p>Read reviews from other users. Make better choices before booking.</p>
          </div>
        </div>
      </section>

      <div className="featured-section container">
        <div className="section-header">
          <div className="header-text">
            <h2>Featured Events</h2>
            <p>Discover our handpicked selection of upcoming events</p>
          </div>
          <button className="view-all-purple" onClick={() => navigate("/events")}>
            View All Events {"\u2192"}
          </button>
        </div>

        <div className="events-grid">
          {loading ? (
            <p className="text-center text-secondary">Loading...</p>
          ) : events.length > 0 ? (
            events.map((event) => (
              <div className="event-item-card" key={event._id}>
                <div className="event-banner">
                  <img src={event.image || musicImg} alt={event.title} />
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
                    <span className="price-tag">
                      {"\u20B9"}
                      {event.price}.00
                    </span>
                    <button className="btn-view-details" onClick={() => navigate("/events")}>
                      View Details {"\u2192"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-secondary">No events found.</p>
          )}
        </div>
      </div>

      <section className="reviews-section" aria-label="Happy users reviews">
        <div className="reviews-wrap">
          <div className="reviews-head">
            <div>
              <h2>Happy users</h2>
              <p>Real feedback from users.</p>
            </div>
            {reviews.length ? (
              <div className="reviews-ctrl">
                <button
                  type="button"
                  className="rv-btn"
                  aria-label="Previous review"
                  onClick={() => setReviewIndex((v) => (v - 1 + reviews.length) % reviews.length)}
                >
                  {"\u2039"}
                </button>
                <button
                  type="button"
                  className="rv-btn"
                  aria-label="Next review"
                  onClick={() => setReviewIndex((v) => (v + 1) % reviews.length)}
                >
                  {"\u203A"}
                </button>
              </div>
            ) : null}
          </div>

          {reviews.length ? (
            <div className="review-card" key={`${reviewIndex}-${currentReview?._id || "review"}`}>
              <div className="review-top">
                <div className="review-avatar" aria-hidden="true">
                  {(currentReview?.user?.name || "U")[0].toUpperCase()}
                </div>
                <div className="review-meta">
                  <div className="review-name">{currentReview?.user?.name || "User"}</div>
                  <div className="review-role">
                    {currentReview?.event?.title ? `for ${currentReview.event.title}` : "Verified booking"}
                  </div>
                </div>
                <div className="review-stars" aria-label={`${currentReview?.rating || 0} out of 5`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={i < (currentReview?.rating || 0) ? "star filled" : "star"}>
                      {"\u2605"}
                    </span>
                  ))}
                </div>
              </div>

              <p className="review-text">
                {"\u201C"}
                {currentReview?.text || ""}
                {"\u201D"}
              </p>

              <div className="review-dots" aria-hidden="true">
                {reviews.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={i === reviewIndex ? "dot active" : "dot"}
                    onClick={() => setReviewIndex(i)}
                    tabIndex={-1}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="review-card review-empty">
              <p className="review-text">
                No reviews yet. After you book an event, you can add a review from{" "}
                <button type="button" className="rv-link" onClick={() => navigate("/my-bookings")}>
                  My Bookings
                </button>
                .
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="home-about" id="about" aria-label="About EventHub">
        <div className="home-about-wrap">
          <div className="home-about-hero">
            <div className="home-about-text">
              <h2>
                About <span>EventHub</span>
              </h2>
              <p>
                EventHub is an all-in-one platform that makes finding and managing events easy. Whether you are looking for something fun to attend or planning your own sold-out show, we’ve got you covered.
              </p>
            </div>
            <div className="home-about-img" aria-hidden="true">
              <img src={aboutHeroImg} alt="" />
            </div>
          </div>

          <div className="home-about-grid">
            <div className="home-about-item">
              <h4>Find your vibe</h4>
              <p>Discover events tailored to your unique interests and style, from intimate workshops to grand celebrations.</p>
            </div>
            <div className="home-about-item">
              <h4>Entertainment</h4>
              <p>Experience unforgettable moments with our curated selection of high-energy performances and social gatherings.</p>
            </div>
            <div className="home-about-item">
              <h4>Discovery</h4>
              <p>Uncover hidden gems and popular local activities using our intelligent search and category filtering system.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
