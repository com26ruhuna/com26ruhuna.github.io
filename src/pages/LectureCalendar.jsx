// src/pages/LectureCalendar.jsx
// lectures/{id}: { subject, lecturer, date: 'YYYY-MM-DD', timeSlot, venue,
//                  status: 'held' | 'cancelled' | 'rescheduled',
//                  rescheduledTo?: 'YYYY-MM-DD HH:mm' }

import { orderBy } from "firebase/firestore";
import { useCollection } from "../hooks/useFirestore";
import { EventCalendar } from "../components/EventCalendar";
import { StatusPill } from "../components/StatusPill";

export default function LectureCalendar() {
  const { data: lectures, loading } = useCollection("lectures", [orderBy("date", "asc")]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">Lecture Schedule</h2>
        <p className="text-sm text-slate-500 mt-1">
          Track whether each lecture was held, cancelled, or moved.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <EventCalendar
          events={lectures}
          emptyLabel="No lectures scheduled this day"
          renderDetail={(ev) => (
            <div className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">{ev.subject}</p>
                <StatusPill status={ev.status} />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {ev.timeSlot} · {ev.venue}
              </p>
              {ev.lecturer && <p className="text-xs text-slate-400">{ev.lecturer}</p>}
              {ev.status === "rescheduled" && ev.rescheduledTo && (
                <p className="text-xs text-amber-600 mt-1">Moved to {ev.rescheduledTo}</p>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}
