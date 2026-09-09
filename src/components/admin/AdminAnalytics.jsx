import React, { useMemo } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { UserAvatar } from '../UserAvatar';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, UsersRound, FlaskConical, CheckSquare, Loader2 } from 'lucide-react';

export function AdminAnalytics() {
  const { data: users, loading: usersLoading } = useCollection('users');
  const { data: groups, loading: groupsLoading } = useCollection('groups');
  const { data: sessions, loading: sessionsLoading } = useCollection('labSessions');
  const { data: attendance, loading: attendanceLoading } = useCollection('attendanceRecords');

  const loading = usersLoading || groupsLoading || sessionsLoading || attendanceLoading;

  const stats = useMemo(() => {
    if (!users || !groups || !sessions || !attendance) return null;

    const totalUsers = users.length;
    const totalGroups = groups.length;
    const totalSessions = sessions.length;

    const totalRecords = attendance.length;
    const presentRecords = attendance.filter(r => r.present).length;
    const overallAttendanceRate = totalRecords > 0 ? ((presentRecords / totalRecords) * 100).toFixed(1) : 0;

    return { totalUsers, totalGroups, totalSessions, overallAttendanceRate };
  }, [users, groups, sessions, attendance]);

  const roleData = useMemo(() => {
    if (!users) return [];
    const counts = { admin: 0, leader: 0, member: 0 };
    users.forEach(u => {
      if (counts[u.role] !== undefined) counts[u.role]++;
    });
    return [
      { name: 'Admin', value: counts.admin },
      { name: 'Leader', value: counts.leader },
      { name: 'Member', value: counts.member }
    ];
  }, [users]);
  
  const ROLE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6'];

  const statusData = useMemo(() => {
    if (!sessions) return [];
    const counts = { held: 0, scheduled: 0, cancelled: 0 };
    sessions.forEach(s => {
      if (counts[s.status] !== undefined) counts[s.status]++;
    });
    return [
      { name: 'Held', value: counts.held },
      { name: 'Scheduled', value: counts.scheduled },
      { name: 'Cancelled', value: counts.cancelled }
    ];
  }, [sessions]);

  const STATUS_COLORS = ['#10b981', '#3b82f6', '#ef4444'];

  const groupAttendanceData = useMemo(() => {
    if (!groups || !attendance) return [];
    return groups.map(g => {
      const gRecords = attendance.filter(r => r.groupId?.id === g.id);
      const total = gRecords.length;
      const present = gRecords.filter(r => r.present).length;
      const rate = total > 0 ? (present / total) * 100 : 0;
      return {
        name: g.name,
        rate: parseFloat(rate.toFixed(1))
      };
    });
  }, [groups, attendance]);

  const topStudents = useMemo(() => {
    if (!users || !groups || !attendance) return [];
    const members = users.filter(u => u.role === 'member' || u.role === 'leader');
    const studentStats = members.map(u => {
      const uRecords = attendance.filter(r => r.uid === u.id);
      const total = uRecords.length;
      const present = uRecords.filter(r => r.present).length;
      const rate = total > 0 ? (present / total) * 100 : 0;
      
      const groupIdStr = u.groupId?.id || u.groupId;
      const userGroup = groups.find(g => g.id === groupIdStr);
      
      return {
        ...u,
        groupName: userGroup ? userGroup.name : 'Unassigned',
        attendanceRate: rate
      };
    });

    return studentStats.sort((a, b) => b.attendanceRate - a.attendanceRate).slice(0, 20);
  }, [users, groups, attendance]);

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
        <p className="text-sm font-medium">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex items-center">
          <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="ml-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Users</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalUsers}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex items-center">
          <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <UsersRound className="w-6 h-6" />
          </div>
          <div className="ml-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Groups</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalGroups}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex items-center">
          <div className="w-12 h-12 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div className="ml-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lab Sessions</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalSessions}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex items-center">
          <div className="w-12 h-12 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div className="ml-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Avg Attendance</p>
            <p className="text-2xl font-bold text-slate-900">{stats.overallAttendanceRate}%</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">User Roles</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label
                >
                  {roleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={ROLE_COLORS[index % ROLE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Session Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bar Chart Full Width */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Attendance Rate by Group</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={groupAttendanceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => [`${value}%`, 'Attendance Rate']} />
              <Bar dataKey="rate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Students Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 overflow-hidden">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Student Attendance Overview</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Reg No</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Group</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Attendance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {topStudents.map((student) => (
                <tr key={student.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <UserAvatar photoURL={student.photoURL} name={student.name} size="sm" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-slate-900">{student.name}</p>
                        <p className="text-xs text-slate-500">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                    {student.regNo || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                    {student.groupName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap w-48">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700 w-12">{student.attendanceRate.toFixed(1)}%</span>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${student.attendanceRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {topStudents.length === 0 && (
            <div className="text-center py-6 text-sm text-slate-500">
              No student data available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
