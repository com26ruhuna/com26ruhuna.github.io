// src/pages/Attendance.jsx

import { useEffect, useMemo, useState } from "react";

import {
  where,
  orderBy,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  collection,
  query,
  limit,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { StatusPill } from "../components/StatusPill";

import {
  Check,
  X,
  Loader2,
} from "lucide-react";

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

  if (
    hours === undefined ||
    minutes === undefined
  ) {
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

function getTimeSlot(session) {
  // New data model
  if (
    session.startTime &&
    session.endTime
  ) {
    return `${fmtTime(
      session.startTime
    )} – ${fmtTime(
      session.endTime
    )}`;
  }

  // Old data model
  if (session.timeSlot) {
    return session.timeSlot;
  }

  return "Time not set";
}

/*
 * Resolve the current user's group.
 *
 * profile.groupId may be:
 * 1. the actual Firestore document ID
 * 2. the group name, e.g. "CE14"
 */
async function resolveGroup(groupId) {
  if (!groupId) {
    throw new Error(
      "Your account is not assigned to a group."
    );
  }

  // Try groupId as the document ID first.
  const directRef = doc(
    db,
    "groups",
    groupId
  );

  const directSnap = await getDoc(
    directRef
  );

  if (directSnap.exists()) {
    return {
      id: directSnap.id,
      ref: directRef,
      data: directSnap.data(),
    };
  }

  // Fall back to searching by group name.
  const groupQuery = query(
    collection(db, "groups"),
    where("name", "==", groupId),
    limit(1)
  );

  const groupSnapshot =
    await getDocs(groupQuery);

  if (!groupSnapshot.empty) {
    const snap =
      groupSnapshot.docs[0];

    return {
      id: snap.id,
      ref: snap.ref,
      data: snap.data(),
    };
  }

  throw new Error(
    `Could not find your group "${groupId}". Check the Group assignment in Admin → Users.`
  );
}

function LeaderView({ profile }) {
  /*
   * Load ALL lab sessions.
   */
  const {
    data: allSessions,
    loading: sessionsLoading,
  } = useCollection(
    "labSessions",
    [orderBy("date", "desc")]
  );

  /*
   * Load groups so we can resolve a group name
   * such as CE14 to its actual Firestore ID.
   */
  const {
    data: groups,
    loading: groupsLoading,
  } = useCollection("groups");

  /*
   * Resolve the current user's group.
   */
  const currentGroup = useMemo(() => {
    if (!profile?.groupId) {
      return null;
    }

    return (
      groups.find(
        (group) =>
          group.id === profile.groupId ||
          group.name === profile.groupId
      ) || null
    );
  }, [
    groups,
    profile?.groupId,
  ]);

  const currentGroupId =
    currentGroup?.id || null;

  /*
   * Show every lab assigned to the current user's group.
   *
   * Status is NOT used for filtering.
   * Scheduled and cancelled labs remain visible.
   */
  const sessions = useMemo(() => {
    if (!currentGroupId) {
      return [];
    }

    return allSessions.filter(
      (session) => {
        /*
         * New model:
         * groupIds = [DocumentReference, ...]
         */
        if (
          Array.isArray(
            session.groupIds
          )
        ) {
          const matchesGroup =
            session.groupIds.some(
              (groupRef) => {
                if (groupRef?.id) {
                  return (
                    groupRef.id ===
                    currentGroupId
                  );
                }

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

          if (matchesGroup) {
            return true;
          }
        }

        /*
         * Backwards compatibility:
         * old lab documents may have groupId.
         */
        if (session.groupId) {
          if (
            session.groupId?.id ===
            currentGroupId
          ) {
            return true;
          }

          if (
            session.groupId ===
            currentGroupId
          ) {
            return true;
          }

          if (
            session.groupId ===
            profile?.groupId
          ) {
            return true;
          }
        }

        return false;
      }
    );
  }, [
    allSessions,
    currentGroupId,
    profile?.groupId,
  ]);

  /*
   * Sort by date, then start time.
   */
  const sortedSessions = useMemo(() => {
    return [...sessions].sort(
      (a, b) => {
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
      }
    );
  }, [sessions]);

  const [
    sessionId,
    setSessionId,
  ] = useState("");

  const [
    members,
    setMembers,
  ] = useState([]);

  const [
    marks,
    setMarks,
  ] = useState({});

  const [
    loadingMembers,
    setLoadingMembers,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    savedAt,
    setSavedAt,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const selectedSession =
    useMemo(
      () =>
        sortedSessions.find(
          (session) =>
            session.id === sessionId
        ),
      [
        sortedSessions,
        sessionId,
      ]
    );

  const canMarkAttendance =
    selectedSession?.status ===
    "held";

  /*
   * Clear the selection if the
   * current session disappears.
   */
  useEffect(() => {
    if (
      sessionId &&
      !sortedSessions.some(
        (session) =>
          session.id ===
          sessionId
      )
    ) {
      setSessionId("");
      setMembers([]);
      setMarks({});
      setError("");
    }
  }, [
    sortedSessions,
    sessionId,
  ]);

  /*
   * Load group members and any existing
   * attendance marks.
   */
  useEffect(() => {
    if (
      !sessionId ||
      !profile?.groupId ||
      !canMarkAttendance
    ) {
      setMembers([]);
      setMarks({});
      setError("");
      setLoadingMembers(false);
      return;
    }

    let cancelled = false;

    async function loadAttendance() {
      setLoadingMembers(true);
      setSavedAt(null);
      setError("");
      setMembers([]);
      setMarks({});

      try {
        const group =
          await resolveGroup(
            profile.groupId
          );

        if (cancelled) return;

        const memberRefs =
          Array.isArray(
            group.data.members
          )
            ? group.data.members
            : [];

        const roster = [];

        for (
          const memberRef of memberRefs
        ) {
          if (cancelled) return;

          if (!memberRef?.path) {
            console.warn(
              "Ignoring invalid member reference:",
              memberRef
            );
            continue;
          }

          const userSnap =
            await getDoc(memberRef);

          if (!userSnap.exists()) {
            console.warn(
              "User document does not exist:",
              memberRef.path
            );
            continue;
          }

          roster.push({
            uid: userSnap.id,
            ...userSnap.data(),
          });
        }

        if (cancelled) return;

        setMembers(roster);

        /*
         * Load existing attendance.
         */
        const existingMarks = {};

        await Promise.all(
          roster.map(
            async (member) => {
              const recordRef =
                doc(
                  db,
                  "attendanceRecords",
                  `${sessionId}_${member.uid}`
                );

              const recordSnap =
                await getDoc(
                  recordRef
                );

              existingMarks[
                member.uid
              ] =
                recordSnap.exists()
                  ? recordSnap.data()
                      .present === true
                  : false;
            }
          )
        );

        if (cancelled) return;

        setMarks(existingMarks);
      } catch (err) {
        if (cancelled) return;

        console.error(
          "Failed to load attendance:",
          err
        );

        setMembers([]);
        setMarks({});

        setError(
          err?.message ||
            "Unable to load attendance."
        );
      } finally {
        if (!cancelled) {
          setLoadingMembers(false);
        }
      }
    }

    loadAttendance();

    return () => {
      cancelled = true;
    };
  }, [
    sessionId,
    profile?.groupId,
    canMarkAttendance,
  ]);

  const toggle = (uid) => {
    if (!canMarkAttendance) return;

    setMarks((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  const markAllPresent = () => {
    if (!canMarkAttendance) return;

    const next = {};

    members.forEach((member) => {
      next[member.uid] = true;
    });

    setMarks(next);
  };

  const markAllAbsent = () => {
    if (!canMarkAttendance) return;

    const next = {};

    members.forEach((member) => {
      next[member.uid] = false;
    });

    setMarks(next);
  };

  const save = async () => {
    if (
      !sessionId ||
      !profile?.groupId ||
      members.length === 0 ||
      !canMarkAttendance
    ) {
      return;
    }

    setSaving(true);
    setSavedAt(null);
    setError("");

    try {
      const group =
        await resolveGroup(
          profile.groupId
        );

      await Promise.all(
        members.map(
          (member) =>
            setDoc(
              doc(
                db,
                "attendanceRecords",
                `${sessionId}_${member.uid}`
              ),
              {
                sessionId,
                groupId: group.ref,
                uid: member.uid,
                name:
                  member.name || "",
                present:
                  !!marks[
                    member.uid
                  ],
                markedBy:
                  profile.id,
                markedAt:
                  serverTimestamp(),
              }
            )
        )
      );

      setSavedAt(new Date());
    } catch (err) {
      console.error(
        "Failed to save attendance:",
        err
      );

      setError(
        err?.message ||
          "Unable to save attendance. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const presentCount =
    Object.values(marks).filter(
      Boolean
    ).length;

  const loading =
    sessionsLoading ||
    groupsLoading;

  return (
    <div className="space-y-6">

      {/* Session selector */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Lab session
        </label>

        <select
          value={sessionId}
          onChange={(e) => {
            setSessionId(
              e.target.value
            );
            setError("");
          }}
          disabled={loading}
          className="w-full sm:w-96 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
        >
          <option value="">
            {loading
              ? "Loading sessions…"
              : "Select a session…"}
          </option>

          {sortedSessions.map(
            (session) => (
              <option
                key={session.id}
                value={session.id}
                disabled={
                  session.status !==
                  "held"
                }
              >
                {fmtDate(
                  session.date
                )}{" "}
                — {session.title}
                {session.status !==
                  "held"
                  ? ` (${session.status})`
                  : ""}
              </option>
            )
          )}
        </select>

        {!loading &&
          !profile?.groupId && (
            <p className="mt-2 text-sm text-amber-600">
              Your account is not assigned
              to a group.
            </p>
          )}

        {!loading &&
          profile?.groupId &&
          sortedSessions.length ===
            0 && (
            <p className="mt-2 text-sm text-slate-400">
              No lab sessions are assigned
              to your group.
            </p>
          )}

        {!loading &&
          sortedSessions.length >
            0 && (
            <p className="mt-2 text-xs text-slate-400">
              Only labs marked as held can
              have attendance recorded.
            </p>
          )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Selected session */}
      {sessionId &&
        selectedSession && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">
                      {
                        selectedSession.title
                      }
                    </p>

                    <StatusPill
                      status={
                        selectedSession.status
                      }
                    />
                  </div>

                  <p className="text-xs text-slate-400 mt-1">
                    {fmtDate(
                      selectedSession.date
                    )}
                    {" · "}
                    {getTimeSlot(
                      selectedSession
                    )}
                    {" · "}
                    {selectedSession.venue ||
                      "Venue not set"}
                  </p>
                </div>

                {canMarkAttendance && (
                  <span className="text-sm text-slate-500">
                    {presentCount}/
                    {members.length}{" "}
                    present
                  </span>
                )}
              </div>
            </div>

            {/* Scheduled/cancelled session */}
            {!canMarkAttendance && (
              <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 text-sm text-amber-700">
                Attendance can only be
                marked after this lab is
                marked as{" "}
                <strong>held</strong>.
              </div>
            )}

            {/* Quick actions */}
            {canMarkAttendance && (
              <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={
                    markAllPresent
                  }
                  disabled={
                    loadingMembers ||
                    members.length ===
                      0
                  }
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
                >
                  Mark all present
                </button>

                <button
                  type="button"
                  onClick={
                    markAllAbsent
                  }
                  disabled={
                    loadingMembers ||
                    members.length ===
                      0
                  }
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                >
                  Mark all absent
                </button>
              </div>
            )}

            {/* Roster */}
            {canMarkAttendance &&
              (loadingMembers ? (
                <div className="p-8 flex justify-center text-slate-400">
                  <Loader2
                    className="animate-spin"
                    size={20}
                  />
                </div>
              ) : members.length ===
                0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-slate-500">
                    No members found in
                    your group.
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Check the group's Members
                    list in the Admin Panel.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {members.map(
                    (member) => (
                      <li
                        key={member.uid}
                        className="flex items-center justify-between gap-4 px-5 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {member.name ||
                              "Unnamed"}
                          </p>

                          <p className="text-xs text-slate-400 truncate">
                            {member.regNo ||
                              member.email ||
                              "No details"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            toggle(
                              member.uid
                            )
                          }
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors shrink-0 ${
                            marks[
                              member.uid
                            ]
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {marks[
                            member.uid
                          ] ? (
                            <Check
                              size={14}
                            />
                          ) : (
                            <X
                              size={14}
                            />
                          )}

                          {marks[
                            member.uid
                          ]
                            ? "Present"
                            : "Absent"}
                        </button>
                      </li>
                    )
                  )}
                </ul>
              ))}

            {/* Save */}
            {canMarkAttendance && (
              <div className="px-5 py-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={
                    saving ||
                    loadingMembers ||
                    members.length ===
                      0
                  }
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {saving
                    ? "Saving…"
                    : "Save attendance"}
                </button>

                {savedAt && (
                  <span className="text-xs text-emerald-600">
                    Attendance saved
                  </span>
                )}
              </div>
            )}
          </div>
        )}
    </div>
  );
}

function MemberView({ profile }) {
  /*
   * No orderBy here.
   * The records are sorted using the actual
   * lab date below.
   */
  const {
    data: records,
  } = useCollection(
    "attendanceRecords",
    [
      where(
        "uid",
        "==",
        profile.id
      ),
    ]
  );

  const {
    data: sessions,
  } = useCollection(
    "labSessions"
  );

  const rows = useMemo(() => {
    const sessionMap =
      Object.fromEntries(
        sessions.map(
          (session) => [
            session.id,
            session,
          ]
        )
      );

    return records
      .map((record) => ({
        ...record,
        session:
          sessionMap[
            record.sessionId
          ],
      }))
      .filter(
        (record) =>
          record.session
      )
      .sort(
        (a, b) =>
          new Date(
            b.session.date
          ) -
          new Date(
            a.session.date
          )
      );
  }, [
    records,
    sessions,
  ]);

  const presentCount =
    rows.filter(
      (record) =>
        record.present
    ).length;

  const rate = rows.length
    ? Math.round(
        (presentCount /
          rows.length) *
          100
      )
    : null;

  return (
    <div className="space-y-6">

      {/* Summary */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Overall attendance
          </p>

          <p className="text-2xl font-bold text-slate-800 mt-1">
            {rate === null
              ? "—"
              : `${rate}%`}
          </p>
        </div>

        <p className="text-sm text-slate-500">
          {presentCount} of{" "}
          {rows.length} sessions
          attended
        </p>
      </div>

      {/* History */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {rows.map(
            (record) => (
              <li
                key={
                  record.sessionId
                }
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {
                      record.session
                        .title
                    }
                  </p>

                  <p className="text-xs text-slate-400">
                    {fmtDate(
                      record.session
                        .date
                    )}
                    {" · "}
                    {getTimeSlot(
                      record.session
                    )}
                    {" · "}
                    {record.session
                      .venue ||
                      "Venue not set"}
                  </p>
                </div>

                <StatusPill
                  status={
                    record.present
                      ? "present"
                      : "absent"
                  }
                />
              </li>
            )
          )}

          {rows.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-400">
              No attendance records yet
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default function Attendance() {
  const {
    profile,
    isLeader,
    isAdmin,
  } = useAuth();

  if (!profile) return null;

  const canManageAttendance =
    isLeader || isAdmin;

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">
          Attendance
        </h2>

        <p className="text-sm text-slate-500 mt-1">
          {canManageAttendance
            ? "Mark attendance for lab sessions assigned to your group."
            : "Your lab session attendance history."}
        </p>
      </div>

      {canManageAttendance ? (
        <LeaderView
          profile={profile}
        />
      ) : (
        <MemberView
          profile={profile}
        />
      )}
    </div>
  );
}