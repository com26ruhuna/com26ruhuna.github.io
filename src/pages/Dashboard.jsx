// src/pages/Dashboard.jsx

import { useMemo } from "react";
import {
  where,
  orderBy,
  limit,
} from "firebase/firestore";

import {
  CalendarDays,
  FlaskConical,
  ClipboardList,
  CheckSquare,
  Clock,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { StatusPill } from "../components/StatusPill";
import { UserAvatar } from "../components/UserAvatar";

function todayISO() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function fmtDate(iso) {
  if (!iso) return "";

  return new Date(`${iso}T00:00:00`).toLocaleDateString(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
    }
  );
}

function fmtTime(time) {
  if (!time) return "";

  const [hours, minutes] = String(time).split(":");

  if (!hours || minutes === undefined) {
    return String(time);
  }

  const date = new Date();

  date.setHours(
    Number(hours),
    Number(minutes),
    0,
    0
  );

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStartTime(item) {
  if (item.startTime) {
    return item.startTime;
  }

  // Backwards compatibility for old timeSlot values.
  if (item.timeSlot) {
    const match = String(item.timeSlot).match(
      /(\d{1,2}):(\d{2})\s*(AM|PM)?/i
    );

    if (match) {
      let hour = Number(match[1]);
      const minute = match[2];
      const period = match[3]?.toUpperCase();

      if (period === "PM" && hour !== 12) {
        hour += 12;
      }

      if (period === "AM" && hour === 12) {
        hour = 0;
      }

      return `${String(hour).padStart(2, "0")}:${minute}`;
    }
  }

  return "99:99";
}

function getEndTime(item) {
  if (item.endTime) {
    return item.endTime;
  }

  return "";
}

function getTimeSlot(item) {
  if (item.startTime && item.endTime) {
    return `${fmtTime(item.startTime)} – ${fmtTime(
      item.endTime
    )}`;
  }

  if (item.timeSlot) {
    return item.timeSlot;
  }

  return "Time not set";
}

function NextUpCard({
  icon: Icon,
  label,
  item,
  primaryField,
  meta,
  accent,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}
        >
          <Icon size={16} />
        </div>

        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {label}
        </span>
      </div>

      {item ? (
        <>
          <p className="text-base font-semibold text-slate-800 mb-1">
            {primaryField}
          </p>

          <p className="text-sm text-slate-500">
            {meta}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-400">
          Nothing scheduled
        </p>
      )}
    </div>
  );
}

