import { auth, onAuthStateChanged } from "./firebase-config.js";
import { createGig, updateGig, listenMyGigs, listenMyBookings, listenOrdersForOwner, setBookingStatus, deleteGig, deleteBooking, createRenewalRequest } from "./gigs.js";
import { listenSiteStats } from "./settings.js";
import { listenMyNotifications, showNotifications, notifyUser } from "./notifications.js";
import { sendAdminMessage, listenAdminChat, renderChatMessages } from "./chat.js";
import { saveTodayWork, stopTodayWork, listenTodayWorksForOwner, startLiveLocation, stopLiveLocation } from "./tracking.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const $ = (s) => document.querySelector(s);
let myGigsCache = [];
let editingGigId = null;

// ---- Tabs ----
document.querySelectorAll(".side-link[data-tab]").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".side-link[data-tab]").forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
    document.getElementById("tab-" + link.dataset.tab)?.classList.remove("hidden");
  });
});

// ---- Category-dependent field toggling ----
function syncCategoryFields() {
  const cat = $("#gCategory").value;
  $("#gSubWrap").style.display = cat === "extras" ? "" : "none";
  $("#gMachineTypeWrap").style.display = cat === "extras" ? "none" : "";
  $("#gMachineNoWrap").style.display = cat === "extras" ? "none" : "";
}
$("#gCategory")?.addEventListener("change", syncCategoryFields);
syncCategoryFields();

// Live Admin-controlled listing fee shown beside the receipt upload.
listenSiteStats((s) => {
  const fee = Number(s.listingFee ?? 150);
  const label = $("#gReceiptLabel");
  if (label) label.textContent = `Bank Receipt (රු.${fee} Gig Listing Fee — සියලුම සේවා සඳහා අනිවාර්යයි)`;
  const submit = $("#gigSubmitBtn");
  if (submit && !editingGigId) submit.textContent = `Gig එක Submit කරන්න (රු.${fee} ගාස්තුවේ Receipt සමඟ)`;
});

// ---- Map picker for gig location ----
let gMap, gMarker, gAccuracyCircle, pickedLat = null, pickedLng = null;
function initGigMap() {
  if (gMap || typeof L === "undefined") return;
  // FIX: Leaflet's default marker icon path is auto-detected from whichever <script> tag
  // looks like it loaded Leaflet. That auto-detection can fail depending on how the page
  // was loaded, silently leaving the marker with no icon image — which makes a pin look
  // like it "isn't landing" in the right spot (no visible marker, or a mis-anchored one).
  // Pinning the real CDN image URLs here removes that guesswork entirely.
  if (L.Icon && L.Icon.Default) {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
    });
  }
  gMap = L.map("gMap").setView([7.8731, 80.7718], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(gMap);
  gMap.on("click", (e) => {
    if (gAccuracyCircle) { gAccuracyCircle.remove(); gAccuracyCircle = null; }
    setPickedLocation(e.latlng.lat, e.latlng.lng, gMap.getZoom());
  });
  // The map is created while its tab panel is still `hidden` (display:none), so Leaflet
  // measures a 0×0 container and caches that wrong size. That's what made "My Location" /
  // clicks drop the marker in the wrong spot on the map. Forcing a re-measure once the tab
  // is actually visible/painted fixes it.
  requestAnimationFrame(() => gMap.invalidateSize());
  setTimeout(() => gMap.invalidateSize(), 300);
  // Extra safety net: automatically re-measure any time the map's container itself changes
  // size or becomes visible (tab switch, sidebar collapsing on mobile, on-screen keyboard,
  // window resize) instead of relying only on fixed delays above.
  if (window.ResizeObserver) {
    new ResizeObserver(() => gMap.invalidateSize()).observe(document.getElementById("gMap"));
  }
}
document.querySelector('[data-tab="post"]')?.addEventListener("click", () => {
  setTimeout(() => {
    initGigMap();
    // Also re-measure every time the tab is opened (not just the first time the
    // map is created), in case the layout shifted since then (window resize,
    // sidebar becoming a top-bar on mobile, keyboard opening/closing, etc.)
    gMap?.invalidateSize();
  }, 60);
});

