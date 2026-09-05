// src/pages/LabCalendar.jsx
// labSessions/{id}: { title, topic, date: 'YYYY-MM-DD', timeSlot, venue,
//                      groupId: '<groupId>' | 'all', status: 'scheduled' | 'cancelled' }

import { orderBy } from "firebase/firestore";
import { useCollection } from "../hooks/useFirestore";
import { EventCalendar } from "../components/EventCalendar";
import { StatusPill } from "../components/StatusPill";
import { useAuth } from "../context/AuthContext";

export default function LabCalendar() {
  const { profile } = useAuth();
  const { data: sessions, loading } = useCollection("labSessions", [orderBy("date", "asc")]);

  const visible = sessions.filter(
  (s) =>
    Array.isArray(s.groupIds) &&
    s.groupIds.some((groupRef) => groupRef.id === profile?.groupId)
);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">Lab Sessions</h2>
        <p className="text-sm text-slate-500 mt-1">
          Upcoming and past lab session dates, time slots, and venues.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <EventCalendar
          events={visible.map((s) => ({ ...s, status: s.status || "scheduled" }))}
          emptyLabel="No lab session this day"
          renderDetail={(ev) => (
            <div className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">{ev.title}</p>
                <StatusPill status={ev.status} />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {ev.timeSlot} · {ev.venue}
              </p>
              {ev.topic && <p className="text-xs text-slate-500 mt-1">{ev.topic}</p>}

              {Array.isArray(ev.groupIds) && ev.groupIds.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Groups: {ev.groupIds.map((ref) => ref.id).join(", ")}
                </p>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}
