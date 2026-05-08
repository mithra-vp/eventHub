import React, { useEffect, useMemo, useState } from 'react';
import './dash.css';
import { api } from "../api/client.js";
import { toast } from 'react-toastify';
import EventFormModal from "./EventFormModal.jsx";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { 
  FiCalendar, FiPlus, FiUsers, FiCreditCard, 
  FiBarChart2, FiActivity, FiMenu, FiX, FiTrash2, FiEdit3, FiDownload 
} from "react-icons/fi";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const RevenueBars = ({ data }) => {
  const months = data?.months || Array.from({ length: 12 }, (_, i) => ({ month: i + 1, revenue: 0 }));
  const total = data?.total || 0;
  const year = data?.year || new Date().getFullYear();
  const currency = data?.currency || "INR";

  const money = useMemo(() => {
    const symbol = currency === "INR" ? "\u20B9" : currency;
    return {
      symbol,
      format: (value) => `${symbol}${Number(value || 0).toLocaleString()}`,
    };
  }, [currency]);

  const chartData = useMemo(() => ({
    labels: months.map((m) => new Date(0, m.month - 1).toLocaleString('default', { month: 'short' })),
    datasets: [
      {
        label: "Revenue",
        data: months.map((m) => Number(m.revenue || 0)),
        backgroundColor: [
          "rgba(236, 72, 153, 0.92)",
          "rgba(239, 68, 68, 0.88)",
          "rgba(244, 114, 182, 0.86)",
          "rgba(249, 115, 22, 0.86)",
          "rgba(236, 72, 153, 0.92)",
          "rgba(239, 68, 68, 0.88)",
          "rgba(244, 114, 182, 0.86)",
          "rgba(249, 115, 22, 0.86)",
          "rgba(236, 72, 153, 0.92)",
          "rgba(239, 68, 68, 0.88)",
          "rgba(244, 114, 182, 0.86)",
          "rgba(249, 115, 22, 0.86)",
        ],
        borderRadius: 12,
        borderSkipped: false,
        maxBarThickness: 34,
      },
    ],
  }), [months]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          label: (context) => money.format(context.parsed.y),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        border: { display: false },
        ticks: {
          color: "#64748b",
          font: { size: 11, weight: "700" },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(148, 163, 184, 0.14)",
          drawBorder: false,
        },
        border: { display: false },
        ticks: {
          color: "#64748b",
          font: { size: 11, weight: "700" },
          callback: (value) => `${money.symbol}${value}`,
        },
      },
    },
  }), [money]);

  return (
    <div className="rev-card">
      <div className="rev-head">
        <div className="rev-head-text">
          <h3>Monthly Revenue ({year})</h3>
          <p className="muted">Track your performance over the year</p>
        </div>
        <div className="rev-total-box">
          <span className="rev-total-label">Total Earnings</span>
          <span className="rev-total-val">{money.format(total)}</span>
        </div>
      </div>
      <div className="rev-chart-shell">
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [activity, setActivity] = useState({ bookings: [], eventStats: [], reviews: [], latestUsers: [], activityEntries: [] });
  const [showConfirm, setShowConfirm] = useState({ show: false, type: "", id: null, msg: "" });
  const [modalState, setModalState] = useState({ open: false, mode: "create", event: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activityRows = useMemo(() => {
    const eventMap = new Map((activity.eventStats || []).map((event) => [String(event._id), event]));
    const reviewMap = new Map(
      (activity.reviews || []).map((review) => [`${review.user?._id || review.user}-${review.event?._id || review.event}`, review]),
    );
    const logRows = (activity.activityEntries || []).map((entry) => {
      const eventId = String(entry.event?._id || entry.event || "");
      const eventStats = eventMap.get(eventId);
      const cancelStatus =
        entry.type === "refund_granted"
          ? "User Cancelled (Refunded)"
          : entry.type === "booking_cancelled"
            ? "User Cancelled the Event"
            : "Activity";

      return {
        key: `log-${entry._id}`,
        userName: entry.user?.name || "-",
        eventName: entry.event?.title || "-",
        attendees: entry.event?.attendees?.length || eventStats?.attendees?.length || 0,
        review: "-",
        rating: 0,
        cancelStatus,
        cancelMessage: entry.message || "-",
        createdAt: entry.createdAt || null,
      };
    });

    const bookingRows = (activity.bookings || []).map((booking) => {
      const eventId = String(booking.event?._id || "");
      const userId = String(booking.user?._id || "");
      const review = reviewMap.get(`${userId}-${eventId}`);
      const eventStats = eventMap.get(eventId);

      return {
        key: booking._id,
        userName: booking.user?.name || "-",
        eventName: booking.event?.title || "-",
        attendees: eventStats?.attendees?.length || 0,
        review: review?.text || "-",
        rating: review?.rating || 0,
        cancelStatus: "-",
        cancelMessage: "-",
        createdAt: booking.createdAt || null,
      };
    });

    const reviewOnlyRows = (activity.reviews || [])
      .filter((review) => {
        const eventId = String(review.event?._id || "");
        const userId = String(review.user?._id || "");
        return !(activity.bookings || []).some(
          (booking) => String(booking.event?._id || "") === eventId && String(booking.user?._id || "") === userId,
        );
      })
      .map((review) => {
        const eventId = String(review.event?._id || "");
        const eventStats = eventMap.get(eventId);

        return {
          key: review._id,
          userName: review.user?.name || "-",
          eventName: review.event?.title || "-",
          attendees: eventStats?.attendees?.length || 0,
          review: review.text || "-",
          rating: review.rating || 0,
          cancelStatus: "-",
          cancelMessage: "-",
          createdAt: review.createdAt || null,
        };
      });

    return [...logRows, ...bookingRows, ...reviewOnlyRows].sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [activity]);

  const exportToCSV = () => {
    if (!activityRows.length) return toast.info("No data to export");
    
    const headers = ["User", "Event", "Attendees", "Review", "Status", "Rating", "Date"];
    const rows = activityRows.map(row => [
      row.userName,
      row.eventName,
      row.attendees,
      row.review.replace(/,/g, " "),
      row.cancelStatus,
      row.rating || 0,
      row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `activity_report_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Report downloaded successfully");
  };

  const scrollToSection = (id) => {
    setSidebarOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    setLoading(true);
    const fetchAdminData = async () => {
      const failures = [];
      try {
        const results = await Promise.allSettled([
          api.get("/events/all"),
          api.get("/admin/users"),
          api.get("/admin/payments"),
          api.get("/admin/revenue/monthly"),
          api.get("/admin/reminders"),
          api.get("/admin/activity-log"),
        ]);

        const [eventsRes, usersRes, payRes, revRes, remRes, actRes] = results;

        if (eventsRes.status === "fulfilled") {
          const data = eventsRes.value.data;
          setEvents(Array.isArray(data) ? data : data?.events || []);
        } else failures.push("events");

        if (usersRes.status === "fulfilled") setUsers(usersRes.value.data?.users || []);
        else failures.push("users");

        if (payRes.status === "fulfilled") setPayments(payRes.value.data?.payments || []);
        else failures.push("payments");

        if (revRes.status === "fulfilled") setRevenue(revRes.value.data || null);
        else failures.push("revenue");

        if (remRes.status === "fulfilled") setReminders(remRes.value.data?.events || []);
        else failures.push("upcoming events");

        if (actRes.status === "fulfilled") {
          setActivity(actRes.value.data || { bookings: [], eventStats: [], reviews: [], latestUsers: [], activityEntries: [] });
        } else {
          failures.push("activity log");
          setActivity({ bookings: [], eventStats: [], reviews: [], latestUsers: [], activityEntries: [] });
        }
      } catch {
        failures.push("dashboard data");
      } finally {
        if (failures.length) {
          toast.error(`Some admin widgets failed to load: ${failures.join(", ")}`);
        }
        setLoading(false);
      }
    };
    fetchAdminData();
  }, [reloadKey]);

  const openConfirm = (type, id, msg) => {
    setShowConfirm({ show: true, type, id, msg });
  };

  const handleConfirmAction = async () => {
    const { type, id } = showConfirm;
    setShowConfirm({ ...showConfirm, show: false });

    try {
      if (type === "event") {
        await api.delete(`/events/delete/${id}`);
        setEvents((prev) => prev.filter((event) => event._id !== id));
        toast.success("Event deleted successfully");
      } else if (type === "user") {
        await api.delete(`/admin/users/${id}`);
        setUsers((prev) => prev.filter((u) => u._id !== id));
        toast.success("User deleted successfully");
      } else if (type === "payment") {
        await api.delete(`/admin/payments/${id}`);
        setPayments((prev) => prev.filter((p) => p._id !== id));
        toast.success("Payment record deleted successfully");
      }
    } catch {
      toast.error(`${type.charAt(0).toUpperCase() + type.slice(1)} action failed`);
    }
  };

  const handleDelete = (id) => openConfirm("event", id, "Are you sure you want to delete this event?");
  const handleDeleteUser = (id) => openConfirm("user", id, "Are you sure you want to delete this user?");
  const handleDeletePayment = (id) => openConfirm("payment", id, "Are you sure you want to delete this payment record?");
  const openCreateModal = () => setModalState({ open: true, mode: "create", event: null });
  const openEditModal = (event) => setModalState({ open: true, mode: "edit", event });
  const closeEventModal = () => setModalState({ open: false, mode: "create", event: null });
  const handleEventSaved = () => {
    closeEventModal();
    setReloadKey((prev) => prev + 1);
  };

  return (
    <div className={`dashboard-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Mobile Header */}
      <div className="admin-mobile-head">
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
        <div className="mobile-logo">Admin<span>Panel</span></div>
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">Admin<span>Panel</span></div>
        <nav className="sidebar-nav">
          <button className="active" type="button" onClick={() => scrollToSection("sec-events")}>
            <FiCalendar className="sb-ic" /> Manage Events
          </button>
          <button type="button" onClick={openCreateModal}>
            <FiPlus className="sb-ic" /> Create Event
          </button>
          <button type="button" onClick={() => scrollToSection("sec-revenue")}>
            <FiBarChart2 className="sb-ic" /> Revenue
          </button>
          <button type="button" onClick={() => scrollToSection("sec-users")}>
            <FiUsers className="sb-ic" /> Users
          </button>
          <button type="button" onClick={() => scrollToSection("sec-activity")}>
            <FiActivity className="sb-ic" /> Activity Log
          </button>
          <button type="button" onClick={() => scrollToSection("sec-payments")}>
            <FiCreditCard className="sb-ic" /> Payments
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>Admin <span>Dashboard</span></h1>
          <p>Welcome back! Here's what's happening with EventHub today.</p>
        </header>

        {/* Stats Cards */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon events"><FiCalendar /></div>
            <div className="stat-info">
              <p>Total Events</p>
              <h3>{events.length}</h3>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bookings"><FiCreditCard /></div>
            <div className="stat-info">
              <p>Active Bookings</p>
              <h3>{payments.length}</h3>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon revenue"><FiBarChart2 /></div>
            <div className="stat-info">
              <p>Revenue</p>
              <h3>{"\u20B9"}{payments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0).toLocaleString()}</h3>
            </div>
          </div>
        </section>

        {/* Event Table */}
        <div id="sec-events" className="table-container dash-section">
          <div className="admin-section-title">Manage All Events</div>
          <div className="table-wrapper">
            {loading ? <p className="p-4">Loading...</p> : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Event Name</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Attendees</th>
                    <th>Price</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length ? (
                    events.map((event) => (
                      <tr key={event._id}>
                        <td data-label="Event Name"><strong>{event.title}</strong></td>
                        <td data-label="Date">{new Date(event.date).toLocaleDateString()}</td>
                        <td data-label="Category"><span className="table-badge">{event.category}</span></td>
                        <td data-label="Attendees">{event.attendees?.length || 0} users</td>
                        <td data-label="Price">{"\u20B9"}{event.price}</td>
                        <td data-label="Actions" className="actions">
                          <button className="edit-btn" onClick={() => openEditModal(event)}><FiEdit3 /></button>
                          <button className="delete-btn" onClick={() => handleDelete(event._id)}><FiTrash2 /></button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td className="muted" colSpan={6}>No events yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div id="sec-revenue" className="dash-section">
          <RevenueBars data={revenue} />
        </div>

        <div id="sec-activity" className="table-container dash-section">
          <div className="admin-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Activity Logs
            <button className="eh-btn-nav" style={{ fontSize: '12px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={exportToCSV}>
              <FiDownload /> Export Report
            </button>
          </div>
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Event</th>
                  <th>Attendees</th>
                  <th>Review</th>
                  <th>Status</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.length ? (
                  activityRows.map((row) => (
                    <tr key={row.key}>
                      <td data-label="User"><strong>{row.userName}</strong></td>
                      <td data-label="Event">{row.eventName}</td>
                      <td data-label="Attendees"><span className="table-badge">{row.attendees}</span></td>
                      <td data-label="Review" className="review-cell">
                        <span className="muted review-text" title={row.review}>{row.review}</span>
                      </td>
                      <td data-label="Status">
                        {row.cancelStatus !== "-" ? (
                          <span className="table-badge warning">{row.cancelStatus}</span>
                        ) : <span className="muted">-</span>}
                      </td>
                      <td data-label="Rating">{row.rating ? <span className="rating-stars">{"\u2605".repeat(row.rating)}</span> : <span className="muted">-</span>}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td className="muted" colSpan={6}>No activity yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-split">
          <div id="sec-users" className="table-container dash-section">
            <div className="admin-section-title">All Users</div>
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length ? (
                    users.map((u) => (
                      <tr key={u._id}>
                        <td data-label="Name"><strong>{u.name}</strong></td>
                        <td data-label="Email">{u.email}</td>
                        <td data-label="Role"><span className="table-badge">{u.role}</span></td>
                        <td data-label="Actions" className="actions">
                          <button className="delete-btn" onClick={() => handleDeleteUser(u._id)}><FiTrash2 /></button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td className="muted" colSpan={4}>No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div id="sec-reminders" className="table-container dash-section">
            <div className="admin-section-title">Upcoming Event Reminders</div>
            <div className="reminders-list">
              {reminders.length ? (
                reminders.slice(0, 8).map((e) => (
                  <div className="reminder-item" key={e._id}>
                    <div className="reminder-icon"><FiCalendar /></div>
                    <div className="reminder-content">
                      <div className="reminder-title">{e.title}</div>
                      <div className="reminder-meta">{new Date(e.date).toDateString()} {"\u00B7"} {e.location}</div>
                    </div>
                  </div>
                ))
              ) : <p className="muted p-4">No upcoming events.</p>}
            </div>
          </div>
        </div>

        <div id="sec-payments" className="table-container payments-card dash-section">
          <div className="admin-section-title">Payment Details</div>
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Event</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Payment Id</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.length ? (
                  payments.map((p) => (
                    <tr key={p._id}>
                      <td data-label="User">{p.user?.name}</td>
                      <td data-label="Event"><strong>{p.event?.title}</strong></td>
                      <td data-label="Amount">{"\u20B9"}{p.amount}</td>
                      <td data-label="Date">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td data-label="Payment Id" className="mono">{p.razorpayPaymentId || "-"}</td>
                      <td data-label="Actions" className="actions">
                        <button className="delete-btn" onClick={() => handleDeletePayment(p._id)}><FiTrash2 /></button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td className="muted" colSpan={6}>No payment records yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {showConfirm.show && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <div className="confirm-icon"><FiTrash2 /></div>
            <h3>Confirm Delete</h3>
            <p>{showConfirm.msg}</p>
            <div className="confirm-btns">
              <button className="cancel-btn" onClick={() => setShowConfirm({ ...showConfirm, show: false })}>Cancel</button>
              <button className="confirm-btn danger" onClick={handleConfirmAction}>Delete Now</button>
            </div>
          </div>
        </div>
      )}

      {modalState.open && (
        <EventFormModal
          mode={modalState.mode}
          event={modalState.event}
          onClose={closeEventModal}
          onSaved={handleEventSaved}
        />
      )}
    </div>
  );
};

export default Dashboard;