function setPickedLocation(lat, lng, zoom) {
  pickedLat = lat; pickedLng = lng;
  if (gMarker) gMarker.remove();
  gMarker = L.marker([lat, lng]).addTo(gMap);
  gMap.setView([lat, lng], zoom || 12);
  $("#gLatLng").textContent = `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function showAccuracyCircle(lat, lng, accuracyMeters) {
  if (gAccuracyCircle) gAccuracyCircle.remove();
  gAccuracyCircle = L.circle([lat, lng], {
    radius: accuracyMeters, color: "#33d896", weight: 1, fillColor: "#33d896", fillOpacity: 0.08
  }).addTo(gMap);
}

async function searchGigLocation() {
  const q = $("#gLocationSearch")?.value.trim();
  if (!q) return;
  initGigMap();
  const btn = $("#gLocationSearchBtn");
  const oldLabel = btn.textContent;
  btn.textContent = "සොයමින්..."; btn.disabled = true;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=lk&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "si,en" } });
    const results = await res.json();
    if (!results.length) { window.toast?.("ප්‍රදේශය හමු වුනේ නැහැ, map එකෙන් click කර තෝරන්න"); return; }
    gMap?.invalidateSize();
    setPickedLocation(parseFloat(results[0].lat), parseFloat(results[0].lon), 13);
  } catch (err) {
    console.error(err);
    window.toast?.("Location සෙවීම අසාර්ථකයි, map එකෙන් click කර තෝරන්න");
  } finally {
    btn.textContent = oldLabel; btn.disabled = false;
  }
}
$("#gLocationSearchBtn")?.addEventListener("click", searchGigLocation);
$("#gLocationSearch")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); searchGigLocation(); } });

function useMyLocation() {
  if (!navigator.geolocation) { window.toast?.("මෙම browser එකේ location access support නැහැ"); return; }
  initGigMap();
  gMap?.invalidateSize(); // re-measure before placing the marker, so it lands correctly
  const btn = $("#gMyLocationBtn");
  const oldLabel = btn.textContent;
  btn.textContent = "සොයමින්..."; btn.disabled = true;

  // FIX: a single getCurrentPosition() call very often returns the browser's fast, low-accuracy
  // wifi/cell-tower estimate first — which can be hundreds of meters to a few km off, especially
  // indoors. That's what made the pin "not land in the right place". Instead we watch for a few
  // seconds and keep the most accurate fix that arrives (GPS fixes typically improve after the
  // first reading), updating the marker live as better fixes come in, and stop early once we
  // get a good (≤20m) fix so it doesn't feel slow outdoors.
  let bestAccuracy = Infinity;
  let watchId = null;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    btn.textContent = oldLabel; btn.disabled = false;
  };

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      if (accuracy <= bestAccuracy) {
        bestAccuracy = accuracy;
        gMap?.invalidateSize();
        setPickedLocation(latitude, longitude, 15);
        showAccuracyCircle(latitude, longitude, accuracy);
        $("#gLatLng").textContent = `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (± ${Math.round(accuracy)}m)`;
      }
      if (accuracy <= 20) finish();
    },
    (err) => {
      console.error(err);
      const msg = err.code === err.PERMISSION_DENIED
        ? "Location access allow කරලා නැහැ. Browser settings වලින් permission එක දෙන්න, නැත්නම් map එකෙන් හෝ search එකෙන් තෝරන්න."
        : "ඔබේ ස්ථානය සොයාගන්න බැරි වුනා. map එකෙන් හෝ search එකෙන් තෝරන්න.";
      window.toast?.(msg);
      finish();
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
  setTimeout(finish, 8000); // stop refining after 8s regardless, keeping the best fix found
}
$("#gMyLocationBtn")?.addEventListener("click", useMyLocation);

if (window.location.hash === "#post") {
  document.querySelector('[data-tab="post"]')?.click();
}

// ---- Auth guard ----
let currentUser = null, currentRole = "farmer";
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  currentUser = user;
  let stored = JSON.parse(localStorage.getItem("goviFirebaseUser") || "null");
  // Use the one-time saved profile from Firestore on repeat logins.
  try {
    const profileSnap = await getDoc(doc(db, "users", user.uid));
    if (profileSnap.exists()) {
      const profile = profileSnap.data();
      stored = { ...stored, ...profile, uid: user.uid, photoURL: user.photoURL || profile.photoURL || "" };
      localStorage.setItem("goviFirebaseUser", JSON.stringify(stored));
      localStorage.setItem("goviRole", stored.role || "farmer");
    }
  } catch (e) {
    console.warn("Could not load saved profile:", e);
  }
  currentRole = stored?.role || "farmer";
  const displayName = stored?.name || user.displayName || user.email || user.phoneNumber || "User";
  $("#dashName").textContent = displayName;
  const roleText = currentRole === "owner" ? "වයාපාරික / යන්ත්‍ර හිමිකරු" : currentRole === "admin" ? "Admin" : "ගොවියා";
  $("#roleLabel").textContent = roleText;
  if ($("#roleLabelSmall")) $("#roleLabelSmall").textContent = roleText;
  const avatarEl = $("#dashAvatar");
  if (avatarEl) {
    avatarEl.src = user.photoURL
      || `https://ui-avatars.com/api/?background=33d896&color=04140c&bold=true&name=${encodeURIComponent(displayName)}`;
    avatarEl.onerror = () => {
      avatarEl.onerror = null;
      avatarEl.src = `https://ui-avatars.com/api/?background=33d896&color=04140c&bold=true&name=${encodeURIComponent(displayName)}`;
    };
  }

  listenMyBookings(user.uid, (list) => {
    window.__myBookingsCache = list;
    $("#statBookings").textContent = list.length;
    $("#bookingList").innerHTML = list.length ? list.map(b => `
      <div class="list-item booking-item"><div><b>${b.gigTitle}</b><br><small>${b.date || "-"} · ${b.area || "-"}</small></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="status">${statusLabel(b.status)}</span>
        <button class="btn light" onclick="window.__trackBooking('${b.gigId}','${b.ownerId}')">📍 Machine Map</button>
        ${b.status==="pending"||b.status==="accepted" ? `<button class="btn" style="background:#3a1518;color:#ff8f8f" onclick="window.__cancelBooking('${b.id}')">Cancel</button>` : ""}
      </div>
      <div class="booking-tracker hidden" id="tracker-${b.id}"></div></div>`).join("") : `<div class="card">තවම booking එකක් නැහැ.</div>`;
  });

  listenMyGigs(user.uid, (list) => {
    myGigsCache = list;
    $("#statGigs").textContent = list.length;
    const now=Date.now();
    $("#myGigsList").innerHTML = list.length ? list.map(g => {
      const expired=g.status==="active" && g.expireDate && new Date(g.expireDate+"T23:59:59").getTime()<now;
      const shownStatus=expired?"expired":g.status;
      if(expired && !g.expiryNoticeSent){
        try{
          if(!localStorage.getItem("expiryNotice_"+g.id)){
            localStorage.setItem("expiryNotice_"+g.id,"1");
            notifyUser(user.uid,"gig_expired","Gig එක Expire වී ඇත",`"${g.title||"Gig"}" අදින් Expire වී ඇත. Payment proof එක upload කර දින 10කට Renew කරන්න.`,{gigId:g.id});
          }
        }catch(_){}
      }
      const renew=expired ? `<div class="renew-box"><b>⚠️ Gig එක Expire වී ඇත</b><small>Expire Date: ${g.expireDate}</small><input type="file" id="renew-${g.id}" accept="image/*"><button class="btn gold" onclick="window.__renewGig('${g.id}')">💳 Payment Proof දාලා දින 10ක් Renew කරන්න</button></div>`:"";
      return `<div class="list-item"><div><b>${g.title}</b><br><small>${categoryLabel(g.category)} · ${g.address || ""}${g.price ? ` · 💰 Rs.${g.price}` : ""}</small>${g.expireDate?`<br><small>⏳ Expire: ${g.expireDate}</small>`:""}${renew}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="status">${statusLabel(shownStatus)}</span>
      <button class="btn light" onclick="window.__editGig('${g.id}')">Edit</button>
      <button class="btn light" onclick="window.__deleteGig('${g.id}')">Delete</button></div></div>`;
    }).join("")
      : `<div class="card">තවම gig එකක් දාලා නැහැ. "Post a Gig" tab එකෙන් එකක් දාන්න.</div>`;
  });

  listenOrdersForOwner(user.uid, (list) => {
    window.__ownerBookings = list;
    $("#statOrders").textContent = list.filter(o => o.status === "pending").length;
    $("#ordersList").innerHTML = list.length ? list.map(o => `
      <div class="list-item"><div><b>${o.gigTitle}</b><br><small>👤 ${o.farmerName} · ${o.date || "-"} · ${o.area || "-"}</small></div>
      ${o.status === "pending" ? `<div style="display:flex;gap:7px">
        <button class="btn primary" onclick="window.__orderAction('${o.id}','accepted')">Accept</button>
        <button class="btn" style="background:#3a1518;color:#ff8f8f" onclick="window.__orderAction('${o.id}','rejected')">Reject</button>
      </div>` : `<div style="display:flex;gap:8px;align-items:center">
        <span class="status">${statusLabel(o.status)}</span>
        <button class="btn" style="background:#3a1518;color:#ff8f8f" onclick="window.__deleteBooking('${o.id}')">🗑️ Delete</button>
      </div>`}
      </div>`).join("") : `<div class="card">Order requests නැහැ.</div>`;
  });
});

