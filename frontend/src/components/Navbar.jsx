import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import "./navbar.css";
import { useAuth } from "../context/AuthContext.jsx";
import { FiMenu, FiMoon, FiSun, FiX } from "react-icons/fi";
import { AiOutlineLogout } from "react-icons/ai";




import { useSelector, useDispatch } from "react-redux";
import { toggleTheme } from "../redux/themeSlice";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const theme = useSelector((state) => state.theme.mode);
  const dispatch = useDispatch();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isAdminDashboard = location.pathname === "/dashboard" && user?.role === "admin";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    // Sync initial theme from Redux state to DOM (case: Redux initialized from cookie)
    if (theme === "dark") document.documentElement.dataset.theme = "dark";
    else document.documentElement.removeAttribute("data-theme");
  }, [theme]);

  const handleToggleTheme = () => {
    dispatch(toggleTheme());
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const linkClass = ({ isActive }) => (isActive ? "eh-link active" : "eh-link");
  const aboutClass =
    location.pathname === "/" && location.hash === "#about" ? "eh-link active" : "eh-link";

  const navLinks = (
    <>
      <NavLink to="/" className={linkClass} end>
        Home
      </NavLink>
      <NavLink to="/events" className={linkClass}>
        Events
      </NavLink>
      <NavLink to="/calendar" className={linkClass}>
        Calendar
      </NavLink>
      <Link to="/#about" className={aboutClass}>
        About
      </Link>
      {user && (
        <NavLink to="/my-bookings" className={linkClass}>
          Bookings
        </NavLink>
      )}
      {user?.role === "admin" && (
        <NavLink to="/dashboard" className={linkClass}>
          Dashboard
        </NavLink>
      )}
    </>
  );

  return (
    <nav className={`eh-nav ${isScrolled ? "nav-scrolled" : ""} ${isAdminDashboard ? "eh-nav--dashboard" : ""}`}>
      <Link to="/" className="eh-logo">
        <div className="eh-logo-icon">E</div>
        <div className="eh-logo-text">
          Event<span>Hub</span>
        </div>
      </Link>

      <div className="eh-links">{navLinks}</div>

      <div className="eh-nav-right">
        <button
          type="button"
          className="eh-logout-btn eh-desktop-only"
          onClick={handleToggleTheme}
          aria-label="Toggle Theme"
          style={{ padding: "8px", display: "grid", placeItems: "center" }}
        >
          {theme === "dark" ? <FiSun size={18} /> : <FiMoon size={18} />}
        </button>

        {user ? (
          <>
            <Link to="/profile" className="eh-user-pill">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} />
              ) : (
                <div className="eh-user-init">{(user.name || "U")[0].toUpperCase()}</div>
              )}
              <span className="eh-user-name">{user.name}</span>
            </Link>
            <button onClick={handleLogout} className="eh-logout-btn eh-desktop-only" title="Logout">
              <AiOutlineLogout size={20} />
            </button>
          </>
        ) : (
          <div className="eh-auth-btns">
            <Link to="/login" state={{ backgroundLocation: location }} className="eh-btn-nav eh-btn-login">
              Login
            </Link>
            <Link to="/signup" state={{ backgroundLocation: location }} className="eh-btn-nav eh-btn-signup">
              Sign Up
            </Link>
          </div>
        )}

        <button
          className="eh-mobile-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
      </div>

      {menuOpen && (
        <div
          style={{
            position: "fixed",
            top: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(1300px, 92%)",
            background: "var(--eh-surface)",
            borderRadius: "24px",
            padding: "20px",
            boxShadow: "var(--eh-shadow-lg)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            border: "1px solid var(--eh-border)",
            backdropFilter: "blur(20px)",
          }}
          onClick={() => setMenuOpen(false)}
        >
          {navLinks}
          <hr style={{ border: "0", borderTop: "1px solid var(--eh-border)", margin: "5px 0" }} />
          {!user ? (
            <>
              <Link to="/login" state={{ backgroundLocation: location }} className="eh-link">Login</Link>
              <Link to="/signup" state={{ backgroundLocation: location }} className="eh-link">Sign Up</Link>
            </>
          ) : (
            <Link to="/profile" className="eh-link">My Profile</Link>
          )}
          <hr style={{ border: "0", borderTop: "1px solid var(--eh-border)", margin: "5px 0" }} />
          <button onClick={handleToggleTheme} className="eh-link" style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
            <span className="eh-link-ic">{theme === "dark" ? <FiSun /> : <FiMoon />}</span>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          {user && (
            <button onClick={handleLogout} className="eh-link" style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', color: 'var(--eh-danger)' }}>
              <span className="eh-link-ic"><AiOutlineLogout /></span>
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
