import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FaGithub, FaInstagram, FaLinkedinIn, FaTwitter } from "react-icons/fa";
import "./footer.css";

const Footer = () => {
  const location = useLocation();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" aria-label="Footer">
      <div className="site-footer__container">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <div className="site-footer__logo" aria-hidden="true">
              E
            </div>
            <div className="site-footer__brand-text">
              <div className="site-footer__title">EventHub</div>
              <p className="site-footer__tagline">Discover, save, and book events with confidence.</p>
            </div>
          </div>

          <nav className="site-footer__cols" aria-label="Footer links">
            <div className="site-footer__col">
              <div className="site-footer__heading">Explore</div>
              <Link className="site-footer__link" to="/events">
                Events
              </Link>
              <Link className="site-footer__link" to="/calendar">
                Calendar
              </Link>
              <Link className="site-footer__link" to="/about">
                About
              </Link>
            </div>

            <div className="site-footer__col">
              <div className="site-footer__heading">Account</div>
              <Link className="site-footer__link" to="/login" state={{ backgroundLocation: location }}>
                Login
              </Link>
              <Link className="site-footer__link" to="/signup" state={{ backgroundLocation: location }}>
                Sign Up
              </Link>
              <Link className="site-footer__link" to="/my-bookings">
                My Bookings
              </Link>
            </div>
          </nav>

          <div className="site-footer__social" aria-label="Social links">
            <div className="site-footer__heading">Follow</div>
            <div className="site-footer__icons">
              <a
                className="site-footer__icon"
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                title="GitHub"
              >
                <FaGithub />
              </a>
              <a
                className="site-footer__icon"
                href="https://www.linkedin.com"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                title="LinkedIn"
              >
                <FaLinkedinIn />
              </a>
              <a
                className="site-footer__icon"
                href="https://www.instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                title="Instagram"
              >
                <FaInstagram />
              </a>
              <a
                className="site-footer__icon"
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Twitter"
                title="Twitter"
              >
                <FaTwitter />
              </a>
            </div>
          </div>
        </div>

        <div className="site-footer__bottom">
          <div className="site-footer__copy">
            {"\u00A9"} {year} EventHub. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