function statusLabel(s) {
  return { pending: "Pending", active: "Active ✓", accepted: "Accepted ✓", rejected: "Rejected", 0: "-" }[s] || s || "-";
}
function categoryLabel(c) {
  return { ploughing: "🚜 සී සෑම", harvesting: "🌾 අස්වනු නෙලීම", extras: "🔧 අමතර සේවා" }[c] || c;
}

window.__orderAction = async (id, status) => {
  await setBookingStatus(id, status);
  window.toast?.(status === "accepted" ? "Order Accept කළා ✓" : "Order Reject කළා");
};
window.__deleteBooking = async (id) => {
  if (!confirm("මේ booking record එක ඉවත් කරන්නද?")) return;
  await deleteBooking(id);
  window.toast?.("Booking record එක ඉවත් කළා");
};
window.__renewGig = async (id) => {
  const f=document.getElementById("renew-"+id)?.files?.[0];
  if(!f) return alert("Payment receipt / proof photo එක upload කරන්න.");
  try{ await createRenewalRequest(id,f); window.toast?.("Renewal request Adminට යැව්වා ✓"); }catch(e){alert(e.message);}
};
window.__deleteGig = async (id) => {
  if (!confirm("මේ gig එක ඉවත් කරන්නද?")) return;
  await deleteGig(id);
  window.toast?.("Gig එක ඉවත් කළා");
};

