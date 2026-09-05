// src/components/Layout.jsx
// Main application shell: responsive sidebar, header, navigation,
// role information, and page outlet.

import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  FlaskConical,
  ClipboardList,
  CheckSquare,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/lectures", label: "Lecture Schedule", icon: CalendarDays },
  { path: "/labs", label: "Lab Sessions", icon: FlaskConical },
  { path: "/assessments", label: "Assessments", icon: ClipboardList },
  { path: "/attendance", label: "Attendance", icon: CheckSquare },
];

const adminLink = {
  path: "/admin",
  label: "Admin Panel",
  icon: Settings,
};

export default function Layout() {
  const location = useLocation();
  const { profile, logout, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = isAdmin ? [...navLinks, adminLink] : navLinks;

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* Mobile backdrop */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          w-64 bg-slate-950
          flex flex-col
          transform transition-transform duration-300
          md:static md:translate-x-0
          ${menuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* University header */}
        <div className="relative px-5 pt-6 pb-5 border-b border-slate-800">
          <p className="text-[11px] tracking-wide text-slate-500">
            Faculty of Engineering
          </p>

          <h1 className="text-lg font-serif font-bold text-white leading-tight mt-1">
            University of Ruhuna
          </h1>

          <p className="text-xs text-slate-400 mt-2">
            Computer Engineering Batch
          </p>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="absolute top-4 right-4 md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const isActive =
              location.pathname === link.path ||
              (link.path === "/admin" &&
                location.pathname.startsWith("/admin"));

            const Icon = link.icon;

            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMenuOpen(false)}
                className={`
                  flex items-center gap-3
                  px-4 py-3
                  rounded-lg
                  text-sm font-medium
                  transition-all
                  ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }
                `}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User / role footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2 mb-3 text-xs text-slate-400">
            <ShieldCheck size={16} className="text-blue-400 shrink-0" />

            <span className="truncate">
              {profile?.role === "admin"
                ? "Administrator"
                : profile?.role === "leader"
                ? "Group Leader"
                : "Member"}

              {profile?.groupId ? ` · ${profile.groupId}` : ""}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main application area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">

        {/* Header */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-4 sm:px-6 lg:px-8 z-30">

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>

          {/* Desktop title */}
          <div className="hidden sm:block text-sm font-semibold text-slate-600 uppercase tracking-wider truncate">
            Student Management & Scheduling Portal
          </div>

          {/* Mobile title */}
          <div className="sm:hidden text-xs font-semibold text-slate-600 truncate mx-3">
            CE Batch Portal
          </div>

          {/* User section */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-sm shadow-inner">
              CE
            </div>

            <div className="hidden sm:block text-right">
              <span className="block text-xs font-semibold text-slate-700">
                {profile?.name || "Batch Portal"}
              </span>

              <span className="block text-[10px] text-slate-400">
                Connected to Firebase
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}