function TodayEvent({ item, type }) {
  const isLab = type === "lab";
  const isAssessment = type === "assessment";

  return (
    <div className="flex items-center gap-4 px-4 py-4 border-b border-slate-100 last:border-b-0">

      {/* Time */}
      <div className="w-28 shrink-0">
        <p className="text-sm font-semibold text-slate-700">
          {item.startTime
            ? fmtTime(item.startTime)
            : getTimeSlot(item)}
        </p>

        {item.startTime &&
          item.endTime && (
            <p className="text-xs text-slate-400 mt-0.5">
              {fmtTime(item.endTime)}
            </p>
          )}
      </div>

      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isLab
            ? "bg-emerald-50 text-emerald-600"
            : isAssessment
            ? "bg-violet-50 text-violet-600"
            : "bg-blue-50 text-blue-600"
        }`}
      >
        {isLab ? (
          <FlaskConical size={17} />
        ) : isAssessment ? (
          <ClipboardList size={17} />
        ) : (
          <CalendarDays size={17} />
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {isLab
              ? item.title
              : isAssessment
              ? item.title
              : item.subject}
          </p>

          <span
            className={`hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
              isLab
                ? "bg-emerald-50 text-emerald-700"
                : isAssessment
                ? "bg-violet-50 text-violet-700"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            {isLab
              ? "Lab"
              : isAssessment
              ? "Assessment"
              : "Lecture"}
          </span>
        </div>

        <p className="text-xs text-slate-400 mt-1 truncate">
          {isLab
            ? item.topic || "Lab session"
            : isAssessment
            ? item.module || item.type || "Assessment"
            : item.lecturer || "Lecture"}
          {" · "}
          {item.venue || "Venue not set"}
        </p>
      </div>

      {/* Status */}
      {item.status && (
        <StatusPill status={item.status} />
      )}
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();

  const today = todayISO();

  /*
   * Future lectures.
   */
  const {
    data: lectures,
  } = useCollection("lectures", [
    where("date", ">=", today),
    orderBy("date", "asc"),
    limit(50),
  ]);

  /*
   * Future labs.
   */
  const {
    data: labs,
  } = useCollection("labSessions", [
    where("date", ">=", today),
    orderBy("date", "asc"),
    limit(50),
  ]);

  /*
   * Future assessments.
   */
  const {
    data: assessments,
  } = useCollection("assessments", [
    where("date", ">=", today),
    orderBy("date", "asc"),
    limit(50),
  ]);

  /*
   * Current user's attendance.
   */
  const {
    data: myAttendance,
  } = useCollection(
    "attendanceRecords",
    profile
      ? [
          where(
            "uid",
            "==",
            profile.id
          ),
        ]
      : []
  );

  const presentCount =
    myAttendance.filter(
      (record) => record.present
    ).length;

  const attendanceRate =
    myAttendance.length > 0
      ? Math.round(
          (presentCount /
            myAttendance.length) *
            100
        )
      : null;

  /*
   * Labs belonging to the current user's group.
   *
   * This applies equally to:
   * - members
   * - leaders
   * - admins
   */
  const visibleLabs = useMemo(() => {
    if (!profile?.groupId) {
      return [];
    }

    return labs.filter(
      (session) =>
        Array.isArray(
          session.groupIds
        ) &&
        session.groupIds.some(
          (groupRef) =>
            groupRef?.id ===
            profile.groupId
        )
    );
  }, [
    labs,
    profile?.groupId,
  ]);

  /*
   * Next lecture.
   */
  const nextLecture =
    [...lectures]
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(
            b.date
          );
        }

        return getStartTime(
          a
        ).localeCompare(
          getStartTime(b)
        );
      })[0] || null;

  /*
   * Next lab for user's group.
   */
  const nextLab =
    [...visibleLabs]
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(
            b.date
          );
        }

        return getStartTime(
          a
        ).localeCompare(
          getStartTime(b)
        );
      })[0] || null;

  /*
   * Next assessment.
   */
  const nextAssessment =
    [...assessments]
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(
            b.date
          );
        }

        return getStartTime(
          a
        ).localeCompare(
          getStartTime(b)
        );
      })[0] || null;

  /*
   * TODAY'S LECTURES
   */
  const todaysLectures =
    lectures
      .filter(
        (lecture) =>
          lecture.date === today
      )
      .map((lecture) => ({
        ...lecture,
        _type: "lecture",
      }));

  /*
   * TODAY'S LABS
   */
  const todaysLabs =
    visibleLabs
      .filter(
        (lab) =>
          lab.date === today
      )
      .map((lab) => ({
        ...lab,
        _type: "lab",
      }));

  /*
   * TODAY'S ASSESSMENTS
   */
  const todaysAssessments =
    assessments
      .filter(
        (assessment) =>
          assessment.date === today
      )
      .map((assessment) => ({
        ...assessment,
        _type: "assessment",
      }));

  /*
   * Combine EVERYTHING for today.
   *
   * Sorting is done by:
   * 1. Start time
   * 2. End time
   * 3. Type as final tie-breaker
   */
  const todaysSchedule = [
    ...todaysLectures,
    ...todaysLabs,
    ...todaysAssessments,
  ].sort((a, b) => {
    const startCompare =
      getStartTime(a).localeCompare(
        getStartTime(b)
      );

    if (startCompare !== 0) {
      return startCompare;
    }

    const endCompare =
      getEndTime(a).localeCompare(
        getEndTime(b)
      );

    if (endCompare !== 0) {
      return endCompare;
    }

    return a._type.localeCompare(
      b._type
    );
  });

  return (
    <div className="space-y-8">

      {/* Welcome */}
      <div className="flex items-center gap-4">
        <UserAvatar
          photoURL={profile?.photoURL}
          name={profile?.name}
          size="lg"
        />

        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-800">
            Welcome back
            {profile?.name
              ? `, ${
                  profile.name.split(
                    " "
                  )[0]
                }`
              : ""}
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            Here's what's coming up for the
            Computer Engineering batch.
          </p>
        </div>
      </div>

      {/* Next cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

        <NextUpCard
          icon={CalendarDays}
          label="Next Lecture"
          item={nextLecture}
          primaryField={
            nextLecture?.subject
          }
          meta={
            nextLecture
              ? `${fmtDate(
                  nextLecture.date
                )} · ${getTimeSlot(
                  nextLecture
                )}`
              : ""
          }
          accent="bg-blue-50 text-blue-600"
        />

        <NextUpCard
          icon={FlaskConical}
          label="Next Lab Session"
          item={nextLab}
          primaryField={
            nextLab?.title
          }
          meta={
            nextLab
              ? `${fmtDate(
                  nextLab.date
                )} · ${getTimeSlot(
                  nextLab
                )}`
              : ""
          }
          accent="bg-emerald-50 text-emerald-600"
        />

        <NextUpCard
          icon={ClipboardList}
          label="Next Assessment"
          item={nextAssessment}
          primaryField={
            nextAssessment?.title
          }
          meta={
            nextAssessment
              ? `${fmtDate(
                  nextAssessment.date
                )} · ${getTimeSlot(
                  nextAssessment
                )}`
              : ""
          }
          accent="bg-violet-50 text-violet-600"
        />

        {/* Attendance */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600">
              <CheckSquare
                size={16}
              />
            </div>

            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              My Attendance
            </span>
          </div>

          {attendanceRate ===
          null ? (
            <p className="text-sm text-slate-400">
              No records yet
            </p>
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-800">
                {attendanceRate}%
              </p>

              <p className="text-sm text-slate-500">
                {presentCount} of{" "}
                {myAttendance.length}{" "}
                sessions
              </p>
            </>
          )}
        </div>
      </div>

      {/* Today's schedule */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Clock
            size={18}
            className="text-slate-500"
          />

          <div>
            <h3 className="font-semibold text-slate-800">
              Today's Schedule
            </h3>

            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(
                `${today}T00:00:00`
              ).toLocaleDateString(
                "en-US",
                {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                }
              )}
            </p>
          </div>
        </div>

        {todaysSchedule.length ===
        0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-400">
              Nothing scheduled for today.
            </p>
          </div>
        ) : (
          <div>
            {todaysSchedule.map(
              (event) => (
                <TodayEvent
                  key={`${event._type}-${event.id}`}
                  item={event}
                  type={event._type}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Next lecture details */}
      {nextLecture?.status && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700">
              {nextLecture.subject}
            </p>

            <p className="text-xs text-slate-400 mt-0.5">
              {fmtDate(
                nextLecture.date
              )}
              {" · "}
              {getTimeSlot(
                nextLecture
              )}
              {" · "}
              {nextLecture.venue ||
                "Venue not set"}
            </p>
          </div>

          <StatusPill
            status={
              nextLecture.status
            }
          />
        </div>
      )}
    </div>
  );
}