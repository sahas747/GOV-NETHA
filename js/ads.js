import { db, auth } from "./firebase-config.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, orderBy, query
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const CLOUDINARY_CLOUD_NAME = "favfuhcn";
const CLOUDINARY_UPLOAD_PRESET = "p0luehws";

export async function uploadAdMedia(file) {
  if (!file) throw new Error("Ad Photo / Video එකක් තෝරන්න");

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    throw new Error("JPG, PNG, WEBP photo හෝ MP4, WebM, MOV video එකක් upload කරන්න");
  }

  // Photos may be any dimensions. The ad player will fit/crop them to the available slot.
  // Videos may use normal video dimensions; no fixed resolution is required.
  const mediaInfo = await new Promise((resolve, reject) => {
    if (isImage) {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error("Photo එක කියවන්න බැහැ"));
      };
      img.src = URL.createObjectURL(file);
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve({ width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Video එක කියවන්න බැහැ. MP4/WebM/MOV file එකක් try කරන්න"));
    };
    video.src = URL.createObjectURL(file);
  });

  // No fixed photo/video resolution or aspect-ratio validation.
  // Any supported image or video can be uploaded.

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  form.append("folder", "ads");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
    method: "POST", body: form
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Ad media upload අසාර්ථකයි");

  return {
    url: data.secure_url,
    mediaType: data.resource_type === "video" || isVideo ? "video" : "image"
  };
}

/*
 Ad document:
 { title, linkUrl, mediaType, url, active, muted,
   order: number, durationSeconds: number, fadeInSeconds: number, fadeOutSeconds: number,
   startAtMs: number|null, endAtMs: number|null, createdAt }
*/
export async function createAd({ title, linkUrl, order, durationSeconds, fadeInSeconds, fadeOutSeconds, startAtMs, endAtMs }, file) {
  if (!auth.currentUser) throw new Error("Login වෙන්න ඕන");
  const { url, mediaType } = await uploadAdMedia(file);
  return addDoc(collection(db, "ads"), {
    title: title || "",
    linkUrl: linkUrl || "",
    mediaType, url,
    active: true,
    muted: true,
    order: Number(order) || 1,
    durationSeconds: Math.max(3, Number(durationSeconds) || 15),
    fadeInSeconds: Math.min(10, Math.max(0, Number.isFinite(Number(fadeInSeconds)) ? Number(fadeInSeconds) : 0.45)),
    fadeOutSeconds: Math.min(10, Math.max(0, Number.isFinite(Number(fadeOutSeconds)) ? Number(fadeOutSeconds) : 0.45)),
    startAtMs: Number.isFinite(Number(startAtMs)) ? Number(startAtMs) : null,
    endAtMs: Number.isFinite(Number(endAtMs)) ? Number(endAtMs) : null,
    createdAt: serverTimestamp()
  });
}

export async function setAdActive(adId, active) {
  return updateDoc(doc(db, "ads", adId), { active });
}
export async function setAdMuted(adId, muted) {
  return updateDoc(doc(db, "ads", adId), { muted });
}
export async function updateAdSchedule(adId, data) {
  return updateDoc(doc(db, "ads", adId), {
    order: Number(data.order) || 1,
    durationSeconds: Math.max(3, Number(data.durationSeconds) || 15),
    fadeInSeconds: Math.min(10, Math.max(0, Number.isFinite(Number(data.fadeInSeconds)) ? Number(data.fadeInSeconds) : 0.45)),
    fadeOutSeconds: Math.min(10, Math.max(0, Number.isFinite(Number(data.fadeOutSeconds)) ? Number(data.fadeOutSeconds) : 0.45)),
    startAtMs: Number.isFinite(Number(data.startAtMs)) ? Number(data.startAtMs) : null,
    endAtMs: Number.isFinite(Number(data.endAtMs)) ? Number(data.endAtMs) : null
  });
}
export async function deleteAd(adId) {
  return deleteDoc(doc(db, "ads", adId));
}

export function listenActiveAds(cb) {
  const q = query(collection(db, "ads"), orderBy("createdAt", "desc"));
  let cache = [];
  const publish = () => {
    const now = Date.now();
    const active = cache.filter(a =>
      a.active &&
      (a.startAtMs == null || Number(a.startAtMs) <= now) &&
      (a.endAtMs == null || Number(a.endAtMs) > now)
    ).sort((a, b) => {
      // Play Order is the ONLY primary playback key.
      // createdAt/id are only deterministic tie-breakers when two ads
      // accidentally have the same Play Order.
      const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
      const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      const at = a.createdAt?.toMillis?.() ?? 0;
      const bt = b.createdAt?.toMillis?.() ?? 0;
      if (at !== bt) return at - bt;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    cb(active);
  };
  const unsub = onSnapshot(q, snap => {
    cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    publish();
  });
  const timer = setInterval(publish, 10000); // start/end schedules become effective without a page refresh
  return () => { clearInterval(timer); unsub(); };
}

export function listenAllAdsAdmin(cb) {
  const q = query(collection(db, "ads"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