window.__editGig = (id) => {
  const g = myGigsCache.find(x => x.id === id);
  if (!g) return;
  editingGigId = id;
  document.querySelector('[data-tab="post"]')?.click();
  setTimeout(() => {
    initGigMap();
    $("#gCategory").value = g.category || "ploughing";
    syncCategoryFields();
    if (g.category === "extras") $("#gSub").value = g.subCategory || "accommodation";
    else { $("#gMachineType").value = g.machineType || "4-Wheel Tractor"; $("#gMachineNo").value = g.machineNumber || ""; }
    $("#gTitle").value = g.title || "";
    $("#gPrice").value = g.price ?? "";
    $("#gName").value = g.ownerName || "";
    $("#gNic").value = g.nic || "";
    $("#gPhone1").value = g.phone1 || "";
    $("#gPhone2").value = g.phone2 || "";
    $("#gAddress").value = g.address || "";
    $("#gDate").value = g.availableDate || "";
    $("#gReceipt").required = false;
    if (typeof g.lat === "number" && typeof g.lng === "number") {
      pickedLat = g.lat; pickedLng = g.lng;
      if (gMarker) gMarker.remove();
      if (gMap) { gMarker = L.marker([pickedLat, pickedLng]).addTo(gMap); gMap.setView([pickedLat, pickedLng], 12); }
      $("#gLatLng").textContent = `📍 ${pickedLat.toFixed(4)}, ${pickedLng.toFixed(4)}`;
    }
    $("#gigSubmitBtn").textContent = "වෙනස්කම් Save කරන්න";
    $("#gigCancelEditBtn").hidden = false;
  }, 80);
};

function exitEditMode() {
  editingGigId = null;
  $("#gReceipt").required = true;
  $("#gigSubmitBtn").textContent = "Gig එක Submit කරන්න (Admin review සඳහා)";
  $("#gigCancelEditBtn").hidden = true;
}
$("#gigCancelEditBtn")?.addEventListener("click", () => {
  document.getElementById("gigForm")?.reset();
  pickedLat = pickedLng = null;
  if (gMarker) { gMarker.remove(); gMarker = null; }
  if (gAccuracyCircle) { gAccuracyCircle.remove(); gAccuracyCircle = null; }
  $("#gLatLng").textContent = "Location එකක් තෝරා නැත";
  exitEditMode();
});

