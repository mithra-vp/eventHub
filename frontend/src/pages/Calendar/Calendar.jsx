import React, { useEffect, useMemo, useState } from "react";
import "./calendar.css";
import { api } from "../../api/client.js";
import { FiChevronLeft, FiChevronRight, FiCalendar, FiMapPin, FiClock } from "react-icons/fi";

const toKey = (d) => {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const CalendarPage = () => {
  const [events, setEvents] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [hoveredDate, setHoveredDate] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/events/all");
        setEvents(res.data || []);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const upcomingEvents = useMemo(() => {
    const today = startOfToday();
    return events
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .filter((e) => new Date(e.date) >= today);
  }, [events]);

  const marks = useMemo(() => {
    const map = new Map();
    for (const e of upcomingEvents) {
      const k = toKey(e.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
    return map;
  }, [upcomingEvents]);

  const first = new Date(year, month, 1);
  const startDay = first.getDay(); 
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));

  const label = new Date(year, month, 1).toLocaleString(undefined, { month: "long", year: "numeric" });

  const prevMonth = () => {
    const next = new Date(year, month - 1, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };
  const nextMonth = () => {
    const next = new Date(year, month + 1, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return upcomingEvents.filter((e) => toKey(e.date) === selectedDate);
  }, [upcomingEvents, selectedDate]);

  return (
    <div className="cal-page">
      <div className="cal-container">
        <div className="cal-layout">
          <div className="cal-main-side">
            <div className="cal-card">
              <div className="cal-header-top">
                <div className="cal-header-text">
                  <h1 className="cal-title">My <span>Schedule</span></h1>
                  <p className="cal-subtitle">Track your upcoming event bookings.</p>
                </div>
                <div className="cal-nav-btns">
                  <button onClick={prevMonth} className="cal-nav-btn"><FiChevronLeft /></button>
                  <div className="cal-month-label">{label}</div>
                  <button onClick={nextMonth} className="cal-nav-btn"><FiChevronRight /></button>
                </div>
              </div>

              <div className="cal-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div className="cal-dow" key={d}>{d}</div>
                ))}

                {cells.map((date, idx) => {
                  if (!date) return <div key={idx} className="cal-cell empty" />;
                  const key = toKey(date);
                  const dayEvents = marks.get(key) || [];
                  const isToday = key === toKey(new Date());
                  const isPastDay = date < startOfToday();
                  
                  return (
                    <div 
                      key={idx} 
                      className={`cal-cell ${dayEvents.length ? "has-events" : ""} ${isToday ? "is-today" : ""} ${isPastDay ? "is-past" : ""} ${selectedDate === key ? "is-selected" : ""}`}
                      onMouseEnter={() => dayEvents.length > 0 && setHoveredDate(key)}
                      onMouseLeave={() => setHoveredDate(null)}
                      onClick={() => !isPastDay && setSelectedDate(key === selectedDate ? null : key)}
                    >
                      <div className="cal-day-num-wrapper">
                        <div className="cal-day-num">{date.getDate()}</div>
                        {dayEvents.length > 0 && <div className="cal-pink-circle" />}
                      </div>

                      {hoveredDate === key && dayEvents.length > 0 && (
                        <div className="cal-tooltip">
                          <div className="cal-tooltip-header">Events on {date.getDate()} {new Date(year, month, 1).toLocaleString(undefined, {month: 'short'})}</div>
                          {dayEvents.map((e, i) => (
                            <div key={i} className="cal-tooltip-item" onClick={(evt) => { evt.stopPropagation(); setSelectedDate(key); }}>
                              <div className="cal-tooltip-title">{e.title}</div>
                              <div className="cal-tooltip-meta">
                                <span className="cal-tooltip-type">{e.category || "Event"}</span>
                                <span className="cal-tooltip-time"><FiClock size={10} /> {new Date(e.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedDate && (
            <div className="cal-list-side">
              <div className="cal-card">
                <div className="cal-selected-section">
                  <h3 className="list-title">
                    <FiCalendar style={{marginRight: '10px'}} /> 
                    Events for {new Date(selectedDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                  </h3>
                  <div className="cal-list-scroll">
                    {selectedEvents.length > 0 ? (
                      selectedEvents.map((e) => (
                        <div key={e._id} className="cal-event-item selected-item">
                          <div className="cal-event-date-pill">
                            <span className="pill-day">{new Date(e.date).getDate()}</span>
                            <span className="pill-month">{new Date(e.date).toLocaleString(undefined, {month: 'short'})}</span>
                          </div>
                          <div className="cal-event-info">
                            <h4>{e.title}</h4>
                            <div className="cal-event-meta">
                              <span><FiMapPin size={12} /> {e.location}</span>
                              <span><FiClock size={12} /> {new Date(e.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="cal-empty-state">No events for this date.</p>
                    )}
                  </div>
                  <button className="eh-btn-nav" onClick={() => setSelectedDate(null)} style={{marginTop: '20px', width: '100%', justifyContent: 'center'}}>
                    Close Details
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
