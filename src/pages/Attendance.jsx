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

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { StatusPill } from "../components/StatusPill";
import { UserAvatar } from "../components/UserAvatar";

  Check,
  X,
  Loader2,
  Search,
} from "lucide-react";


// ============================================================
// DATE / TIME HELPERS
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

  const [hours, minutes] = String(time).split(":");

  if (hours === undefined || minutes === undefined) {
    return String(time);
  }

  const date = new Date();

  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTimeSlot(session) {
  if (session.startTime && session.endTime) {
    return `${fmtTime(session.startTime)} – ${fmtTime(session.endTime)}`;
  }

  if (session.timeSlot) {
    return session.timeSlot;
  }

  return "Time not set";
}


// ============================================================
// GROUP RESOLUTION
// ============================================================

async function resolveGroup(groupId) {
  if (!groupId) {
    throw new Error("Your account is not assigned to a group.");
  }

  const directRef = doc(db, "groups", groupId);
  const directSnap = await getDoc(directRef);

  if (directSnap.exists()) {
    return {
      id: directSnap.id,
      ref: directRef,
      data: directSnap.data(),
    };
  }

  const groupQuery = query(
    collection(db, "groups"),
    where("name", "==", groupId),
    limit(1)
  );

  const groupSnapshot = await getDocs(groupQuery);

  if (!groupSnapshot.empty) {
    const snap = groupSnapshot.docs[0];

    return {
      id: snap.id,
      ref: snap.ref,
      data: snap.data(),
    };
  }

  throw new Error(`Could not find your group "${groupId}".`);
}


// ============================================================
// PIE CHART COLORS
// ============================================================

const PIE_COLORS = {
  present: "#10b981",
  absent: "#ef4444",
};


// ============================================================
// MINI ATTENDANCE PIE (reusable)
// ============================================================

function AttendancePie({ present, absent, size = 160 }) {
  const data = [
    { name: "Present", value: present },
    { name: "Absent", value: absent },
  ];

  const total = present + absent;

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  const rate = Math.round((present / total) * 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.3}
            outerRadius={size * 0.45}
            dataKey="value"
            strokeWidth={2}
            stroke="#fff"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={PIE_COLORS[entry.name.toLowerCase()]}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-800">
          {rate}%
        </span>
        <span className="text-[10px] text-slate-400 uppercase tracking-wide">
          Present
        </span>
      </div>
    </div>
  );
}


// ============================================================
// REFERENCE HELPERS
// ============================================================

/**
 * Extract a plain string ID from a value that could be:
 *   - A Firestore DocumentReference (has .id and .path)
 *   - A plain string ID
 *   - null / undefined
 */
function refToId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value?.id) return value.id;
  return String(value);
}

/**
 * Check if a groupIds array (which may contain refs or strings)
 * includes a given group ID string.
 */
function groupIdsInclude(groupIds, targetGroupId) {
  if (!Array.isArray(groupIds) || !targetGroupId) return false;

  return groupIds.some(
    (entry) => refToId(entry) === targetGroupId
  );
}


// ============================================================
// ADMIN VIEW
// ============================================================