// ---- Submit gig form ----
document.getElementById("gigForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("ඔබේ login state එක load වෙනතුරු මඳක් ඉඳලා ආයෙත් try කරන්න.");
  const cat = $("#gCategory").value;
  if (pickedLat === null) return alert("කරුණාකර map එකේ location එකක් click කරන්න");
  const payload = {
    category: cat,
    subCategory: cat === "extras" ? $("#gSub").value : "",
    machineType: cat !== "extras" ? $("#gMachineType").value : "",
    machineNumber: cat !== "extras" ? $("#gMachineNo").value : "",
    title: $("#gTitle").value,
    price: $("#gPrice").value ? Number($("#gPrice").value) : null,
    ownerName: $("#gName").value,
    nic: $("#gNic").value,
    phone1: $("#gPhone1").value,
    phone2: $("#gPhone2").value,
    address: $("#gAddress").value,
    availableDate: $("#gDate").value,
    lat: pickedLat, lng: pickedLng
  };
  const photos = Array.from($("#gPhotos").files || []);
  const receipt = $("#gReceipt").files?.[0] || null;
  if (!editingGigId) {
    if (!receipt) {
      return alert("කරුණාකර ඉහත පෙන්වන Gig Listing Fee සඳහා bank receipt එක අප්ලෝඩ් කරන්න (සියලුම සේවා සඳහා අනිවාර්යයි)");
    }
    if (cat !== "extras" && photos.length < 2) return alert("කරුණාකර අවම වශයෙන් ඡායාරූප 2ක් උඩුගත කරන්න");
  }
  try {
    if (editingGigId) {
      await updateGig(editingGigId, payload, photos, receipt);
      window.toast?.("Gig එක Update කළා ✓");
    } else {
      await createGig(payload, photos, receipt);
      window.toast?.("Gig එක Admin review සඳහා යැව්වා ✓");
    }
    e.target.reset();
    pickedLat = pickedLng = null;
    $("#gLatLng").textContent = "Location එකක් තෝරා නැත";
    if (gMarker) { gMarker.remove(); gMarker = null; }
    if (gAccuracyCircle) { gAccuracyCircle.remove(); gAccuracyCircle = null; }
    exitEditMode();
  } catch (err) {
    console.error(err);
    alert("Gig submit වෙන්නේ නැහැ: " + err.message);
  }
});

// ---------- Notifications + Admin live chat ----------
let notificationCache=[];
function setupNotifications(uid){
  listenMyNotifications(uid,list=>{notificationCache=list;showNotifications(list,$("#notificationsList"));});
}
function setupDashboardChat(uid){
  listenAdminChat(uid,msgs=>renderChatMessages($("#dashChatMessages"),msgs));
}
document.getElementById("dashChatForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const text=$("#dashChatText")?.value.trim()||"";
  if(!text && !$("#dashChatPhoto")?.files?.[0]) return;
  try{
    // Chat photos use the same Cloudinary unsigned preset as gigs.
    let imageUrl="";
    const file=$("#dashChatPhoto")?.files?.[0];
    if(file){
      const fd=new FormData();fd.append("file",file);fd.append("upload_preset","p0luehws");fd.append("folder",`chat/${currentUser.uid}`);
      const r=await fetch("https://api.cloudinary.com/v1_1/favfuhcn/image/upload",{method:"POST",body:fd});const d=await r.json();
      if(!r.ok) throw new Error(d.error?.message||"Photo upload failed"); imageUrl=d.secure_url;
    }
    await sendAdminMessage(text,imageUrl);$("#dashChatText").value="";$("#dashChatPhoto").value="";
  }catch(err){alert("Chat message යැවීම අසාර්ථකයි: "+err.message);}
});
document.getElementById("dashChatPhotoBtn")?.addEventListener("click",()=>$("#dashChatPhoto")?.click());

