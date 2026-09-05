// src/components/EventCalendar.jsx
// One month-grid calendar, reused by LectureCalendar, LabCalendar and
// AssessmentCalendar — each just passes a differently-shaped `events` array
// and its own detail renderer.
//
// event shape: { id, date: 'YYYY-MM-DD', status, ...whatever the page needs }

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusDot } from "./StatusPill";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

export function EventCalendar({ events, renderDetail, emptyLabel = "No events on this day" }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(toKey(today));

  const eventsByDay = useMemo(() => {
    const map = {};
    for (const ev of events) {
      const key = ev.date?.slice(0, 10);
      if (!key) continue;
      (map[key] ||= []).push(ev);
    }
    return map;
  }, [events]);

  const cells = useMemo(
    () => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedEvents = eventsByDay[selected] || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* Month grid */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{monthLabel}</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2 text-center text-xs font-medium text-slate-400">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="h-24 border-b border-r border-slate-100" />;
            const key = toKey(date);
            const dayEvents = eventsByDay[key] || [];
            const isToday = key === toKey(today);
            const isSelected = key === selected;

            return (
              <button
                key={i}
                onClick={() => setSelected(key)}
                className={`h-24 border-b border-r border-slate-100 p-2 flex flex-col items-start gap-1 text-left transition-colors hover:bg-slate-50 ${
                  isSelected ? "bg-blue-50/70" : ""
                }`}
              >
                <span
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? "bg-blue-600 text-white"
                      : isSelected
                      ? "text-blue-700"
                      : "text-slate-600"
                  }`}
                >
                  {date.getDate()}
                </span>
                <div className="flex flex-wrap gap-1 mt-auto">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <StatusDot key={ev.id} status={ev.status} />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-slate-400">+{dayEvents.length - 3}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel for the selected day */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <h4 className="text-sm font-semibold text-slate-800 mb-1">
          {new Date(selected + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h4>
        <p className="text-xs text-slate-400 mb-4">
          {selectedEvents.length} {selectedEvents.length === 1 ? "event" : "events"}
        </p>

        {selectedEvents.length === 0 ? (
          <p className="text-sm text-slate-400">{emptyLabel}</p>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map((ev) => (
              <div key={ev.id}>{renderDetail(ev)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
