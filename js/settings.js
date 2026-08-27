import { db, auth } from "./firebase-config.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// ---------- Homepage stats (Admin-editable, public read) ----------
// Stored at settings/site in Firestore. Falls back to these defaults if the
// document doesn't exist yet (first run, before Admin saves anything).
export const DEFAULT_SITE_STATS = {
  users: "1,250+",
  services: "380+",
  areas: "25+",
  support: "24/7",
  listingFee: 150
};

// Public + Admin: live-listen to homepage stats. Calls cb(statsObject) immediately
// and again every time Admin updates them (Firestore onSnapshot = real-time).
export function listenSiteStats(cb) {
  return onSnapshot(doc(db, "settings", "site"), (snap) => {
    cb(snap.exists() ? { ...DEFAULT_SITE_STATS, ...snap.data() } : DEFAULT_SITE_STATS);
  }, (err) => {
    console.warn("Site stats listen failed, using defaults:", err.message);
    cb(DEFAULT_SITE_STATS);
  });
}

// Admin only (also enforced server-side by Firestore rules — see README.md).
export async function saveSiteStats(stats) {
  if (!auth.currentUser) throw new Error("Login වෙන්න ඕන");
  return setDoc(doc(db, "settings", "site"), stats, { merge: true });
}

export async function getSiteStatsOnce() {
  const snap = await getDoc(doc(db, "settings", "site"));
  return snap.exists() ? { ...DEFAULT_SITE_STATS, ...snap.data() } : DEFAULT_SITE_STATS;
}

// ---------- Homepage "About / Creators" text (Admin-editable, public read) ----------
// Stored in the same settings/site document as the stats above, under these two keys,
// so it reuses the exact same live-update (onSnapshot) + Firestore-rule enforcement.
export const DEFAULT_SITE_CONTENT = {
  aboutText: "ගොවීන්ට අවශ්‍ය කෘෂි යන්ත්‍ර සහ අනෙකුත් සේවා පහසුවෙන් සොයාගැනීමට, ප්‍රදේශය අනුව තෝරාගැනීමට සහ booking කිරීමට නිර්මාණය කරන ලද digital platform එකකි.",
  creatorsText: "මෙම Web & Mobile Application එක සංවර්ධනය කරන කණ්ඩායම සහ developer information මෙතැනින් පෙන්විය හැක."
};

// Public + Admin: live-listen to the About / Creators homepage text.
export function listenSiteContent(cb) {
  return onSnapshot(doc(db, "settings", "site"), (snap) => {
    cb(snap.exists() ? { ...DEFAULT_SITE_CONTENT, ...snap.data() } : DEFAULT_SITE_CONTENT);
  }, (err) => {
    console.warn("Site content listen failed, using defaults:", err.message);
    cb(DEFAULT_SITE_CONTENT);
  });
}

// Admin only (also enforced server-side by Firestore rules — same settings/site doc as stats).
export async function saveSiteContent(content) {
  if (!auth.currentUser) throw new Error("Login වෙන්න ඕන");
  return setDoc(doc(db, "settings", "site"), content, { merge: true });
}

// Admin-editable Gig listing fee. Stored in settings/site and listened to live.
export async function saveListingFee(listingFee) {
  if (!auth.currentUser) throw new Error("Login වෙන්න ඕන");
  return setDoc(doc(db, "settings", "site"), { listingFee: Number(listingFee) || 0 }, { merge: true });
}

export const DEFAULT_SOCIAL = {
  whatsappUrl: "https://wa.me/94714980024",
  youtubeUrl: "",
  facebookUrl: "",
  whatsappLogo: "https://drive.google.com/uc?export=view&id=1iZOrAhuqTgpdVzxYX_semcnBUIdL_bQy",
  youtubeLogo: "https://drive.google.com/uc?export=view&id=1KQl-Jjn6anb8DHtcwb4EZQiKUv0cl9h7",
  facebookLogo: "https://drive.google.com/uc?export=view&id=1yb8-FIM5DYeBfVzpGJnq-UjcpiAuquz7"
};
export function listenSocialSettings(cb){
  return onSnapshot(doc(db,"settings","site"),snap=>cb(snap.exists()?{...DEFAULT_SOCIAL,...snap.data()}:DEFAULT_SOCIAL),()=>cb(DEFAULT_SOCIAL));
}
export async function saveSocialSettings(data){
  if(!auth.currentUser) throw new Error("Login වෙන්න ඕන");
  return setDoc(doc(db,"settings","site"),data,{merge:true});
}