// ---------- Today Works / live tracking ----------
let todayMap=null,todayMarker=null,todayLat=null,todayLng=null,todayWorkId=null,todayStopFn=null;
function initTodayMap(){
  if(todayMap||typeof L==="undefined") return;
  todayMap=L.map("todayMap").setView([7.8731,80.7718],8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(todayMap);
  todayMap.on("click",e=>setTodayPin(e.latlng.lat,e.latlng.lng));
  setTimeout(()=>todayMap.invalidateSize(),100);
}
function setTodayPin(lat,lng){
  todayLat=lat;todayLng=lng;initTodayMap();if(todayMarker)todayMarker.remove();
  todayMarker=L.marker([lat,lng]).addTo(todayMap);todayMap.setView([lat,lng],14);
  $("#todayCoords").textContent=`📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
function fillTodayBookings(){
  const sel=$("#todayBooking");if(!sel)return;
  const list=window.__ownerBookings||[];
  sel.innerHTML='<option value="">Booking එකක් තෝරන්න</option>'+list.map(b=>`<option value="${b.id}">${b.farmerName||"ගොවියා"} — ${b.gigTitle}</option>`).join("");
  sel.onchange=()=>{const b=list.find(x=>x.id===sel.value);if(b)$("#todayFarmerName").value=b.farmerName||"";};
}
function setupTodayWorks(uid){
  listenOrdersForOwner(uid,list=>{window.__ownerBookings=list.filter(b=>b.status==="accepted");fillTodayBookings();});
  listenTodayWorksForOwner(uid,list=>{
    $("#todayWorksList").innerHTML=list.length?list.map(w=>`<div class="list-item"><div><b>${w.farmerName||"-"}</b><br><small>${w.locationName||"Today Work"} · ${w.lat?.toFixed?.(5)||"-"}, ${w.lng?.toFixed?.(5)||"-"}</small></div><div><span class="status">${w.active?"🟢 Live":"Stopped"}</span>${w.active?` <button class="btn light" onclick="window.__stopToday('${w.id}')">Stop</button>`:""}</div></div>`).join(""):"<div class='card'>අද වැඩක් තවම දාලා නැහැ.</div>";
  });
}
document.querySelector('[data-tab="today"]')?.addEventListener("click",()=>setTimeout(initTodayMap,60));
document.getElementById("todayPinBtn")?.addEventListener("click",()=>{initTodayMap();todayMap?.invalidateSize();});
document.getElementById("todayLiveBtn")?.addEventListener("click",()=>{
  try{
    if(todayStopFn) todayStopFn();
    todayStopFn=startLiveLocation((lat,lng)=>{
      setTodayPin(lat,lng);
      $("#todayCoords").textContent=`📍 LIVE ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      // Keep the saved Today Work document updated so the farmer sees the moving location.
      if (todayWorkId && currentUser?.uid) {
        clearTimeout(window.__todayLocationSaveTimer);
        window.__todayLocationSaveTimer=setTimeout(async()=>{
          try {
            await saveTodayWork({
              id: todayWorkId,
              lat, lng,
              active: true
            });
          } catch (err) {
            console.warn("Live location update failed:", err);
          }
        }, 1500);
      }
    }, (err)=>{
      const msg = err?.code===1
        ? "Location permission Allow කරන්න. Browser settings වලින් Location access එකත් check කරන්න."
        : err?.code===2
          ? "Current location ලබාගන්න බැරි වුණා. GPS/Location ON කරලා නැවත උත්සාහ කරන්න."
          : "Live Location ලබාගැනීමට කාලය ඉක්මවා ගියා. නැවත උත්සාහ කරන්න.";
      window.toast?.(msg);
      $("#todayCoords").textContent="Location එක ලබාගත නොහැක";
    });
    window.toast?.("Live Location started ✓");
  }catch(e){alert(e.message);}
});
document.getElementById("todayStopBtn")?.addEventListener("click",()=>{
  stopLiveLocation();
  if(todayStopFn)todayStopFn();
  todayStopFn=null;
  clearTimeout(window.__todayLocationSaveTimer);
  window.toast?.("Live location stopped");
});
document.getElementById("todaySaveBtn")?.addEventListener("click",async()=>{
  const bookingId=$("#todayBooking")?.value;
  const b=(window.__ownerBookings||[]).find(x=>x.id===bookingId);
  if(!bookingId||!b) return alert("අද වැඩ කරන booking එක තෝරන්න.");
  if(todayLat==null) return alert("Live Location හෝ map pin එකක් දාන්න.");
  try{
    const r=await saveTodayWork({id:`${currentUser.uid}_${b.id}`,gigId:b.gigId,bookingId:b.id,farmerId:b.farmerId,farmerName:$("#todayFarmerName").value||b.farmerName,locationName:$("#todayLocationName").value||b.area,lat:todayLat,lng:todayLng,active:true});
    todayWorkId=r?.id||`${currentUser.uid}_${b.id}`;window.toast?.("Today Work save කළා ✓");
  }catch(e){alert("Save අසාර්ථකයි: "+e.message);}
});
window.__stopToday=async(id)=>{try{await stopTodayWork(id);window.toast?.("Today Work stop කළා");}catch(e){alert(e.message);}};

