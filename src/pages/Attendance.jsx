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


// ============================================================
// DATE / TIME
// ============================================================

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

  const [hours, minutes] =
    String(time).split(":");

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

  return date.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function getTimeSlot(session) {
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

  if (session.timeSlot) {
    return session.timeSlot;
  }

  return "Time not set";
}


// ============================================================
// RESOLVE GROUP
// ============================================================

async function resolveGroup(groupId) {
  if (!groupId) {
    throw new Error(
      "Your account is not assigned to a group."
    );
  }

  // First: groupId as document ID
  const directRef = doc(
    db,
    "groups",
    groupId
  );

  const directSnap =
    await getDoc(directRef);

  if (directSnap.exists()) {
    return {
      id: directSnap.id,
      ref: directRef,
      data: directSnap.data(),
    };
  }

  // Fallback: groupId is actually group name
  const groupQuery = query(
    collection(db, "groups"),
    where(
      "name",
      "==",
      groupId
    ),
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
    `Could not find your group "${groupId}".`
  );
}


// ============================================================
// LEADER / ADMIN VIEW
// ============================================================

function LeaderView({ profile }) {

  // ----------------------------------------------------------
  // ALL LAB SESSIONS
  // ----------------------------------------------------------

  const {
    data: allSessions,
    loading: sessionsLoading,
  } = useCollection(
    "labSessions",
    [orderBy("date", "desc")]
  );


  // ----------------------------------------------------------
  // GROUPS
  // ----------------------------------------------------------

  const {
    data: groups,
    loading: groupsLoading,
  } = useCollection("groups");


  // ----------------------------------------------------------
  // FIND CURRENT GROUP
  // ----------------------------------------------------------

  const currentGroup = useMemo(() => {
    if (!profile?.groupId) {
      return null;
    }

    return (
      groups.find(
        (group) =>
          group.id ===
            profile.groupId ||
          group.name ===
            profile.groupId
      ) || null
    );
  }, [
    groups,
    profile?.groupId,
  ]);

  const currentGroupId =
    currentGroup?.id || null;


  // ----------------------------------------------------------
  // ALL LABS FOR CURRENT GROUP
  // ----------------------------------------------------------

  const sessions = useMemo(() => {
    if (!currentGroupId) {
      return [];
    }

    return allSessions.filter(
      (session) => {

        if (
          Array.isArray(
            session.groupIds
          )
        ) {
          return session.groupIds.some(
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
        }

        return false;
      }
    );
  }, [
    allSessions,
    currentGroupId,
    profile?.groupId,
  ]);


  // ----------------------------------------------------------
  // SORT SESSIONS
  // ----------------------------------------------------------

  const sortedSessions =
    useMemo(() => {
      return [...sessions].sort(
        (a, b) => {

          if (
            a.date !== b.date
          ) {
            return a.date.localeCompare(
              b.date
            );
          }

          return (
            (a.startTime ||
              "99:99"
            ).localeCompare(
              b.startTime ||
                "99:99"
            )
          );
        }
      );
    }, [sessions]);


  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // SELECTED SESSION
  // ----------------------------------------------------------

  const selectedSession =
    useMemo(
      () =>
        sortedSessions.find(
          (session) =>
            session.id ===
            sessionId
        ),
      [
        sortedSessions,
        sessionId,
      ]
    );

  const canMarkAttendance =
    selectedSession?.status ===
    "held";


  // ----------------------------------------------------------
  // LOAD MEMBERS + EXISTING ATTENDANCE
  // ----------------------------------------------------------

  useEffect(() => {

    if (
      !sessionId ||
      !profile?.groupId ||
      !canMarkAttendance
    ) {
      setMembers([]);
      setMarks({});
      setLoadingMembers(false);
      setError("");
      return;
    }

    let cancelled = false;

    async function loadAttendance() {

      setLoadingMembers(true);
      setError("");
      setSavedAt(null);
      setMembers([]);
      setMarks({});

      try {

        // ====================================================
        // STEP 1
        // Resolve group
        // ====================================================

        const group =
          await resolveGroup(
            profile.groupId
          );

        
        if (cancelled) return;


        // ====================================================
        // STEP 2
        // LOAD MEMBERS FROM groups.members
        //
        // THIS IS THE IMPORTANT FIX.
        // ====================================================

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
              "[Attendance] Invalid member reference:",
              memberRef
            );

            continue;
          }

          try {

            const userSnap =
              await getDoc(
                memberRef
              );

            if (
              userSnap.exists()
            ) {

              roster.push({
                uid:
                  userSnap.id,
                ...userSnap.data(),
              });

            } else {

              console.warn(
                "[Attendance] User does not exist:",
                memberRef.path
              );

            }

          } catch (memberError) {

            console.error(
              "[Attendance] Failed reading:",
              memberRef.path,
              memberError
            );

            throw new Error(
              `Cannot read ${memberRef.path}: ${
                memberError?.message ||
                "permission denied"
              }`
            );
          }
        }

        // Sort alphabetically
        roster.sort(
          (a, b) =>
            String(
              a.name || ""
            ).localeCompare(
              String(
                b.name || ""
              )
            )
        );

        

        if (cancelled) return;

        setMembers(roster);


        // ====================================================
        // STEP 3
        // EXISTING ATTENDANCE
        // ====================================================

        const attendanceQuery =
          query(
            collection(
              db,
              "attendanceRecords"
            ),
            where(
              "groupId",
              "==",
              group.ref
            )
          );

        const attendanceSnapshot =
          await getDocs(
            attendanceQuery
          );

        if (cancelled) return;


        // Default everyone to absent
        const existingMarks = {};

        roster.forEach(
          (member) => {
            existingMarks[
              member.uid
            ] = false;
          }
        );


        // Apply saved marks
        attendanceSnapshot.forEach(
          (recordDoc) => {

            const data =
              recordDoc.data();

            if (
              data.sessionId ===
                sessionId &&
              data.uid
            ) {

              existingMarks[
                data.uid
              ] =
                data.present ===
                true;
            }
          }
        );

        

        if (cancelled) return;

        setMarks(
          existingMarks
        );

      } catch (err) {

        if (cancelled) return;

        console.error(
          "[Attendance] LOAD FAILED:",
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
          setLoadingMembers(
            false
          );
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


  // ----------------------------------------------------------
  // TOGGLE
  // ----------------------------------------------------------

  const toggle = (uid) => {

    if (!canMarkAttendance) {
      return;
    }

    setMarks((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };


  // ----------------------------------------------------------
  // MARK ALL PRESENT
  // ----------------------------------------------------------

  const markAllPresent = () => {

    const next = {};

    members.forEach(
      (member) => {
        next[member.uid] = true;
      }
    );

    setMarks(next);
  };


  // ----------------------------------------------------------
  // MARK ALL ABSENT
  // ----------------------------------------------------------

  const markAllAbsent = () => {

    const next = {};

    members.forEach(
      (member) => {
        next[member.uid] = false;
      }
    );

    setMarks(next);
  };


  // ----------------------------------------------------------
  // SAVE
  // ----------------------------------------------------------

  const save = async () => {

    if (
      !selectedSession ||
      !canMarkAttendance ||
      members.length === 0
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

                groupId:
                  group.ref,

                uid:
                  member.uid,

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
        "[Attendance] SAVE FAILED:",
        err
      );

      setError(
        err?.message ||
          "Unable to save attendance."
      );

    } finally {

      setSaving(false);

    }
  };


  // ----------------------------------------------------------
  // COUNT
  // ----------------------------------------------------------

  const presentCount =
    Object.values(
      marks
    ).filter(Boolean).length;


  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  const loading =
    sessionsLoading ||
    groupsLoading;

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">
          Attendance
        </h2>

        <p className="text-sm text-slate-500 mt-1">
          Manage attendance for lab sessions
          assigned to your group.
        </p>
      </div>


      {/* SESSION SELECTOR */}

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
          className="w-full sm:w-96 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                )}
                {" — "}
                {session.title}
                {session.status !==
                  "held"
                  ? ` (${session.status})`
                  : ""}
              </option>
            )
          )}

        </select>

        {!loading &&
          currentGroup &&
          sortedSessions.length ===
            0 && (
            <p className="mt-2 text-sm text-slate-400">
              No lab sessions are assigned
              to {currentGroup.name}.
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


      {/* ERROR */}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}


      {/* SELECTED SESSION */}

      {selectedSession && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

          {/* HEADER */}

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
                  {members.length}
                  {" present"}
                </span>
              )}

            </div>

          </div>


          {/* NOT HELD */}

          {!canMarkAttendance && (
            <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 text-sm text-amber-700">
              Attendance can only be marked
              after this lab is marked as{" "}
              <strong>
                held
              </strong>.
            </div>
          )}


          {/* ACTIONS */}

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


          {/* LOADING */}

          {canMarkAttendance &&
            loadingMembers && (
              <div className="p-8 flex justify-center text-slate-400">
                <Loader2
                  className="animate-spin"
                  size={20}
                />
              </div>
            )}


          {/* EMPTY */}

          {canMarkAttendance &&
            !loadingMembers &&
            members.length ===
              0 && (
              <div className="p-8 text-center">

                <p className="text-sm text-slate-500">
                  No members found in your
                  group.
                </p>

                <p className="text-xs text-slate-400 mt-1">
                  Check Admin → Groups →
                  Members.
                </p>

              </div>
            )}


          {/* MEMBERS */}

          {canMarkAttendance &&
            !loadingMembers &&
            members.length >
              0 && (
              <ul className="divide-y divide-slate-100">

                {members.map(
                  (member) => (
                    <li
                      key={
                        member.uid
                      }
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
                            ""}
                        </p>

                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          toggle(
                            member.uid
                          )
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border shrink-0 ${
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
            )}


          {/* SAVE */}

          {canMarkAttendance && (
            <div className="px-5 py-4 border-t border-slate-200 flex items-center gap-3">

              <button
                type="button"
                onClick={save}
                disabled={
                  saving ||
                  loadingMembers ||
                  members.length ===
                    0
                }
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
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


// ============================================================
// MEMBER VIEW
// ============================================================

function MemberView({ profile }) {
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


// ============================================================
// PAGE
// ============================================================

export default function Attendance() {
  const {
    profile,
    isLeader,
    isAdmin,
  } = useAuth();

  if (!profile) {
    return null;
  }

  const canManage =
    isLeader || isAdmin;

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">
          Attendance
        </h2>

        <p className="text-sm text-slate-500 mt-1">
          {canManage
            ? "Manage attendance for your group's lab sessions."
            : "Your lab session attendance history."}
        </p>
      </div>

      {canManage ? (
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