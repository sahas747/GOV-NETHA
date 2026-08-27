// Firebase configuration for Govi Netha
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyABHv-e2tbH-GZeKP3kVBGwChvfsTAnjfs",
  authDomain: "govi-netha.firebaseapp.com",
  projectId: "govi-netha",
  storageBucket: "govi-netha.firebasestorage.app",
  messagingSenderId: "516747577787",
  appId: "1:516747577787:web:08a911df11596353721c9e",
  measurementId: "G-8DRFV8XCRX"
};

const app = initializeApp(firebaseConfig);
let analytics = null;
try { analytics = getAnalytics(app); } catch (e) { console.warn("Analytics unavailable:", e.message); }

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });

export { app, analytics, auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged };
