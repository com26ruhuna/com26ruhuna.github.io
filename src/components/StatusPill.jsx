// src/components/StatusPill.jsx
// Consistent colored label for lecture/lab/assessment/attendance states.

const STYLES = {
  held: "bg-emerald-50 text-emerald-700 border-emerald-200",
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  upcoming: "bg-blue-50 text-blue-700 border-blue-200",
  rescheduled: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  absent: "bg-red-50 text-red-700 border-red-200",
  quiz: "bg-violet-50 text-violet-700 border-violet-200",
  assignment: "bg-blue-50 text-blue-700 border-blue-200",
  midterm: "bg-orange-50 text-orange-700 border-orange-200",
  final: "bg-red-50 text-red-700 border-red-200",
};

const DOT_STYLES = {
  held: "bg-emerald-500",
  present: "bg-emerald-500",
  scheduled: "bg-blue-500",
  upcoming: "bg-blue-500",
  rescheduled: "bg-amber-500",
  pending: "bg-amber-500",
  cancelled: "bg-red-500",
  absent: "bg-red-500",
  quiz: "bg-violet-500",
  assignment: "bg-blue-500",
  midterm: "bg-orange-500",
  final: "bg-red-500",
};

export function StatusPill({ status, label }) {
  const style = STYLES[status] || "bg-slate-100 text-slate-600 border-slate-200";
  const text = label || status?.charAt(0).toUpperCase() + status?.slice(1);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${style}`}
    >
      {text}
    </span>
  );
}

export function StatusDot({ status }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${
        DOT_STYLES[status] || "bg-slate-400"
      }`}
    />
  );
}
