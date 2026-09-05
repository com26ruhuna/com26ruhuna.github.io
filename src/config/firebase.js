// src/config/firebase.js
// Firebase initialization. Values come from your Firebase project settings
// (Project settings > General > Your apps > SDK setup and configuration).
// Keep these in a .env file (VITE_ prefix required by Vite) rather than
// hardcoding them, and add .env to .gitignore.

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCLdmxZA0PfgFDCo7mXNeF3dUNKLjSLECA",
  authDomain: "com26-26360.firebaseapp.com",
  projectId: "com26-26360",
  storageBucket: "com26-26360.firebasestorage.app",
  messagingSenderId: "175680378376",
  appId: "1:175680378376:web:046afc90a7b22f5a0823bd",
  measurementId: "G-EDMDYWJ0GR"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
