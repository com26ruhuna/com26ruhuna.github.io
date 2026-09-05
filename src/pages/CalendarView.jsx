import { useState, useEffect } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";

const localizer = momentLocalizer(moment);

export default function CalendarView() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Fetch events from Firestore
    const fetchEvents = async () => {
      const querySnapshot = await getDocs(collection(db, "events"));
      const eventsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: `[${data.type.toUpperCase()}] ${data.title} - ${data.status}`,
          start: data.start_time.toDate(),
          end: data.end_time.toDate(),
          type: data.type
        };
      });
      setEvents(eventsData);
    };

    fetchEvents();
  }, []);

  // Formal styling for different event types
  const eventStyleGetter = (event) => {
    let backgroundColor = "#1e3a8a"; // Default Blue for Lectures
    if (event.type === 'lab') backgroundColor = "#166534"; // Green for Labs
    if (event.type === 'ca') backgroundColor = "#991b1b"; // Red for CAs

    return { style: { backgroundColor, color: "white", borderRadius: "4px" } };
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h1 className="text-2xl font-semibold mb-6 text-gray-800">Academic Calendar</h1>
      <div className="h-[600px]">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          eventPropGetter={eventStyleGetter}
          views={['month', 'week', 'day']}
        />
      </div>
    </div>
  );
}