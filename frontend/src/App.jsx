import { Route, Routes, useLocation } from "react-router-dom";
import "./App.css";

import Signup from "./pages/authentication/Signup";
import VerifyOTP from "./pages/authentication/VerifyOTP";
import Login from "./pages/authentication/Login";
import ForgotPass from "./pages/authentication/ForgotPass";
import VerifyResetOTP from "./pages/authentication/VerifyResetOTP";
import Reset from "./pages/authentication/Reset";
import Home from "./pages/Home/Home";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./admin/Dashboard";
import CreateEve from "./admin/CreateEve";
import Events from "./pages/Events/Events";
import EditEve from "./admin/EditEve";
import CalendarPage from "./pages/Calendar/Calendar";
import Profile from "./pages/Profile/Profile";
import MyBookings from "./pages/Bookings/MyBookings";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Footer from "./components/Footer";

function App() {
  const location = useLocation();
  const background = location.state && location.state.backgroundLocation;

  const hideFooter =
    location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/create-event") ||
    location.pathname.startsWith("/edit");

  return (
    <>
      <Navbar />
      <ToastContainer position="top-right" autoClose={2200} newestOnTop closeOnClick pauseOnHover />

      <Routes location={background || location}>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPass />} />
        <Route path="/verify-reset-otp" element={<VerifyResetOTP />} />
        <Route path="/reset-password" element={<Reset />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute adminOnly={true}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-event"
          element={
            <ProtectedRoute adminOnly={true}>
              <CreateEve />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit/:id"
          element={
            <ProtectedRoute adminOnly={true}>
              <EditEve />
            </ProtectedRoute>
          }
        />
        <Route path="/events" element={<Events />} />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute>
              <MyBookings />
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* Modal Routes */}
      {background && (
        <Routes>
          <Route path="/login" element={<Login isModal={true} />} />
          <Route path="/signup" element={<Signup isModal={true} />} />
        </Routes>
      )}

      {!hideFooter ? <Footer /> : null}
    </>
  );
}

export default App;
