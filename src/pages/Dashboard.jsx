// src/pages/Dashboard.jsx
// Landing page: greets the user, and surfaces the next lab, next lecture,
// next assessment, and the member's own attendance rate at a glance.

import { where, orderBy, limit } from "firebase/firestore";
import { CalendarDays, FlaskConical, ClipboardList, CheckSquare } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { StatusPill } from "../components/StatusPill";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function NextUpCard({ icon: Icon, label, item, primaryField, meta, accent }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon size={16} />
        </div>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {label}
        </span>
      </div>
      {item ? (
        <>
          <p className="text-base font-semibold text-slate-800 mb-1">{primaryField}</p>
          <p className="text-sm text-slate-500">{meta}</p>
        </>
      ) : (
        <p className="text-sm text-slate-400">Nothing scheduled</p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { profile, isLeader, isAdmin } = useAuth();

  const { data: lectures } = useCollection("lectures", [
    where("date", ">=", todayISO()),
    orderBy("date", "asc"),
    limit(1),
  ]);
  const { data: labs } = useCollection("labSessions", [
  where("date", ">=", todayISO()),
  orderBy("date", "asc"),
]);
  const { data: assessments } = useCollection("assessments", [
    where("date", ">=", todayISO()),
    orderBy("date", "asc"),
    limit(1),
  ]);

  // Attendance records for the signed-in user across all lab sessions.
  const { data: myAttendance } = useCollection(
    "attendanceRecords",
    profile ? [where("uid", "==", profile.id)] : []
  );
  const presentCount = myAttendance.filter((r) => r.present).length;
  const attendanceRate =
    myAttendance.length > 0 ? Math.round((presentCount / myAttendance.length) * 100) : null;

  const nextLecture = lectures[0];
  const visibleLabs = labs.filter(
  (s) =>
    Array.isArray(s.groupIds) &&
    s.groupIds.some((groupRef) => groupRef.id === profile?.groupId)
);

const nextLab = visibleLabs[0];
  const nextAssessment = assessments[0];

  const fmt = (iso) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">
          Welcome back{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Here's what's coming up for the Computer Engineering batch.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <NextUpCard
          icon={CalendarDays}
          label="Next Lecture"
          item={nextLecture}
          primaryField={nextLecture?.subject}
          meta={nextLecture ? `${fmt(nextLecture.date)} · ${nextLecture.timeSlot || ""}` : ""}
          accent="bg-blue-50 text-blue-600"
        />
        <NextUpCard
          icon={FlaskConical}
          label="Next Lab Session"
          item={nextLab}
          primaryField={nextLab?.title}
          meta={nextLab ? `${fmt(nextLab.date)} · ${nextLab.venue || ""}` : ""}
          accent="bg-emerald-50 text-emerald-600"
        />
        <NextUpCard
          icon={ClipboardList}
          label="Next Assessment"
          item={nextAssessment}
          primaryField={nextAssessment?.title}
          meta={nextAssessment ? `${fmt(nextAssessment.date)} · ${nextAssessment.type || ""}` : ""}
          accent="bg-violet-50 text-violet-600"
        />
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600">
              <CheckSquare size={16} />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              My Attendance
            </span>
          </div>
          {attendanceRate === null ? (
            <p className="text-sm text-slate-400">No records yet</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-800">{attendanceRate}%</p>
              <p className="text-sm text-slate-500">
                {presentCount} of {myAttendance.length} sessions
              </p>
            </>
          )}
        </div>
      </div>

      {nextLecture?.status && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">{nextLecture.subject}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {fmt(nextLecture.date)} · {nextLecture.timeSlot} · {nextLecture.venue}
            </p>
          </div>
          <StatusPill status={nextLecture.status} />
        </div>
      )}
    </div>
  );
}
