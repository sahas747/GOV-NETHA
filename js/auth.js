import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db } from "./firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const ADMIN_EMAILS = ["slfilepodda1@gmail.com"];
const isAdmin = (email) => ADMIN_EMAILS.map(x => x.toLowerCase()).includes((email || "").toLowerCase());

async function userDocExists(uid) {
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? s.data() : null;
}

// Save the profile once while preserving saved name/phone/role on later logins.
async function saveUser(user, role, isNew, extra = {}, existingData = null) {
  const stored = existingData || {};
  const payload = {
    uid: user.uid,
    name: extra.name || stored.name || user.displayName || "Govi Netha User",
    email: user.email || stored.email || "",
    phone: extra.phone || stored.phone || user.phoneNumber || "",
    photoURL: user.photoURL || stored.photoURL || "",
    role: isAdmin(user.email) ? "admin" : (role || stored.role || "farmer"),
    updatedAt: serverTimestamp()
  };
  if (isNew) payload.createdAt = serverTimestamp();
  await setDoc(doc(db, "users", user.uid), payload, { merge: true });
  return payload;
}

function cacheUser(user, profile = {}, role = "farmer") {
  const cached = {
    uid: user.uid,
    name: profile.name || user.displayName || user.email || user.phoneNumber || "User",
    email: profile.email || user.email || "",
    phone: profile.phone || user.phoneNumber || "",
    photoURL: user.photoURL || profile.photoURL || "",
    role: isAdmin(user.email) ? "admin" : (profile.role || role || "farmer")
  };
  localStorage.setItem("goviFirebaseUser", JSON.stringify(cached));
  localStorage.setItem("goviRole", cached.role);
  return cached;
}

function goAfterLogin(role, email) {
  localStorage.setItem("goviRole", role);
  const next = new URLSearchParams(window.location.search).get("next");
  window.location.href = isAdmin(email) ? "admin.html" : (next || "dashboard.html");
}

let pendingGoogleUser = null;
let pendingGoogleExisting = false;
let pendingGoogleExistingData = null;
// Keep the first-login profile form open until name, phone and role are saved.
let loginFlowActive = false;

async function loginWithGoogle() {
  loginFlowActive = true;
  const button = document.getElementById("googleLoginBtn");
  if (button) { button.disabled = true; button.textContent = "Google Login වෙමින්..."; }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const blocked = await getDoc(doc(db, "deactivatedAccounts", result.user.uid));
    if (blocked.exists() && !isAdmin(result.user.email)) {
      await signOut(auth);
      alert("මෙම account එක Admin විසින් deactivate කර ඇත. නැවත access සඳහා Admin අමතන්න.");
      return;
    }

    const existing = await userDocExists(result.user.uid);

    if (existing || isAdmin(result.user.email)) {
      // Complete accounts go straight in. Only accounts missing first-login
      // details are shown the name/phone/role form.
      if (existing && !isAdmin(result.user.email) && (!existing.name || !existing.phone || !existing.role)) {
        pendingGoogleUser = result.user;
        pendingGoogleExisting = true;
        pendingGoogleExistingData = existing;
        const nameInput = document.getElementById("firstLoginName");
        const phoneInput = document.getElementById("firstLoginPhone");
        if (nameInput) nameInput.value = existing.name || "";
        if (phoneInput) phoneInput.value = existing.phone || "";
        showRolePicker();
      } else {
        const profile = await saveUser(
          result.user,
          existing?.role || (isAdmin(result.user.email) ? "admin" : "farmer"),
          !existing,
          {},
          existing
        );
        cacheUser(result.user, profile, profile.role);
        finishLogin(result.user, profile.role, profile);
      }
    } else {
      pendingGoogleUser = result.user;
      pendingGoogleExisting = false;
      pendingGoogleExistingData = null;
      showRolePicker();
    }
  } catch (error) {
    loginFlowActive = false;
    console.error("Google sign-in error:", error);
    const code = error?.code || "";
    let message = "Google Login failed. නැවත try කරන්න.";
    if (code === "auth/popup-blocked") message = "Chrome එකෙන් popup එක block කරලා. Site එකට popups allow කරලා නැවත try කරන්න.";
    else if (code === "auth/popup-closed-by-user") message = "Google Login window එක close කළා. නැවත try කරන්න.";
    else if (code === "auth/unauthorized-domain") message = "මේ website domain එක Firebase Authentication → Settings → Authorized domains එකට add කරන්න.";
    else if (code === "auth/operation-not-allowed") message = "Firebase Console → Authentication → Sign-in method → Google → Enable කරන්න.";
    alert(message);
    if (button) { button.disabled = false; button.textContent = "🔵 Continue with Google"; }
  }
}
window.loginWithGoogle = loginWithGoogle;

