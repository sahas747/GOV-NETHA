import { auth } from "./firebase-config.js";
import { listenActiveGigs, createBooking } from "./gigs.js";

const $ = (s) => document.querySelector(s);
let map, markers = [], allGigs = [], userMarker = null, userAccuracy = null, userLat = null, userLng = null;

function categoryLabel(c) {
  return { ploughing: "සී සෑම", harvesting: "අස්වනු නෙලීම", extras: "අමතර සේවා" }[c] || c;
}
function subCategoryLabel(c) {
  return {
    accommodation: "🏠 නවාතැන් පහසුකම්",
    food: "🍛 ආහාර පාන",
    fuel: "⛽ ඉංධන වෙළදාම",
    parts: "⚙️ අමතර කොටස් (ටැක්ටර් / හාවේස්ටර්)",
    mechanic: "🔧 මැකෑනික් සේවා"
  }[c] || c || "";
}

function cardHtml(g) {
  const carouselId = `car-${g.id}`;
  return `<div class="service-card">
    <div class="row"><span class="tag">${categoryLabel(g.category)}</span></div>
    ${window.gigCarouselHtml ? window.gigCarouselHtml(g.photos, carouselId, '170px') : ""}
    <h3>${g.title}</h3>
    <p>${g.category === "extras" ? subCategoryLabel(g.subCategory) : (g.machineType || "")}</p>
    <small>👤 ${g.ownerName} · 📞 ${g.phone1}<br>📍 ${g.address}${g.price ? `<br>💰 Rs. ${g.price}` : ""}</small>
    <div style="margin-top:13px;display:flex;gap:8px">
      <button class="btn primary" onclick="window.__openBooking('${g.id}')">Booking කරන්න</button>
      <button class="btn light" onclick="window.__focusGig('${g.id}')">Map එකේ බලන්න</button>
    </div>
  </div>`;
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function renderList(list) {
  const el = $("#results");
  const ordered = userLat == null ? list : [...list].sort((a,b) => {
    const da = a.lat == null ? Infinity : distanceKm(userLat,userLng,a.lat,a.lng);
    const db = b.lat == null ? Infinity : distanceKm(userLat,userLng,b.lat,b.lng);
    return da-db;
  });
  if (el) el.innerHTML = ordered.length ? ordered.map(g => {
    const km = userLat != null && g.lat != null ? `<br>📏 ${distanceKm(userLat,userLng,g.lat,g.lng).toFixed(1)} km ඔබෙන්` : "";
    return cardHtml(g).replace('</small>', `${km}</small>`);
  }).join("") : `<div class="card">තවම gigs දාලා නැහැ. පස්සේ try කරන්න.</div>`;
}

function initMap() {
  const el = $("#map");
  if (!el || typeof L === "undefined" || map) return;
  map = L.map(el).setView([7.8731, 80.7718], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);
}

function renderMap(list) {
  if (!map) return;
  markers.forEach(m => m.remove()); markers = [];
  list.forEach(g => {
    if (g.lat == null) return;
    const m = L.marker([g.lat, g.lng]).addTo(map);
    m.__goviGigId = g.id;
    m.bindPopup(`<b>${g.title}</b><br>${g.address}<br>${g.ownerName}<br><button class="btn primary" style="margin-top:7px" onclick="window.__openBooking('${g.id}')">Booking</button>`);
    markers.push(m);
  });
}


function useMyServiceLocation() {
  if (!navigator.geolocation) return window.toast?.("මෙම browser එකේ location support නැහැ");
  const btn = $("#serviceMyLocationBtn"); if (btn) { btn.disabled=true; btn.textContent="📍 සොයමින්..."; }
  navigator.geolocation.getCurrentPosition(pos => {
    userLat=pos.coords.latitude; userLng=pos.coords.longitude;
    if (userMarker) userMarker.remove();
    userMarker=L.marker([userLat,userLng]).addTo(map).bindPopup("<b>📍 ඔබේ වත්මන් ස්ථානය</b>").openPopup();
    if (userAccuracy) userAccuracy.remove();
    userAccuracy=L.circle([userLat,userLng],{radius:Math.min(pos.coords.accuracy||50,300),weight:1,fillOpacity:.06}).addTo(map);
    map.setView([userLat,userLng],14);
    renderList(allGigs);
    if (btn) { btn.disabled=false; btn.textContent="📍 මගේ ස්ථානය"; }
  }, err => {
    if (btn) { btn.disabled=false; btn.textContent="📍 මගේ ස්ථානය"; }
    window.toast?.(err.code===1 ? "Location permission allow කරන්න." : "Location එක ලබාගන්න බැරි වුණා.");
  }, {enableHighAccuracy:true,timeout:12000,maximumAge:30000});
}
$("#serviceMyLocationBtn")?.addEventListener("click", useMyServiceLocation);

window.__focusGig = (id) => {
  const g = allGigs.find(x => x.id === id);
  if (!g || !map || g.lat == null) return;
  map.setView([g.lat, g.lng], 12);
  const marker = markers.find(m => m.__goviGigId === id);
  marker?.openPopup();
};

window.__openBooking = (id) => {
  if (!auth.currentUser) { alert("Booking කරන්න මුලින්ම Login වෙන්න."); window.location.href = (location.pathname.includes("/pages/") ? "../login.html" : "login.html"); return; }
  const g = allGigs.find(x => x.id === id);
  if (!g) return;
  $("#bookingGig") && ($("#bookingGig").value = g.title);
  $("#bookingId") && ($("#bookingId").value = id);
  openModal("bookingModal");
};

document.getElementById("bookingForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#bookingId").value;
  const g = allGigs.find(x => x.id === id);
  if (!g || !auth.currentUser) return;
  try {
    await createBooking(g, auth.currentUser, $("#bookDate").value, $("#bookArea").value);
    closeModal("bookingModal");
    window.toast?.("Booking request එක සාර්ථකව යැව්වා ✓ Machine owner ට notification එකක් ගියා.");
  } catch (err) {
    console.error(err);
    alert("Booking යැවීම අසාර්ථකයි: " + err.message);
  }
});

export function setupServicePage(category) {
  initMap();
  listenActiveGigs(category, (list) => {
    allGigs = list;
    renderList(list);
    renderMap(list);
  });
  const search = $("#serviceSearch"), area = $("#areaFilter"), sub = $("#subFilter");
  const savedSearch = localStorage.getItem("goviSearch") || "";
  if (search && savedSearch) search.value = savedSearch;
  const params = new URLSearchParams(location.search);
  if (sub && params.get("sub")) sub.value = params.get("sub");
  const apply = () => {
    const q = (search?.value || "").toLowerCase().trim();
    const a = area?.value || "";
    const sc = sub?.value || "";
    const filtered = allGigs.filter(x =>
      (!q || `${x.title} ${x.ownerName} ${x.address} ${x.nic || ""} ${subCategoryLabel(x.subCategory)}`.toLowerCase().includes(q)) &&
      (!a || (x.address || "").includes(a)) &&
      (!sc || x.subCategory === sc)
    );
    renderList(filtered);
    renderMap(filtered);
  };
  search?.addEventListener("input", apply);
  $("#serviceSearchBtn")?.addEventListener("click", apply);
  area?.addEventListener("change", apply);
  sub?.addEventListener("change", apply);
  apply();
}
window.setupServicePage = setupServicePage;
