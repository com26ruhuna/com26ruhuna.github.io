// src/pages/Attendance.jsx
//
// Leaders: pick a lab session for their own group, tick who showed up,
// save. Writes one doc per member to `attendanceRecords`, id'd
// `${sessionId}_${uid}` so re-opening a session loads existing marks
// and re-saving overwrites rather than duplicating.
//
// Members: read-only history of their own attendance.

import { useEffect, useMemo, useState } from "react";
import { where, orderBy, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { StatusPill } from "../components/StatusPill";
import { Check, X, Loader2 } from "lucide-react";

function fmtDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function LeaderView({ profile }) {
  const { data: allSessions } = useCollection("labSessions", [
    orderBy("date", "desc"),
  ]);

  const sessions = allSessions.filter(
    (s) =>
      s.status === "held" &&
      Array.isArray(s.groupIds) &&
      s.groupIds.some(
        (groupRef) => groupRef.id === profile.groupId
      )
  );
  const [sessionId, setSessionId] = useState("");
  const [members, setMembers] = useState([]);
  const [marks, setMarks] = useState({}); // uid -> boolean
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const selectedSession = sessions.find((s) => s.id === sessionId);

  // Load group roster + any existing marks for this session.
  useEffect(() => {
  if (!sessionId) return;
  setLoadingMembers(true);
  setSavedAt(null);

  (async () => {
    const groupSnap = await getDoc(doc(db, "groups", profile.groupId));

    const memberRefs = groupSnap.exists()
      ? groupSnap.data().members || []
      : [];

    const roster = await Promise.all(
      memberRefs.map(async (memberRef) => {
        const userSnap = await getDoc(memberRef);

        if (!userSnap.exists()) {
          return null;
        }

        return {
          uid: userSnap.id,
          ...userSnap.data(),
        };
      })
    );

    setMembers(roster.filter(Boolean));

    const existing = {};
    await Promise.all(
      roster.filter(Boolean).map(async (m) => {
        const recSnap = await getDoc(
          doc(db, "attendanceRecords", `${sessionId}_${m.uid}`)
        );
        existing[m.uid] = recSnap.exists()
          ? recSnap.data().present
          : false;
      })
    );

    setMarks(existing);
    setLoadingMembers(false);
  })();
}, [sessionId, profile.groupId]);

  const toggle = (uid) => setMarks((prev) => ({ ...prev, [uid]: !prev[uid] }));

  const save = async () => {
    setSaving(true);
    await Promise.all(
      members.map((m) =>
        setDoc(doc(db, "attendanceRecords", `${sessionId}_${m.uid}`), {
          sessionId,
          groupId: doc(db, "groups", profile.groupId),
          uid: m.uid,
          name: m.name,
          present: !!marks[m.uid],
          markedBy: profile.id,
          markedAt: serverTimestamp(),
        })
      )
    );
    setSaving(false);
    setSavedAt(new Date());
  };

  const presentCount = Object.values(marks).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Lab session
        </label>
        <select
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="w-full sm:w-96 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a session…</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {fmtDate(s.date)} — {s.title}
            </option>
          ))}
        </select>
      </div>

      {sessionId && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800">{selectedSession?.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {fmtDate(selectedSession?.date)} · {selectedSession?.timeSlot} ·{" "}
                {selectedSession?.venue}
              </p>
            </div>
            <span className="text-sm text-slate-500">
              {presentCount}/{members.length} present
            </span>
          </div>

          {loadingMembers ? (
            <div className="p-8 flex justify-center text-slate-400">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {members.map((m) => (
                <li key={m.uid} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.regNo}</p>
                  </div>
                  <button
                    onClick={() => toggle(m.uid)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      marks[m.uid]
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {marks[m.uid] ? <Check size={14} /> : <X size={14} />}
                    {marks[m.uid] ? "Present" : "Absent"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="px-5 py-4 border-t border-slate-200 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || loadingMembers}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? "Saving…" : "Save attendance"}
            </button>
            {savedAt && <span className="text-xs text-emerald-600">Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberView({ profile }) {
  const { data: records } = useCollection("attendanceRecords", [
    where("uid", "==", profile.id),
    orderBy("sessionId", "desc"),
  ]);
  const { data: sessions } = useCollection("labSessions");

  const rows = useMemo(() => {
    const sessionMap = Object.fromEntries(sessions.map((s) => [s.id, s]));
    return records
      .map((r) => ({ ...r, session: sessionMap[r.sessionId] }))
      .filter((r) => r.session)
      .sort((a, b) => new Date(b.session.date) - new Date(a.session.date));
  }, [records, sessions]);

  const presentCount = rows.filter((r) => r.present).length;
  const rate = rows.length ? Math.round((presentCount / rows.length) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Overall attendance
          </p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {rate === null ? "—" : `${rate}%`}
          </p>
        </div>
        <p className="text-sm text-slate-500">
          {presentCount} of {rows.length} sessions attended
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.sessionId} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">{r.session.title}</p>
                <p className="text-xs text-slate-400">
                  {fmtDate(r.session.date)} · {r.session.venue}
                </p>
              </div>
              <StatusPill status={r.present ? "present" : "absent"} />
            </li>
          ))}
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
  const { profile, isLeader, isAdmin } = useAuth();
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">Attendance</h2>
        <p className="text-sm text-slate-500 mt-1">
          {isLeader || isAdmin
  ? "Mark attendance for your group's lab sessions."
  : "Your lab session attendance history."}
        </p>
      </div>
      {isLeader || isAdmin ? (
        <LeaderView profile={profile} />
      ) : (
        <MemberView profile={profile} />
      )}
    </div>
  );
}
