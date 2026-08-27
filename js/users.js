import { db } from "./firebase-config.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Admin-only in practice (UI-gated in admin.html — the whole page redirects non-admins
// to login.html before this ever runs). Firestore rule already requires request.auth != null
// to read /users/{uid}, which is satisfied since Admin is logged in.
// Real-time: onSnapshot means the Admin's "සියලුම Data Base" → Admin/Users table updates the
// instant a new person registers, with no page refresh — same live pattern as gigs/bookings.
export function listenAllUsers(cb) {
  return onSnapshot(collection(db, "users"), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.warn("Users listen failed:", err.message);
    cb([]);
  });
}
