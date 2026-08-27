import { db, auth } from "./firebase-config.js";
import { notifyUser } from "./notifications.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc,
  query, where, onSnapshot, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// ---------- Photo upload (Cloudinary — no billing/card needed, 25GB free) ----------
// 1. Sign up free at https://cloudinary.com
// 2. Dashboard එකේ "Cloud name" එක copy කරන්න
// 3. Settings → Upload → "Upload presets" → Add upload preset → Signing Mode: "Unsigned" → Save → preset name එක copy කරන්න
// 4. පහත අගය දෙක replace කරන්න:
const CLOUDINARY_CLOUD_NAME = "favfuhcn";
const CLOUDINARY_UPLOAD_PRESET = "p0luehws";

export async function uploadPhotos(files, folder) {
  const urls = [];
  for (const f of files) {
    if (!f) continue;
    const form = new FormData();
    form.append("file", f);
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    form.append("folder", folder);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: form
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Photo upload අසාර්ථකයි");
    urls.push(data.secure_url);
  }
  return urls;
}

// ---------- Gigs (ploughing / harvesting / extras) ----------
// gig doc: { category, subCategory, ownerId, ownerName, title, machineType, machineNumber,
//   nic, phone1, phone2, address, lat, lng, availableDate, photos:[], receiptPhoto,
//   status: 'pending'|'active'|'rejected', createdAt }

export async function createGig(data, photoFiles, receiptFile) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Login වෙන්න ඕන");
  const photos = photoFiles?.length ? await uploadPhotos(photoFiles, `gigs/${uid}`) : [];
  const receiptPhoto = receiptFile ? (await uploadPhotos([receiptFile], `receipts/${uid}`))[0] : "";
  const payload = {
    ...data,
    ownerId: uid,
    photos,
    receiptPhoto,
    status: "pending",
    expireDate: "",
    createdAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, "gigs"), payload);
  await addDoc(collection(db,"adminNotifications"),{type:"new_gig",title:"නව Gig එකක් ලැබුණා",message:`${data.ownerName||"ව්‍යාපාරිකයෙක්"} නව service gig එකක් submit කර ඇත.`,gigId:ref.id,read:false,createdAt:serverTimestamp()});
  return ref;
}

export function listenActiveGigs(category, cb) {
  const q = query(collection(db, "gigs"), where("category", "==", category), where("status", "==", "active"));
  return onSnapshot(q, snap => {
    const now = new Date();
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => !g.expireDate || new Date(g.expireDate + "T23:59:59") >= now));
  });
}

