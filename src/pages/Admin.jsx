// src/pages/Admin.jsx

import { useState } from "react";

import {
  Users,
  UserPlus,
  UsersRound,
  FlaskConical,
  CalendarDays,
  ClipboardList,
  BarChart3,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useFirestore";
import { ResourceManager } from "../components/admin/ResourceManager";
import { SignupRequests } from "../components/admin/SignupRequests";
import { AdminAnalytics } from "../components/admin/AdminAnalytics";
import { BulkLabCreator } from "../components/admin/BulkLabCreator";

const TABS = [
  {
    key: "signups",
    label: "Signups",
    icon: UserPlus,
  },
  {
    key: "users",
    label: "Users",
    icon: Users,
  },
  {
    key: "groups",
    label: "Groups",
    icon: UsersRound,
  },
  {
    key: "labs",
    label: "Lab Sessions",
    icon: FlaskConical,
  },
  {
    key: "lectures",
    label: "Lectures",
    icon: CalendarDays,
  },
  {
    key: "assessments",
    label: "Assessments",
    icon: ClipboardList,
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: BarChart3,
  },
];

export default function Admin() {
  const { isAdmin } = useAuth();

  const [tab, setTab] =
    useState("signups");

  const {
    data: pendingSignups,
  } = useCollection(
    "signupRequests"
  );

  if (!isAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
        <p className="text-slate-600 font-medium">
          Admins only
        </p>

        <p className="text-sm text-slate-400 mt-1">
          You don't have permission to view
          this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">
          Admin Panel
        </h2>

        <p className="text-sm text-slate-500 mt-1">
          Manage users, groups, and all three
          schedules.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {TABS.map((tabItem) => {
          const Icon =
            tabItem.icon;

          const badge =
            tabItem.key ===
            "signups"
              ? pendingSignups.length
              : 0;

          return (
            <button
              key={tabItem.key}
              type="button"
              onClick={() =>
                setTab(
                  tabItem.key
                )
              }
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab ===
                tabItem.key
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Icon size={15} />

              {tabItem.label}

              {badge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Signups */}
      {tab === "signups" && (
        <SignupRequests />
      )}

      {/* Users */}
      {tab === "users" && (
        <ResourceManager
          collectionName="users"
          orderByField="name"
          columns={[
            "name",
            "email",
            "role",
            "groupId",
            "regNo",
          ]}
          allowCreate={true}
          helperText="Approve users from the Signups tab, or manually create them here. Fine-tune their role, group, and reg no. as needed."
          emptyLabel='No approved users yet. Check the "Signups" tab for people waiting on approval.'
          fields={[
            {
              key: "name",
              label: "Name",
              type: "text",
              placeholder:
                "e.g. Nimal Perera",
            },
            {
              key: "email",
              label: "Email",
              type: "text",
            },
            {
              key: "regNo",
              label: "Reg No",
              type: "text",
              placeholder:
                "e.g. EG/2022/1234",
            },
            {
              key: "role",
              label: "Role",
              type: "select",
              options: [
                "member",
                "leader",
                "admin",
              ],
            },
            {
              key: "groupId",
              label: "Group",
              type: "docRef",
              ref: "groups",
              refLabel: "name",
            },
          ]}
        />
      )}

      {/* Groups */}
      {tab === "groups" && (
        <ResourceManager
          collectionName="groups"
          orderByField="name"
          columns={[
            "name",
            "leaderId",
            "members",
          ]}
          emptyLabel="No groups yet"
          fields={[
            {
              key: "name",
              label: "Group Name",
              type: "text",
              placeholder:
                "Group A",
            },
            {
              key: "leaderId",
              label: "Leader",
              type: "docRef",
              ref: "users",
              refLabel: "name",
            },
            {
              key: "members",
              label: "Members",
              type: "docRefMulti",
              ref: "users",
              refLabel: "name",
              wide: true,
            },
          ]}
        />
      )}

      {/* Lab Sessions */}
      {tab === "labs" && (
        <>
          <div className="flex items-center justify-end">
            <BulkLabCreator />
          </div>

          <ResourceManager
            collectionName="labSessions"
            orderByField="date"
            columns={[
              "labNumber",
              "title",
              "date",
              "startTime",
              "endTime",
              "status",
            ]}
            emptyLabel="No lab sessions scheduled"
            fields={[
              {
                key: "labNumber",
                label: "Lab Number",
                type: "number",
                placeholder: "e.g. 1",
              },
              {
                key: "title",
                label: "Title",
                type: "text",
                placeholder:
                  "Lab 04 — Digital Logic",
              },
              {
                key: "topic",
                label: "Topic",
                type: "text",
              },
              {
                key: "date",
                label: "Date",
                type: "date",
              },
              {
                key: "startTime",
                label: "Start Time",
                type: "time",
              },
              {
                key: "endTime",
                label: "End Time",
                type: "time",
              },
              {
                key: "venue",
                label: "Venue",
                type: "text",
                placeholder:
                  "Computer Lab 01",
              },
              {
                key: "status",
                label: "Status",
                type: "select",
                options: [
                  "scheduled",
                  "held",
                  "cancelled",
                ],
              },
              {
                key: "groupIds",
                label: "Groups",
                type: "docRefMulti",
                ref: "groups",
                refLabel: "name",
                wide: true,
              },
            ]}
          />
        </>
      )}

      {/* Lectures */}
      {tab === "lectures" && (
        <ResourceManager
          collectionName="lectures"
          orderByField="date"
          columns={[
            "subject",
            "date",
            "startTime",
            "endTime",
            "status",
          ]}
          emptyLabel="No lectures scheduled"
          fields={[
            {
              key: "subject",
              label: "Subject",
              type: "text",
            },
            {
              key: "lecturer",
              label: "Lecturer",
              type: "text",
            },
            {
              key: "date",
              label: "Date",
              type: "date",
            },
            {
              key: "startTime",
              label: "Start Time",
              type: "time",
            },
            {
              key: "endTime",
              label: "End Time",
              type: "time",
            },
            {
              key: "venue",
              label: "Venue",
              type: "text",
            },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: [
                "scheduled",
                "held",
                "cancelled",
                "rescheduled",
              ],
            },
            {
              key: "rescheduledTo",
              label: "Rescheduled To",
              type: "text",
              placeholder:
                "e.g. 12 Sep, 2:00 PM",
              showIf: (form) =>
                form.status ===
                "rescheduled",
              wide: true,
            },
          ]}
        />
      )}

      {/* Assessments */}
      {tab === "assessments" && (
        <ResourceManager
          collectionName="assessments"
          orderByField="date"
          columns={[
            "title",
            "type",
            "date",
            "startTime",
            "endTime",
            "weight",
          ]}
          emptyLabel="No assessments scheduled"
          fields={[
            {
              key: "title",
              label: "Title",
              type: "text",
            },
            {
              key: "module",
              label: "Module",
              type: "text",
            },
            {
              key: "type",
              label: "Type",
              type: "select",
              options: [
                "quiz",
                "assignment",
                "midterm",
                "final",
              ],
            },
            {
              key: "date",
              label: "Date",
              type: "date",
            },
            {
              key: "startTime",
              label: "Start Time",
              type: "time",
            },
            {
              key: "endTime",
              label: "End Time",
              type: "time",
            },
            {
              key: "venue",
              label: "Venue",
              type: "text",
            },
            {
              key: "weight",
              label: "Weight (%)",
              type: "number",
            },
          ]}
        />
      )}

      {/* Analytics */}
      {tab === "analytics" && (
        <AdminAnalytics />
      )}
    </div>
  );
}