window.chooseRole = async (role) => {
  const user = pendingGoogleUser;
  if (!user) return;
  const name = (document.getElementById("firstLoginName")?.value || "").trim();
  const phone = (document.getElementById("firstLoginPhone")?.value || "").trim().replace(/\s/g, "");
  if (!name) return alert("ඔබේ නම දාන්න.");
  if (!phone || !/^0\d{9}$/.test(phone)) return alert("වලංගු 07XXXXXXXX phone number එකක් දාන්න.");
  if (role !== "farmer" && role !== "owner") return alert("ඔබේ role එක තෝරන්න.");

  const finalRole = isAdmin(user.email) ? "admin" : role;
  const profile = await saveUser(
    user,
    finalRole,
    !pendingGoogleExisting,
    { name, phone },
    pendingGoogleExistingData
  );
  cacheUser(user, profile, finalRole);
  finishLogin(user, finalRole, profile);

  pendingGoogleUser = null;
  pendingGoogleExisting = false;
  pendingGoogleExistingData = null;
  loginFlowActive = false;
};

function showRolePicker() {
  document.getElementById("rolePicker")?.classList.add("show");
}

function finishLogin(user, role, extra = {}) {
  cacheUser(user, extra, role);
  loginFlowActive = false;
  goAfterLogin(isAdmin(user.email) ? "admin" : role, user.email);
}

// Phone OTP login removed. Phone number is collected once during first Google login.
window.logoutFirebase = async () => {
  await signOut(auth);
  localStorage.removeItem("goviFirebaseUser");
  localStorage.removeItem("goviRole");
  window.location.href = "index.html";
};

onAuthStateChanged(auth, async (user) => {
  const nameEl = document.getElementById("firebaseUserName");
  if (nameEl) nameEl.textContent = user?.displayName || user?.email || user?.phoneNumber || "Guest";
  if (!user) return;

  // Refresh local cache from Firestore whenever Firebase restores a session.
  let stored = null;
  try {
    stored = await userDocExists(user.uid);
    if (stored) cacheUser(user, stored, stored.role || "farmer");
  } catch (e) {
    console.warn("Could not refresh saved profile:", e);
  }

  const onLoginPage = /(^|\/)login\.html$/.test(window.location.pathname);
  if (onLoginPage) {
    // Never redirect while the first-login form is being completed.
    if (loginFlowActive || pendingGoogleUser) return;

    const cached = JSON.parse(localStorage.getItem("goviFirebaseUser") || "null");
    const profile = stored || cached || {};

    // If Firebase restored a Google account that has not yet got all three
    // first-login details, show the same form instead of sending it away.
    if (!isAdmin(user.email) && (!profile.name || !profile.phone || !profile.role)) {
      pendingGoogleUser = user;
      pendingGoogleExisting = !!stored;
      pendingGoogleExistingData = stored || null;
      const nameInput = document.getElementById("firstLoginName");
      const phoneInput = document.getElementById("firstLoginPhone");
      if (nameInput) nameInput.value = profile.name || user.displayName || "";
      if (phoneInput) phoneInput.value = profile.phone || "";
      showRolePicker();
      return;
    }

    goAfterLogin(profile.role || (isAdmin(user.email) ? "admin" : "farmer"), user.email);
  }
});

export { isAdmin };