export function listenMyGigs(uid, cb) {
  const q = query(collection(db, "gigs"), where("ownerId", "==", uid));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function listenPendingGigs(cb) {
  const q = query(collection(db, "gigs"), where("status", "==", "pending"));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function listenAllGigs(cb) {
  return onSnapshot(collection(db, "gigs"), snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function setGigStatus(gigId, status, expireDate="") {
  const patch = { status };
  if (status === "active") {
    const d = expireDate || new Date(Date.now()+10*86400000).toISOString().slice(0,10);
    patch.expireDate = d;
  }
  await updateDoc(doc(db, "gigs", gigId), patch);
  const g = await getGig(gigId);
  if (g?.ownerId) await notifyUser(g.ownerId, status==="active"?"gig_approved":"gig_rejected",
    status==="active"?"Gig එක Admin විසින් අනුමත කළා":"Gig එක Admin විසින් අනුමත කළේ නැහැ",
    status==="active"?`ඔබේ සේවාව දැන් site එකේ පෙන්වයි. Expire Date: ${patch.expireDate}`:"ඔබේ Gig එක review කර නැවත නිවැරදි කර submit කරන්න.",{gigId,expireDate:patch.expireDate||""});
  return true;
}

export async function updateGig(gigId, data, photoFiles, receiptFile) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Login වෙන්න ඕන");
  const update = { ...data };
  if (photoFiles?.length) update.photos = await uploadPhotos(photoFiles, `gigs/${uid}`);
  if (receiptFile) update.receiptPhoto = (await uploadPhotos([receiptFile], `receipts/${uid}`))[0];
  return updateDoc(doc(db, "gigs", gigId), update);
}

export async function deleteGig(gigId) {
  return deleteDoc(doc(db, "gigs", gigId));
}

export async function getGig(gigId) {
  const s = await getDoc(doc(db, "gigs", gigId));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

// ---------- Bookings ----------
// booking doc: { gigId, gigTitle, ownerId, farmerId, farmerName, farmerPhone,
//   date, area, status:'pending'|'accepted'|'rejected', createdAt }

export async function createBooking(gig, farmer, date, area) {
  const booking = await addDoc(collection(db, "bookings"), {
    gigId: gig.id,
    gigTitle: gig.title || gig.machineType || "Gig",
    ownerId: gig.ownerId,
    farmerId: farmer.uid,
    farmerName: farmer.displayName || farmer.email || farmer.phoneNumber || "ගොවියා",
    farmerPhone: farmer.phone || farmer.phoneNumber || "",
    date, area,
    status: "pending",
    createdAt: serverTimestamp()
  });
  await notifyUser(gig.ownerId,"booking_new","නව Booking එකක්","ගොවියෙක් ඔබේ සේවාව Booking කර ඇත.",{bookingId:booking.id,gigId:gig.id});
  return booking;
}

export function listenMyBookings(uid, cb) {
  const q = query(collection(db, "bookings"), where("farmerId", "==", uid));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function listenOrdersForOwner(uid, cb) {
  const q = query(collection(db, "bookings"), where("ownerId", "==", uid));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

// Admin only (UI-gated in admin.html — every open admin.html tab still sees new
// bookings the instant they're created, same live pattern as listenAllGigs).
export function listenAllBookings(cb) {
  return onSnapshot(collection(db, "bookings"), snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function setBookingStatus(bookingId, status) {
  await updateDoc(doc(db, "bookings", bookingId), { status });
  const snap = await getDoc(doc(db,"bookings",bookingId));
  if(snap.exists()){
    const b=snap.data();
    if(b.farmerId) await notifyUser(b.farmerId,"booking_status",
      status==="accepted"?"Booking එක Accept කළා":"Booking Status Update",
      status==="accepted"?"ඔබගේ booking එක සේවා සපයන්නා Accept කර ඇත.":`Booking එකේ status: ${status}`,{bookingId});
    if(status==="cancelled" && b.ownerId) await notifyUser(b.ownerId,"booking_cancelled","Booking එක Cancel කළා","ගොවියා booking එක cancel කර ඇත.",{bookingId});
  }
  return true;
}

export async function deleteBooking(bookingId) {
  return deleteDoc(doc(db, "bookings", bookingId));
}


export async function createRenewalRequest(gigId, receiptFile){
  const uid=auth.currentUser?.uid; if(!uid) throw new Error("Login වෙන්න ඕන");
  const receiptPhoto=receiptFile?(await uploadPhotos([receiptFile],`renewals/${uid}`))[0]:"";
  const ref=await addDoc(collection(db,"renewalRequests"),{gigId,ownerId:uid,receiptPhoto,status:"pending",createdAt:serverTimestamp()});
  await addDoc(collection(db,"adminNotifications"),{type:"gig_renewal",title:"Gig Renewal Request",message:"Gig එකක් දින 10කට renew කිරීමට payment proof එකක් ලැබුණා.",gigId,requestId:ref.id,read:false,createdAt:serverTimestamp()});
  return ref;
}
export async function approveRenewal(requestId,gigId){
  const expireDate=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
  await updateDoc(doc(db,"renewalRequests",requestId),{status:"approved",approvedAt:serverTimestamp(),expireDate});
  await updateDoc(doc(db,"gigs",gigId),{status:"active",expireDate});
  const g=await getGig(gigId); if(g?.ownerId) await notifyUser(g.ownerId,"gig_renewed","Gig එක නැවත Active කළා",`ඔබේ Gig එක තවත් දින 10කට Active. Expire Date: ${expireDate}`,{gigId,expireDate});
}
