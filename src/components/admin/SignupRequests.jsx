// src/components/admin/SignupRequests.jsx
//
// Anyone who signs in with Google but doesn't have a users/{uid} doc yet
// is left logged-in-but-locked-out by AuthContext (profile stays null, so
// the app's "Account not registered" screen keeps gating them). All that
// happens automatically is a lightweight, non-privileged request gets
// logged to signupRequests/{uid}.
//
// This tab is where that request actually turns into access: Approve
// creates the real users/{uid} profile (default role "member", no group —
// fine-tune from the Users tab afterwards) and clears the request.
// Dismiss just removes the request without granting anything, e.g. for a
// signed-in Google account that shouldn't have access at all.

import { useState } from "react";
import { doc, setDoc, deleteDoc, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useCollection } from "../../hooks/useFirestore";
import { UserCheck, UserX, Loader2 } from "lucide-react";

export function SignupRequests() {
  const { data: requests, loading } = useCollection("signupRequests", [
    orderBy("requestedAt", "desc"),
  ]);
  const [busyId, setBusyId] = useState(null);

  const approve = async (req) => {
    setBusyId(req.id);
    try {
      await setDoc(doc(db, "users", req.id), {
        name: req.name || "",
        email: req.email || "",
        photoURL: req.photoURL || "",
        role: "member",
        groupId: null,
        regNo: "",
        createdAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, "signupRequests", req.id));
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (req) => {
    setBusyId(req.id);
    try {
      await deleteDoc(doc(db, "signupRequests", req.id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-500">
          {requests.length} pending {requests.length === 1 ? "request" : "requests"}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          These are Google accounts that signed in but don't have access yet. Approve to give
          them a "member" profile (edit their role, group, and reg no. from the Users tab), or
          dismiss to leave them locked out.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center text-slate-400">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : requests.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            No one is waiting on approval. New sign-ins will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requests.map((req) => (
              <li key={req.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {req.photoURL ? (
                    <img src={req.photoURL} alt="" className="w-9 h-9 rounded-full shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {req.name || "Unnamed"}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{req.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => approve(req)}
                    disabled={busyId === req.id}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <UserCheck size={14} /> Approve
                  </button>
                  <button
                    onClick={() => dismiss(req)}
                    disabled={busyId === req.id}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-red-600 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <UserX size={14} /> Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
