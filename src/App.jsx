import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Layout from "./components/Layout";
import Admin from "./pages/Admin";

import Dashboard from "./pages/Dashboard";
import LectureCalendar from "./pages/LectureCalendar";
import LabCalendar from "./pages/LabCalendar";
import AssessmentCalendar from "./pages/AssessmentCalendar";
import Attendance from "./pages/Attendance";

function LoginPage() {
  const { login, loading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl mb-5">
          CE
        </div>

        <h1 className="text-2xl font-serif font-bold text-slate-800">
          CE Batch Portal
        </h1>

        <p className="text-sm text-slate-500 mt-2 mb-8">
          Faculty of Engineering, University of Ruhuna
        </p>

        <button
          onClick={login}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, profile, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">
            Account not registered
          </h1>

          <p className="text-sm text-slate-500 mt-3">
            Your Google account is authenticated, but your batch portal
            profile has not been created yet.
          </p>

          <button
            onClick={logout}
            className="mt-6 bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 px-4 rounded-lg"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lectures" element={<LectureCalendar />} />
          <Route path="/labs" element={<LabCalendar />} />
          <Route path="/assessments" element={<AssessmentCalendar />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}