function AdminView() {
  // ----------------------------------------------------------
  // Data
  // ----------------------------------------------------------

  const { data: allSessions, loading: sessionsLoading } =
    useCollection("labSessions", [orderBy("date", "desc")]);

  const { data: groups, loading: groupsLoading } =
    useCollection("groups");

  const { data: allUsers, loading: usersLoading } =
    useCollection("users");

  const { data: allRecords, loading: recordsLoading } =
    useCollection("attendanceRecords");

  const loading =
    sessionsLoading || groupsLoading || usersLoading || recordsLoading;


  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------

  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");


  // ----------------------------------------------------------
  // Per-group attendance stats
  // ----------------------------------------------------------

  const groupStats = useMemo(() => {
    return groups.map((group) => {
      const groupRecords = allRecords.filter(
        (record) => refToId(record.groupId) === group.id
      );

      const present = groupRecords.filter(
        (record) => record.present === true
      ).length;

      const total = groupRecords.length;

      const rate = total > 0
        ? Math.round((present / total) * 100)
        : 0;

      return {
        id: group.id,
        name: group.name || group.id,
        present,
        absent: total - present,
        total,
        rate,
        memberCount: Array.isArray(group.members)
          ? group.members.length
          : 0,
      };
    });
  }, [groups, allRecords]);


  // ----------------------------------------------------------
  // Selected group data
  // ----------------------------------------------------------

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return groupStats.find((g) => g.id === selectedGroupId) || null;
  }, [groupStats, selectedGroupId]);


  // ----------------------------------------------------------
  // Per-student stats for selected group
  // ----------------------------------------------------------

  const studentStats = useMemo(() => {
    if (!selectedGroupId) return [];

    const group = groups.find((g) => g.id === selectedGroupId);
    if (!group) return [];

    const memberUids = new Set(
      (group.members || []).map((ref) => refToId(ref)).filter(Boolean)
    );

    const groupRecords = allRecords.filter(
      (record) => refToId(record.groupId) === selectedGroupId
    );

    const heldSessions = allSessions.filter((session) => {
      if (session.status !== "held") return false;

      return groupIdsInclude(session.groupIds, selectedGroupId);
    });

    const totalSessions = heldSessions.length;

    const students = allUsers
      .filter(
        (user) =>
          memberUids.has(user.id)
      )
      .map((user) => {
        const userRecords = groupRecords.filter(
          (record) => record.uid === user.id
        );

        const present = userRecords.filter(
          (record) => record.present === true
        ).length;

        const rate = totalSessions > 0
          ? Math.round((present / totalSessions) * 100)
          : 0;

        return {
          uid: user.id,
          name: user.name || "Unnamed",
          email: user.email || "",
          regNo: user.regNo || "",
          photoURL: user.photoURL || "",
          present,
          totalSessions,
          rate,
        };
      })
      .sort((a, b) => b.rate - a.rate);

    return students;
  }, [selectedGroupId, groups, allRecords, allSessions, allUsers]);


  // ----------------------------------------------------------
  // Per-session stats for selected group
  // ----------------------------------------------------------

  const sessionStats = useMemo(() => {
    if (!selectedGroupId) return [];

    const groupSessions = allSessions.filter((session) => {
      return groupIdsInclude(session.groupIds, selectedGroupId);
    });

    return groupSessions
      .map((session) => {
        const sessionRecords = allRecords.filter(
          (record) =>
            record.sessionId === session.id &&
            refToId(record.groupId) === selectedGroupId
        );

        const present = sessionRecords.filter(
          (record) => record.present === true
        ).length;

        const total = sessionRecords.length;

        return {
          id: session.id,
          title: session.title || "Untitled",
          labNumber: session.labNumber || null,
          date: session.date,
          status: session.status,
          present,
          absent: total - present,
          total,
          rate: total > 0
            ? Math.round((present / total) * 100)
            : 0,
        };
      })
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date?.localeCompare(b.date) || 0;
        }
        return 0;
      });
  }, [selectedGroupId, allSessions, allRecords]);


  // ----------------------------------------------------------
  // Filtered students
  // ----------------------------------------------------------

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return studentStats;

    const q = searchQuery.toLowerCase();

    return studentStats.filter(
      (student) =>
        student.name.toLowerCase().includes(q) ||
        student.regNo.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q)
    );
  }, [studentStats, searchQuery]);


  // ----------------------------------------------------------
  // Bar chart data
  // ----------------------------------------------------------

  const barData = useMemo(() => {
    return groupStats.map((group) => ({
      name: group.name,
      rate: group.rate,
    }));
  }, [groupStats]);


  // ----------------------------------------------------------
  // Per-lab-title attendance (aggregated across all groups)
  // ----------------------------------------------------------

  const labTitleStats = useMemo(() => {
    // Group sessions by labNumber (preferred) or title
    const buckets = {};

    allSessions.forEach((session) => {
      const key = session.labNumber
        ? `Lab ${session.labNumber}`
        : session.title || "Untitled";

      if (!buckets[key]) {
        buckets[key] = {
          key,
          labNumber: session.labNumber || null,
          title: session.title || "Untitled",
          sessionIds: [],
          groupCount: 0,
        };
      }

      buckets[key].sessionIds.push(session.id);
      // Count unique groups across sessions with same lab title
      const gCount = Array.isArray(session.groupIds)
        ? session.groupIds.length
        : 0;
      buckets[key].groupCount += gCount;
    });

    return Object.values(buckets)
      .map((bucket) => {
        const bucketRecords = allRecords.filter((record) =>
          bucket.sessionIds.includes(record.sessionId)
        );

        const present = bucketRecords.filter(
          (record) => record.present === true
        ).length;

        const total = bucketRecords.length;

        return {
          ...bucket,
          present,
          absent: total - present,
          total,
          rate: total > 0
            ? Math.round((present / total) * 100)
            : 0,
        };
      })
      .sort((a, b) => {
        if (a.labNumber && b.labNumber) {
          return a.labNumber - b.labNumber;
        }
        return a.key.localeCompare(b.key);
      });
  }, [allSessions, allRecords]);


  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-slate-400">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Overall Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {groupStats.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() =>
              setSelectedGroupId(
                selectedGroupId === group.id ? "" : group.id
              )
            }
            className={`bg-white border rounded-xl shadow-sm p-4 text-left transition-all hover:shadow-md ${
              selectedGroupId === group.id
                ? "border-blue-400 ring-2 ring-blue-100"
                : "border-slate-200"
            }`}
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {group.name}
            </p>

            <p className="text-2xl font-bold text-slate-800 mt-1">
              {group.rate}%
            </p>

            <p className="text-xs text-slate-400 mt-1">
              {group.present}/{group.total} present ·{" "}
              {group.memberCount} members
            </p>
          </button>
        ))}
      </div>


      {/* Attendance by Group Bar Chart */}
      {barData.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Attendance Rate by Group
          </h3>

          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, "Attendance"]}
              />
              <Bar
                dataKey="rate"
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
                maxBarSize={60}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}


      {/* Absent by Lab Title (across all groups) */}
      {labTitleStats.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">
              Attendance by Lab (All Groups Combined)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Same lab scheduled across different groups is aggregated here.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Lab
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Title
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">
                    Groups
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">
                    Present
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">
                    Absent
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">
                    Total
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Rate
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {labTitleStats.map((lab) => (
                  <tr key={lab.key}>
                    <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                      {lab.key}
                    </td>
                    <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">
                      {lab.title}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-center">
                      {lab.groupCount}
                    </td>
                    <td className="px-4 py-3 text-emerald-600 font-medium text-center">
                      {lab.present}
                    </td>
                    <td className="px-4 py-3 text-red-600 font-medium text-center">
                      {lab.absent}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-center">
                      {lab.total}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              lab.rate >= 75
                                ? "bg-emerald-500"
                                : lab.rate >= 50
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${lab.rate}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {lab.rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Selected Group Detail */}
      {selectedGroup && (
        <div className="space-y-6">

          {/* Group Summary Header */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">

              <AttendancePie
                present={selectedGroup.present}
                absent={selectedGroup.absent}
                size={140}
              />

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800">
                  {selectedGroup.name}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div>
                    <p className="text-xs text-slate-400">Members</p>
                    <p className="text-lg font-bold text-slate-700">
                      {selectedGroup.memberCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Present</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {selectedGroup.present}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Absent</p>
                    <p className="text-lg font-bold text-red-500">
                      {selectedGroup.absent}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Rate</p>
                    <p className="text-lg font-bold text-slate-700">
                      {selectedGroup.rate}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Per-Session Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">
                Session Breakdown
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Session
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Present
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Rate
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {sessionStats.map((session) => (
                    <tr key={session.id}>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {session.labNumber
                          ? `Lab ${session.labNumber} — `
                          : ""}
                        {session.title}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {fmtDate(session.date)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={session.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {session.present}/{session.total}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{
                                width: `${session.rate}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">
                            {session.rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {sessionStats.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        No sessions found for this group
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>


          {/* Per-Student Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Student Attendance
              </h3>

              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                  placeholder="Search students..."
                  className="w-full sm:w-64 pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Student
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Reg No
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Attended
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Rate
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => (
                    <tr key={student.uid}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            photoURL={student.photoURL}
                            name={student.name}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">
                              {student.name}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {student.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {student.regNo || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {student.present}/{student.totalSessions}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                student.rate >= 75
                                  ? "bg-emerald-500"
                                  : student.rate >= 50
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              }`}
                              style={{
                                width: `${student.rate}%`,
                              }}
                            />
                          </div>
                          <span
                            className={`text-xs font-medium ${
                              student.rate >= 75
                                ? "text-emerald-600"
                                : student.rate >= 50
                                ? "text-amber-600"
                                : "text-red-600"
                            }`}
                          >
                            {student.rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredStudents.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        {searchQuery
                          ? `No students match "${searchQuery}"`
                          : "No students in this group"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Prompt to select a group */}
      {!selectedGroup && groups.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <p className="text-sm text-slate-500">
            Select a group above to view detailed attendance analytics.
          </p>
        </div>
      )}
    </div>
  );
}


// ============================================================
// LEADER VIEW
// ============================================================

function LeaderView({ profile, isAdmin = false }) {
  // ----------------------------------------------------------
  // Data
  // ----------------------------------------------------------

  const { data: allSessions, loading: sessionsLoading } =
    useCollection("labSessions", [orderBy("date", "desc")]);

  const { data: groups, loading: groupsLoading } =
    useCollection("groups");


  // ----------------------------------------------------------
  // Admin group selector state
  // ----------------------------------------------------------

  const [adminSelectedGroupId, setAdminSelectedGroupId] = useState("");


  // ----------------------------------------------------------
  // Current group (admin can pick any group, leaders use their own)
  // ----------------------------------------------------------

  const ownGroup = useMemo(() => {
    if (!profile?.groupId) return null;

    return (
      groups.find(
        (group) =>
          group.id === profile.groupId ||
          group.name === profile.groupId
      ) || null
    );
  }, [groups, profile?.groupId]);

  // For admins: use the selected group, fallback to their own
  const activeGroupId = useMemo(() => {
    if (isAdmin && adminSelectedGroupId) {
      return adminSelectedGroupId;
    }
    return ownGroup?.id || null;
  }, [isAdmin, adminSelectedGroupId, ownGroup]);

  const currentGroup = useMemo(() => {
    if (!activeGroupId) return null;
    return groups.find((g) => g.id === activeGroupId) || null;
  }, [groups, activeGroupId]);

  const currentGroupId = currentGroup?.id || null;


  // ----------------------------------------------------------
  // Group attendance records (real-time via onSnapshot)
  // ----------------------------------------------------------

  const { data: allAttendanceRecords } = useCollection(
    "attendanceRecords"
  );

  const groupAttendanceRecords = useMemo(() => {
    if (!currentGroupId) return [];
    return allAttendanceRecords.filter(
      (record) => refToId(record.groupId) === currentGroupId
    );
  }, [allAttendanceRecords, currentGroupId]);

  // ----------------------------------------------------------
  // Group attendance summary
  // ----------------------------------------------------------

  const groupSummary = useMemo(() => {
    const present = groupAttendanceRecords.filter(
      (record) => record.present === true
    ).length;

    const total = groupAttendanceRecords.length;

    return {
      present,
      absent: total - present,
      total,
      rate: total > 0
        ? Math.round((present / total) * 100)
        : 0,
    };
  }, [groupAttendanceRecords]);


  // ----------------------------------------------------------
  // Sessions for this group
  // ----------------------------------------------------------

  const sessions = useMemo(() => {
    if (!currentGroupId) return [];

    return allSessions.filter((session) => {
      return groupIdsInclude(session.groupIds, currentGroupId);
    });
  }, [allSessions, currentGroupId]);


  // ----------------------------------------------------------
  // Sort sessions
  // ----------------------------------------------------------

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (a.labNumber && b.labNumber && a.labNumber !== b.labNumber) {
        return a.labNumber - b.labNumber;
      }

      if (a.date !== b.date) {
        return a.date?.localeCompare(b.date) || 0;
      }

      return (a.startTime || "99:99").localeCompare(
        b.startTime || "99:99"
      );
    });
  }, [sessions]);


  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------

  const [sessionId, setSessionId] = useState("");
  const [members, setMembers] = useState([]);
  const [marks, setMarks] = useState({});
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");


  // ----------------------------------------------------------
  // Selected session
  // ----------------------------------------------------------

  const selectedSession = useMemo(
    () =>
      sortedSessions.find(
        (session) => session.id === sessionId
      ),
    [sortedSessions, sessionId]
  );

  const canMarkAttendance =
    selectedSession?.status === "held";


  // ----------------------------------------------------------
  // Clear invalid session
  // ----------------------------------------------------------

  useEffect(() => {
    if (
      sessionId &&
      !sortedSessions.some(
        (session) => session.id === sessionId
      )
    ) {
      setSessionId("");
      setMembers([]);
      setMarks({});
      setError("");
    }
  }, [sortedSessions, sessionId]);


  // ----------------------------------------------------------
  // Load roster + existing attendance
  // ----------------------------------------------------------

  useEffect(() => {
    if (
      !sessionId ||
      !currentGroupId ||
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
        const group = await resolveGroup(
          currentGroupId
        );

        if (cancelled) return;

        const memberRefs = Array.isArray(
          group.data.members
        )
          ? group.data.members
          : [];

        const roster = [];

        for (const memberRef of memberRefs) {
          if (cancelled) return;

          if (!memberRef?.path) {
            continue;
          }

          const userSnap = await getDoc(memberRef);

          if (userSnap.exists()) {
            roster.push({
              uid: userSnap.id,
              ...userSnap.data(),
            });
          }
        }

        roster.sort((a, b) =>
          String(a.name || "").localeCompare(
            String(b.name || "")
          )
        );

        if (cancelled) return;
        setMembers(roster);

        // Load existing records from our previously fetched groupAttendanceRecords
        const existingMarks = {};

        roster.forEach((member) => {
          existingMarks[member.uid] = false;
        });

        groupAttendanceRecords.forEach((record) => {
          if (
            record.sessionId === sessionId &&
            record.uid
          ) {
            existingMarks[record.uid] =
              record.present === true;
          }
        });

        if (cancelled) return;
        setMarks(existingMarks);
      } catch (err) {
        if (cancelled) return;

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
  }, [sessionId, currentGroupId, canMarkAttendance, groupAttendanceRecords]);


  // ----------------------------------------------------------
  // Toggle / Mark all
  // ----------------------------------------------------------

  const toggle = (uid) => {
    if (!canMarkAttendance) return;

    setMarks((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  const markAllPresent = () => {
    const next = {};
    members.forEach((member) => {
      next[member.uid] = true;
    });
    setMarks(next);
  };

  const markAllAbsent = () => {
    const next = {};
    members.forEach((member) => {
      next[member.uid] = false;
    });
    setMarks(next);
  };


  // ----------------------------------------------------------
  // Save
  // ----------------------------------------------------------

  const save = async () => {
    if (
      !sessionId ||
      !currentGroupId ||
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
      const group = await resolveGroup(
        currentGroupId
      );

      await Promise.all(
        members.map((member) =>
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
              name: member.name || "",
              present: !!marks[member.uid],
              markedBy: profile.id,
              markedAt: serverTimestamp(),
            }
          )
        )
      );

      setSavedAt(new Date());
    } catch (err) {
      setError(
        err?.message ||
          "Unable to save attendance."
      );
    } finally {
      setSaving(false);
    }
  };


  // ----------------------------------------------------------
  // Count + search
  // ----------------------------------------------------------

  const presentCount = Object.values(marks).filter(
    Boolean
  ).length;

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;

    const q = searchQuery.toLowerCase();

    return members.filter(
      (member) =>
        (member.name || "")
          .toLowerCase()
          .includes(q) ||
        (member.regNo || "")
          .toLowerCase()
          .includes(q) ||
        (member.email || "")
          .toLowerCase()
          .includes(q)
    );
  }, [members, searchQuery]);


  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  const isLoading = sessionsLoading || groupsLoading;

  return (
    <div className="space-y-6">

      {/* Admin Group Selector */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Select Group
          </label>

          <select
            value={adminSelectedGroupId}
            onChange={(e) => {
              setAdminSelectedGroupId(e.target.value);
              setSessionId("");
              setMembers([]);
              setMarks({});
              setError("");
              setSearchQuery("");
            }}
            disabled={groupsLoading}
            className="w-full sm:w-72 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          >
            <option value="">
              {ownGroup
                ? `${ownGroup.name || ownGroup.id} (Your group)`
                : "Select a group…"}
            </option>

            {groups
              .filter((g) => g.id !== ownGroup?.id)
              .map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name || group.id}
                </option>
              ))}
          </select>

          <p className="text-xs text-slate-400 mt-2">
            You can mark attendance for any group as an administrator.
          </p>
        </div>
      )}

      {/* Group Summary with Pie Chart */}
      {currentGroup && groupSummary.total > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <AttendancePie
              present={groupSummary.present}
              absent={groupSummary.absent}
              size={130}
            />

            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-700">
                {currentGroup.name || currentGroup.id} — Overall
              </h3>

              <div className="grid grid-cols-3 gap-3 mt-3">
                <div>
                  <p className="text-xs text-slate-400">Present</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {groupSummary.present}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Absent</p>
                  <p className="text-lg font-bold text-red-500">
                    {groupSummary.absent}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Rate</p>
                  <p className="text-lg font-bold text-slate-700">
                    {groupSummary.rate}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Session Selector */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Lab session
        </label>

        <select
          value={sessionId}
          onChange={(e) => {
            setSessionId(e.target.value);
            setError("");
            setSearchQuery("");
          }}
          disabled={isLoading || !currentGroupId}
          className="w-full sm:w-96 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
        >
          <option value="">
            {isLoading
              ? "Loading sessions…"
              : !currentGroupId
              ? "Select a group first…"
              : "Select a session…"}
          </option>

          {sortedSessions.map((session) => (
            <option
              key={session.id}
              value={session.id}
              disabled={session.status !== "held"}
            >
              {session.labNumber
                ? `Lab ${session.labNumber} — `
                : ""}
              {fmtDate(session.date)}{" "}
              — {session.title}
              {session.status !== "held"
                ? ` (${session.status})`
                : ""}
            </option>
          ))}
        </select>

        {!isLoading &&
          !isAdmin &&
          !profile?.groupId && (
            <p className="mt-2 text-sm text-amber-600">
              Your account is not assigned to a group.
            </p>
          )}

        {!isLoading &&
          currentGroup &&
          sortedSessions.length === 0 && (
            <p className="mt-2 text-sm text-slate-400">
              No lab sessions are assigned to{" "}
              {currentGroup.name || currentGroup.id}.
            </p>
          )}

        {!isLoading &&
          sortedSessions.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Only labs marked as held can have
              attendance recorded.
            </p>
          )}
      </div>


      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}


      {/* Selected Session */}
      {sessionId && selectedSession && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800">
                    {selectedSession.title}
                  </p>
                  <StatusPill
                    status={selectedSession.status}
                  />
                </div>

                <p className="text-xs text-slate-400 mt-1">
                  {fmtDate(selectedSession.date)}
                  {" · "}
                  {getTimeSlot(selectedSession)}
                  {" · "}
                  {selectedSession.venue ||
                    "Venue not set"}
                </p>
              </div>

              {canMarkAttendance && (
                <span className="text-sm text-slate-500">
                  {presentCount}/{members.length}{" "}
                  present
                </span>
              )}
            </div>
          </div>


          {/* Not held */}
          {!canMarkAttendance && (
            <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 text-sm text-amber-700">
              Attendance can only be marked after
              this lab is marked as{" "}
              <strong>held</strong>.
            </div>
          )}


          {/* Actions */}
          {canMarkAttendance && (
            <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={markAllPresent}
                disabled={
                  loadingMembers ||
                  members.length === 0
                }
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
              >
                Mark all present
              </button>

              <button
                type="button"
                onClick={markAllAbsent}
                disabled={
                  loadingMembers ||
                  members.length === 0
                }
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
              >
                Mark all absent
              </button>

              {/* Search */}
              {members.length > 0 && (
                <div className="relative ml-auto">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(
                        e.target.value
                      )
                    }
                    placeholder="Search..."
                    className="w-48 pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}


          {/* Loading */}
          {canMarkAttendance &&
            loadingMembers && (
              <div className="p-8 flex justify-center text-slate-400">
                <Loader2
                  className="animate-spin"
                  size={20}
                />
              </div>
            )}


          {/* Empty */}
          {canMarkAttendance &&
            !loadingMembers &&
            members.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">
                  No members found in your group.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Check the group's Members list in
                  the Admin Panel.
                </p>
              </div>
            )}


          {/* Roster */}
          {canMarkAttendance &&
            !loadingMembers &&
            members.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {filteredMembers.map((member) => (
                  <li
                    key={member.uid}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        photoURL={
                          member.photoURL
                        }
                        name={member.name}
                        size="sm"
                      />

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
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        toggle(member.uid)
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors shrink-0 ${
                        marks[member.uid]
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      {marks[member.uid] ? (
                        <Check size={14} />
                      ) : (
                        <X size={14} />
                      )}
                      {marks[member.uid]
                        ? "Present"
                        : "Absent"}
                    </button>
                  </li>
                ))}

                {filteredMembers.length === 0 &&
                  searchQuery && (
                    <li className="px-5 py-6 text-center text-sm text-slate-400">
                      No members match "
                      {searchQuery}"
                    </li>
                  )}
              </ul>
            )}


          {/* Save */}
          {canMarkAttendance && (
            <div className="px-5 py-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={
                  saving ||
                  loadingMembers ||
                  members.length === 0
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


// ============================================================
// MEMBER VIEW
// ============================================================

function MemberView({ profile }) {
  const { data: records } = useCollection(
    "attendanceRecords",
    [where("uid", "==", profile.id)]
  );

  const { data: sessions } =
    useCollection("labSessions");

  const rows = useMemo(() => {
    const sessionMap = Object.fromEntries(
      sessions.map((session) => [
        session.id,
        session,
      ])
    );

    return records
      .map((record) => ({
        ...record,
        session: sessionMap[record.sessionId],
      }))
      .filter((record) => record.session)
      .sort(
        (a, b) =>
          new Date(b.session.date) -
          new Date(a.session.date)
      );
  }, [records, sessions]);

  const presentCount = rows.filter(
    (record) => record.present
  ).length;

  const rate = rows.length
    ? Math.round(
        (presentCount / rows.length) * 100
      )
    : null;

  return (
    <div className="space-y-6">

      {/* Summary with Pie Chart */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <AttendancePie
            present={presentCount}
            absent={rows.length - presentCount}
            size={130}
          />

          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Overall Attendance
            </p>

            <p className="text-3xl font-bold text-slate-800 mt-1">
              {rate === null ? "—" : `${rate}%`}
            </p>

            <p className="text-sm text-slate-500 mt-1">
              {presentCount} of {rows.length}{" "}
              sessions attended
            </p>
          </div>
        </div>
      </div>


      {/* History */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {rows.map((record) => (
            <li
              key={record.id}
              className="flex items-center justify-between gap-4 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {record.session.labNumber
                    ? `Lab ${record.session.labNumber} — `
                    : ""}
                  {record.session.title}
                </p>

                <p className="text-xs text-slate-400">
                  {fmtDate(record.session.date)}
                  {" · "}
                  {getTimeSlot(record.session)}
                  {" · "}
                  {record.session.venue ||
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


// ============================================================
// MAIN PAGE
// ============================================================

export default function Attendance() {
  const { profile, isLeader, isAdmin } =
    useAuth();

  const [adminTab, setAdminTab] = useState("analytics");

  if (!profile) {
    return null;
  }

  const subtitle = isAdmin
    ? "Analytics, attendance marking, and your personal history."
    : isLeader
    ? "Manage attendance for your group's lab sessions."
    : "Your lab session attendance history.";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">
          Attendance
        </h2>

        <p className="text-sm text-slate-500 mt-1">
          {subtitle}
        </p>
      </div>

      {isAdmin ? (
        <>
          {/* Admin tab switcher */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            {[
              { key: "analytics", label: "Analytics" },
              { key: "mark", label: "Mark Attendance" },
              { key: "my", label: "My Attendance" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setAdminTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  adminTab === tab.key
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {adminTab === "analytics" && <AdminView />}
          {adminTab === "mark" && (
            <LeaderView profile={profile} isAdmin={true} />
          )}
          {adminTab === "my" && (
            <MemberView profile={profile} />
          )}
        </>
      ) : isLeader ? (
        <LeaderView profile={profile} />
      ) : (
        <MemberView profile={profile} />
      )}
    </div>
  );
}