// Tracking display for farmer bookings: open a live map from todayWorks.
window.__trackBooking=async(gigId,ownerId)=>{
  const b=(window.__myBookingsCache||[]).find(x=>x.gigId===gigId&&x.ownerId===ownerId);
  if(!b)return;
  const box=document.getElementById("tracker-"+b.id);if(!box)return;
  box.classList.remove("hidden");box.innerHTML='<div class="map" style="height:260px"></div><small class="muted">Live location load වෙමින්...</small>';
  const mapEl=box.querySelector(".map");const m=L.map(mapEl).setView([7.8731,80.7718],8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(m);
  let marker=null;
  const {listenTodayWorkForBooking}=await import("./tracking.js");
  listenTodayWorkForBooking(gigId,ownerId,works=>{
    const w=works[0];if(!w)return;
    if(marker)marker.remove();marker=L.marker([w.lat,w.lng]).addTo(m).bindPopup(`<b>🚜 ${w.farmerName||"Today Work"}</b><br>${w.locationName||""}<br>Last update: ${w.updatedAt?.toDate?w.updatedAt.toDate().toLocaleString("si-LK"):"Live"}`).openPopup();
    m.setView([w.lat,w.lng],15);box.querySelector("small").textContent="🟢 Live location update වෙනවා.";
  });
};
window.__cancelBooking=async(id)=>{if(!confirm("මේ booking එක cancel කරන්නද?"))return;try{await setBookingStatus(id,"cancelled");window.toast?.("Booking එක cancel කළා ✓");}catch(e){alert(e.message);}};

// Extend auth callback by initializing these after currentUser is assigned.
const originalAuthSetup = onAuthStateChanged;
onAuthStateChanged(auth,(user)=>{if(user){setupNotifications(user.uid);setupDashboardChat(user.uid);setupTodayWorks(user.uid);}});

document.getElementById("downloadBookingsPdf")?.addEventListener("click",()=>{
  const list=window.__ownerBookings||[];
  if(!list.length)return alert("Booking records නැහැ.");
  if(!window.html2pdf)return alert("PDF library load වෙලා නැහැ. Internet connection එක check කරන්න.");
  const wrap=document.createElement("div");wrap.style.padding="25px";wrap.style.fontFamily="Arial,sans-serif";
  wrap.innerHTML=`<h1>Govi Netha — Booking Report</h1><p>Service Provider: ${currentUser?.displayName||currentUser?.email||""}</p>
  <table style="width:100%;border-collapse:collapse"><thead><tr><th style="border:1px solid #999;padding:7px">Farmer</th><th style="border:1px solid #999;padding:7px">Phone</th><th style="border:1px solid #999;padding:7px">Service</th><th style="border:1px solid #999;padding:7px">Date</th><th style="border:1px solid #999;padding:7px">Area</th><th style="border:1px solid #999;padding:7px">Status</th></tr></thead><tbody>
  ${list.map(b=>`<tr><td style="border:1px solid #999;padding:7px">${b.farmerName||""}</td><td style="border:1px solid #999;padding:7px">${b.farmerPhone||""}</td><td style="border:1px solid #999;padding:7px">${b.gigTitle||""}</td><td style="border:1px solid #999;padding:7px">${b.date||""}</td><td style="border:1px solid #999;padding:7px">${b.area||""}</td><td style="border:1px solid #999;padding:7px">${b.status||""}</td></tr>`).join("")}</tbody></table>`;
  document.body.appendChild(wrap);
  html2pdf().set({margin:8,filename:"govi-netha-bookings.pdf",image:{type:"jpeg",quality:.95},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"landscape"}}).from(wrap).save().then(()=>wrap.remove()).catch(()=>wrap.remove());
});
