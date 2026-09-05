// src/pages/AssessmentCalendar.jsx
// assessments/{id}: { title, module, type: 'quiz' | 'assignment' | 'midterm' | 'final',
//                      date: 'YYYY-MM-DD', timeSlot, venue, weight }

import { orderBy } from "firebase/firestore";
import { useCollection } from "../hooks/useFirestore";
import { EventCalendar } from "../components/EventCalendar";
import { StatusPill } from "../components/StatusPill";

export default function AssessmentCalendar() {
  const { data: assessments, loading } = useCollection("assessments", [orderBy("date", "asc")]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">Assessments</h2>
        <p className="text-sm text-slate-500 mt-1">
          Quizzes, assignments and exam dates across all modules.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <EventCalendar
          events={assessments.map((a) => ({ ...a, status: a.type }))}
          emptyLabel="Nothing due this day"
          renderDetail={(ev) => (
            <div className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">{ev.title}</p>
                <StatusPill status={ev.type} />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {ev.timeSlot} · {ev.venue}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {ev.module}
                {ev.weight ? ` · ${ev.weight}% of module` : ""}
              </p>
            </div>
          )}
        />
      )}
    </div>
  );
}
