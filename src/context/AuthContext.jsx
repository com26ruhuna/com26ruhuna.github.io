import { createContext, useContext, useEffect, useState } from "react";

import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db, googleProvider } from "../config/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Firebase Authentication listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // User profile + signup request handling
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const signupRef = doc(db, "signupRequests", user.uid);

    // Listen for the approved Firestore profile
    const unsubscribeProfile = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();

          setProfile({
            id: snap.id,
            ...data,
            // Convert Firestore reference -> group ID for the frontend
            groupId: data.groupId?.id || null,
          });
        } else {
          setProfile(null);
        }

        setLoading(false);
      },
      (error) => {
        console.error("Failed to read user profile:", error);
        setProfile(null);
        setLoading(false);
      }
    );

    // Check whether this account has already been approved
    getDoc(userRef)
      .then(async (snap) => {
        if (!snap.exists()) {
          // Not approved yet -> create/update pending signup request
          await setDoc(
            signupRef,
            {
              name: user.displayName || "",
              email: user.email || "",
              photoURL: user.photoURL || "",
              requestedAt: serverTimestamp(),
            },
            { merge: true }
          );

          console.log("Signup request created for:", user.email);
        } else {
          // Already approved -> remove any stale signup request
          await deleteDoc(signupRef).catch(() => {});
        }
      })
      .catch((error) => {
        console.error("Failed to process signup request:", error);
      });

    return unsubscribeProfile;
  }, [user]);

  const login = () => {
    return signInWithPopup(auth, googleProvider);
  };

  const logout = () => {
    return firebaseSignOut(auth);
  };

  const value = {
    user,
    profile,
    isLeader: profile?.role === "leader",
    isAdmin: profile?.role === "admin",
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }

  return ctx;
}