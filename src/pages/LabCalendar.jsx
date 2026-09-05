// src/pages/LabCalendar.jsx

import { orderBy } from "firebase/firestore";

import { useCollection } from "../hooks/useFirestore";
import { EventCalendar } from "../components/EventCalendar";
import { StatusPill } from "../components/StatusPill";
import { useAuth } from "../context/AuthContext";

function formatTime(value) {
  if (!value) return "";

  const [hours, minutes] =
    String(value).split(":");

  if (
    hours === undefined ||
    minutes === undefined
  ) {
    return String(value);
  }

  const date = new Date();

  date.setHours(
    Number(hours),
    Number(minutes),
    0,
    0
  );

  return date.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function getTimeSlot(session) {
  // New format
  if (
    session.startTime &&
    session.endTime
  ) {
    return `${formatTime(
      session.startTime
    )} – ${formatTime(
      session.endTime
    )}`;
  }

  // Old format, for existing records
  if (session.timeSlot) {
    return session.timeSlot;
  }

  return "Time not set";
}

export default function LabCalendar() {
  const { profile } = useAuth();

  const {
    data: sessions,
    loading: sessionsLoading,
  } = useCollection(
    "labSessions",
    [orderBy("date", "asc")]
  );

  /*
   * Load groups so we can resolve both:
   *
   * profile.groupId = actual Firestore ID
   *
   * OR
   *
   * profile.groupId = group name such as "CE14"
   *
   * This is important because older user profiles may
   * contain the group name while labSessions use actual
   * DocumentReferences.
   */
  const {
    data: groups,
    loading: groupsLoading,
  } = useCollection("groups");

  /*
   * Find the actual Firestore group document ID.
   */
  const currentGroup = groups.find(
    (group) =>
      group.id === profile?.groupId ||
      group.name === profile?.groupId
  );

  const currentGroupId =
    currentGroup?.id || null;

  /*
   * Show every lab assigned to the current user's group.
   *
   * This applies to:
   * - members
   * - leaders
   * - admins
   */
  const visible = sessions.filter(
    (session) => {
      if (!currentGroupId) {
        return false;
      }

      if (
        !Array.isArray(
          session.groupIds
        )
      ) {
        return false;
      }

      return session.groupIds.some(
        (groupRef) => {
          /*
           * New format:
           * Firestore DocumentReference
           */
          if (
            groupRef?.id
          ) {
            return (
              groupRef.id ===
              currentGroupId
            );
          }

          /*
           * Backwards compatibility:
           * in case an older record has
           * a plain group ID/string.
           */
          if (
            typeof groupRef ===
            "string"
          ) {
            return (
              groupRef ===
              currentGroupId ||
              groupRef ===
              profile?.groupId
            );
          }

          return false;
        }
      );
    }
  );

  /*
   * Sort same-day labs by start time.
   */
  const sortedVisible = [
    ...visible,
  ].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(
        b.date
      );
    }

    const aTime =
      a.startTime ||
      "99:99";

    const bTime =
      b.startTime ||
      "99:99";

    return aTime.localeCompare(
      bTime
    );
  });

  const loading =
    sessionsLoading ||
    groupsLoading;

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">
          Lab Sessions
        </h2>

        <p className="text-sm text-slate-500 mt-1">
          Lab sessions scheduled for your
          group.
        </p>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <p className="text-sm text-slate-400">
            Loading lab sessions…
          </p>
        </div>
      ) : !profile?.groupId ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-sm text-amber-700">
            Your account is not assigned to
            a group yet.
          </p>
        </div>
      ) : !currentGroup ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-sm text-red-700">
            Could not find your group.
          </p>

          <p className="text-xs text-red-500 mt-1">
            Group value: {profile.groupId}
          </p>
        </div>
      ) : sortedVisible.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <p className="text-sm text-slate-400">
            No lab sessions are scheduled
            for {currentGroup.name || currentGroup.id}.
          </p>
        </div>
      ) : (
        <EventCalendar
          events={sortedVisible.map(
            (session) => ({
              ...session,
              status:
                session.status ||
                "scheduled",
            })
          )}
          emptyLabel="No lab session this day"
          renderDetail={(event) => (
            <div className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">
                  {event.title}
                </p>

                <StatusPill
                  status={
                    event.status
                  }
                />
              </div>

              <p className="text-xs text-slate-400 mt-1">
                {getTimeSlot(event)}
                {" · "}
                {event.venue ||
                  "Venue not set"}
              </p>

              {event.topic && (
                <p className="text-xs text-slate-500 mt-1">
                  {event.topic}
                </p>
              )}

              {Array.isArray(
                event.groupIds
              ) &&
                event.groupIds.length >
                  0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Groups:{" "}
                    {event.groupIds
                      .map(
                        (ref) =>
                          ref?.id ||
                          ref
                      )
                      .filter(
                        Boolean
                      )
                      .join(", ")}
                  </p>
                )}
            </div>
          )}
        />
      )}
    </div>
  );
}