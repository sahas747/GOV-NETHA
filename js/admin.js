import { auth, onAuthStateChanged } from "./firebase-config.js";
import { db } from "./firebase-config.js";
import { collection, onSnapshot, updateDoc, doc, getDocs, query, where, deleteDoc, serverTimestamp, addDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { listenAllGigs, setGigStatus, deleteGig, listenAllBookings, approveRenewal } from "./gigs.js";
import { createAd, deleteAd, setAdActive, setAdMuted, updateAdSchedule, listenAllAdsAdmin } from "./ads.js";
import { listenSiteStats, saveSiteStats, listenSiteContent, saveSiteContent, DEFAULT_SITE_CONTENT, saveListingFee, listenSocialSettings, saveSocialSettings, DEFAULT_SOCIAL } from "./settings.js";
import { listenAllUsers } from "./users.js";
import { listenChatThreads, listenAdminChat, sendAdminReply, renderChatMessages, updateChatMessage, deleteChatMessage, deleteAllChatMessages } from "./chat.js";

const ADMIN_EMAILS = ["slfilepodda1@gmail.com"];
const $ = (s) => document.querySelector(s);

// ---------- Sidebar tab switching (Overview / සියලුම Data Base) ----------
// This was missing entirely before, so clicking "🗄️ සියලුම Data Base" in the sidebar did
// nothing — the tab markup existed in admin.html but nothing ever showed it.
document.querySelectorAll(".side-link[data-tab]").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".side-link[data-tab]").forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
    document.getElementById("tab-" + link.dataset.tab)?.classList.remove("hidden");
  });
});

onAuthStateChanged(auth, (user) => {
  if (!user || !ADMIN_EMAILS.includes((user.email || "").toLowerCase())) {
    window.location.href = "login.html";
    return;
  }
  listenAllGigs((list) => { renderGigs(list); gigsCache = list; renderDatabaseTables(); });
  listenAllAdsAdmin(renderAds);
  listenSiteStats(fillStatsForm);
  listenSiteContent(fillContentForm);
  listenAllBookings((list) => { bookingsCache = list; renderDatabaseTables(); });
  listenAllUsers((list) => { usersCache = list; renderDatabaseTables(); });
  setupAdminChat();
document.getElementById("adminChatDeleteAll")?.addEventListener("click",async()=>{if(!activeChatUid)return alert("User chat එකක් තෝරන්න.");if(!confirm("මෙම userගේ සියලුම chat messages delete කරන්නද?"))return;try{await deleteAllChatMessages(activeChatUid);window.toast?.("සියලුම messages delete කළා ✓");}catch(e){alert(e.message);}});
  });

// ---------- Homepage stats ----------
let statsFormTouched = false;
["stUsers", "stServices", "stAreas", "stSupport"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", () => { statsFormTouched = true; });
});

function fillStatsForm(s) {
  // Don't overwrite what the admin is currently typing when a live update arrives.
  if (statsFormTouched) return;
  if ($("#stUsers")) $("#stUsers").value = s.users;
  if ($("#stServices")) $("#stServices").value = s.services;
  if ($("#stAreas")) $("#stAreas").value = s.areas;
  if ($("#stSupport")) $("#stSupport").value = s.support;
}

document.getElementById("statsForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#statsSubmitBtn");
  const oldLabel = btn.textContent;
  btn.disabled = true; btn.textContent = "Save වෙමින්...";
  try {
    await saveSiteStats({
      users: $("#stUsers").value.trim() || "1,250+",
      services: $("#stServices").value.trim() || "380+",
      areas: $("#stAreas").value.trim() || "25+",
      support: $("#stSupport").value.trim() || "24/7"
    });
    statsFormTouched = false;
    window.toast?.("මුල් පිටුවේ සංඛ්‍යා Update කළා ✓");
  } catch (err) {
    console.error(err);
    alert("Save වීම අසාර්ථකයි: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = oldLabel;
  }
});

function categoryLabel(c) {
  return { ploughing: "🚜 සී සෑම", harvesting: "🌾 අස්වනු නෙලීම", extras: "🔧 අමතර සේවා" }[c] || c;
}

// ---------- Homepage About / Creators text ----------
let contentFormTouched = false;
["cnAbout", "cnCreators"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", () => { contentFormTouched = true; });
});

function fillContentForm(c) {
  // Don't overwrite what the admin is currently typing when a live update arrives.
  if (contentFormTouched) return;
  if ($("#cnAbout")) $("#cnAbout").value = c.aboutText;
  if ($("#cnCreators")) $("#cnCreators").value = c.creatorsText;
}

document.getElementById("contentForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#contentSubmitBtn");
  const oldLabel = btn.textContent;
  btn.disabled = true; btn.textContent = "Save වෙමින්...";
  try {
    await saveSiteContent({
      aboutText: $("#cnAbout").value.trim() || DEFAULT_SITE_CONTENT.aboutText,
      creatorsText: $("#cnCreators").value.trim() || DEFAULT_SITE_CONTENT.creatorsText
    });
    contentFormTouched = false;
    window.toast?.("මුල් පිටුවේ අන්තර්ගතය Update කළා ✓");
  } catch (err) {
    console.error(err);
    alert("Save වීම අසාර්ථකයි: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = oldLabel;
  }
});

// ---------- Gig listing fee ----------
let feeFormTouched = false;
document.getElementById("listingFee")?.addEventListener("input", () => { feeFormTouched = true; });
function fillListingFee(s) {
  if (!feeFormTouched && $("#listingFee")) $("#listingFee").value = Number(s.listingFee ?? 150);
}
listenSiteStats(fillListingFee);
document.getElementById("feeForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#feeSubmitBtn");
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = "Save වෙමින්...";
  try {
    const value = Math.max(0, Math.round(Number($("#listingFee").value || 0)));
    await saveListingFee(value);
    feeFormTouched = false;
    window.toast?.(`Gig ගාස්තුව රු.${value} ලෙස Update කළා ✓`);
  } catch (err) {
    console.error(err);
    alert("ගාස්තුව Save වීම අසාර්ථකයි: " + err.message);
  } finally { btn.disabled = false; btn.textContent = old; }
});

// ---------- Database tab (Customer / Vendor / Extras / Users — real-time, searchable) ----------
let gigsCache = [], bookingsCache = [], usersCache = [];

function fmtDateTime(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
    if (!d || isNaN(d.getTime())) return { date: "-", time: "-" };
    return {
      date: d.toLocaleDateString("si-LK"),
      time: d.toLocaleTimeString("si-LK", { hour: "2-digit", minute: "2-digit" })
    };
  } catch (_) {
    return { date: "-", time: "-" };
  }
}

function hay(...parts) { return parts.filter(Boolean).join(" ").toLowerCase(); }
function matches(text, q) { return !q || text.includes(q); }
function gigById(id) { return gigsCache.find(g => g.id === id); }
function escapeHtml(s) {
  return String(s ?? "-").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderDatabaseTables() {
  const q = ($("#dbSearch")?.value || "").trim().toLowerCase();

  // 📥 Booking Records — Customer (ගොවියන්) Database
  const bookingRows = bookingsCache.filter(b => {
    const g = gigById(b.gigId) || {};
    return matches(hay(b.farmerName, b.farmerPhone, b.area, g.ownerName, g.machineNumber, g.nic), q);
  });
  const bTbody = document.querySelector("#tblBookings tbody");
  if (bTbody) {
    bTbody.innerHTML = bookingRows.length ? bookingRows.map(b => {
      const g = gigById(b.gigId) || {};
      const dt = fmtDateTime(b.createdAt);
      return `<tr><td>${dt.date}</td><td>${dt.time}</td><td>${g.price ? "Rs." + g.price : "-"}</td>
        <td>${escapeHtml(g.ownerName)}</td><td>${escapeHtml(g.machineNumber)}</td>
        <td>${escapeHtml(b.farmerName)}</td><td>${escapeHtml(b.farmerPhone)}</td>
        <td><span class="status">${escapeHtml(b.status)}</span></td></tr>`;
    }).join("") : `<tr><td colspan="8" class="empty-row">${q ? "සෙවීමට ගැලපෙන දත්ත නැත" : "තවම booking record නැහැ"}</td></tr>`;
  }

  // 🚜 Vendor / Gig Records — ව්‍යාපාරිකයන් Database (ploughing + harvesting)
  const gigRows = gigsCache.filter(g => g.category !== "extras" && matches(hay(g.ownerName, g.nic, g.address, g.phone1, g.machineNumber), q));
  const gTbody = document.querySelector("#tblGigs tbody");
  if (gTbody) {
    gTbody.innerHTML = gigRows.length ? gigRows.map(g => {
      const dt = fmtDateTime(g.createdAt);
      return `<tr><td>${dt.date}</td><td>${dt.time}</td><td>${g.price ? "Rs." + g.price : "-"}</td>
        <td>${escapeHtml(g.address)}</td><td>${escapeHtml(g.ownerName)}</td><td>${escapeHtml(g.nic)}</td>
        <td><span class="status">${escapeHtml(g.status)}</span></td></tr>`;
    }).join("") : `<tr><td colspan="7" class="empty-row">${q ? "සෙවීමට ගැලපෙන දත්ත නැත" : "තවම gig record නැහැ"}</td></tr>`;
  }

  // 🔧 Extra Services Records
  const extraRows = gigsCache.filter(g => g.category === "extras" && matches(hay(g.ownerName, g.nic, g.address, g.phone1), q));
  const eTbody = document.querySelector("#tblExtras tbody");
  if (eTbody) {
    eTbody.innerHTML = extraRows.length ? extraRows.map(g => {
      const dt = fmtDateTime(g.createdAt);
      return `<tr><td>${dt.date}</td><td>${dt.time}</td><td>${g.price ? "Rs." + g.price : "-"}</td>
        <td>${escapeHtml(g.ownerName)}</td><td>${escapeHtml(g.nic)}</td>
        <td><span class="status">${escapeHtml(g.status)}</span></td></tr>`;
    }).join("") : `<tr><td colspan="6" class="empty-row">${q ? "සෙවීමට ගැලපෙන දත්ත නැත" : "තවම extra service record නැහැ"}</td></tr>`;
  }

  // 👤 Admin / Users Database
  const userRows = usersCache.filter(u => matches(hay(u.name, u.email, u.phone), q));
  const uTbody = document.querySelector("#tblUsers tbody");
  if (uTbody) {
    uTbody.innerHTML = userRows.length ? userRows.map(u => {
      const dt = fmtDateTime(u.createdAt || u.updatedAt);
      return `<tr><td>${dt.date}</td><td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email || u.phone)}</td><td>${escapeHtml(u.role)}</td>
<td><button class="btn danger" onclick="window.__deactivateAccount('${u.id}')">🚫 Deactivate & Delete</button></td></tr>`;
    }).join("") : `<tr><td colspan="4" class="empty-row">${q ? "සෙවීමට ගැලපෙන දත්ත නැත" : "තවම user record නැහැ"}</td></tr>`;
  }
}
$("#dbSearch")?.addEventListener("input", renderDatabaseTables);

// 🔎 Fraud-case proof: export any of the 4 tables (exactly what's currently on screen,
// including an active search filter) as a CSV file the admin can save/print/attach.
window.__exportTableCsv = (tableId, filename) => {
  const table = document.getElementById(tableId);
  if (!table) return;
  const rows = Array.from(table.querySelectorAll("tr")).map(tr =>
    Array.from(tr.children).map(cell => `"${(cell.textContent || "").replace(/"/g, '""')}"`).join(",")
  );
  const csv = "\uFEFF" + rows.join("\r\n"); // BOM so Sinhala text opens correctly in Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  window.toast?.("CSV එක බාගත කළා ✓");
};

function renderGigs(list) {
  $("#statTotal").textContent = list.length;
  $("#statActive").textContent = list.filter(g => g.status === "active").length;
  const pending = list.filter(g => g.status === "pending");
  $("#statPending").textContent = pending.length;

  $("#pendingList").innerHTML = pending.length ? pending.map(g => `
    <div class="list-item">
      <div><b>${g.title || g.ownerName}</b><br>
      <small>${categoryLabel(g.category)} · Owner: ${g.ownerName} · 📞 ${g.phone1 || "-"}</small>
      ${g.receiptPhoto ? `<br><a href="${g.receiptPhoto}" target="_blank" style="font-size:12px;color:#33d896">📄 Bank Receipt බලන්න</a>` : `<br><small style="color:#ff8f8f">Receipt upload කරලා නැහැ</small>`}
      </div>
      <div style="display:flex;gap:7px">
        <button class="btn light" onclick="window.__viewGig('${g.id}')">View</button>
        <button class="btn primary" onclick="window.__gigAction('${g.id}','active')">Approve</button>
        <button class="btn" style="background:#3a1518;color:#ff8f8f" onclick="window.__gigAction('${g.id}','rejected')">Reject</button>
        <button class="btn" style="background:#3a1518;color:#ff8f8f" onclick="window.__adminDeleteGig('${g.id}')">🗑️ Delete</button>
      </div>
    </div>`).join("") : `<div class="card">Approval වලට ඉතිරි gigs නැහැ 🎉</div>`;

  $("#allList").innerHTML = list.length ? list.map(g => `
    <div class="list-item"><div><b>${g.title || g.ownerName}</b><br><small>${categoryLabel(g.category)} · ${g.ownerName}</small></div>
    <div style="display:flex;gap:8px;align-items:center">
      <span class="status">${g.status}</span>
      <button class="btn light" onclick="window.__viewGig('${g.id}')">View</button>
      <button class="btn" style="background:#3a1518;color:#ff8f8f" onclick="window.__adminDeleteGig('${g.id}')">🗑️ Delete</button>
    </div></div>`).join("") : "";

  window.__gigsCache = list;
}

window.__adminDeleteGig = async (id) => {
  if (!confirm("මේ gig එක permanent ලෙස ඉවත් කරන්නද? මේක undo කරන්න බැහැ.")) return;
  await deleteGig(id);
  window.toast?.("Gig එක ඉවත් කළා");
};

window.__gigAction = async (id, status) => {
  let expire="";
  if(status==="active"){
    const d=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
    expire=prompt("Expire Date එක තෝරන්න (YYYY-MM-DD). Default දින 10යි:",d);
    if(!expire) return;
  }
  await setGigStatus(id, status, expire);
  window.toast?.(status === "active" ? `Gig එක Approve කළා ✓ — ${expire}` : "Gig එක Reject කළා");
};




// ---------- Account Deactivation / Data Erase ----------
window.__deactivateAccount = async (uid) => {
  if(uid===auth.currentUser?.uid) return alert("ඔබගේ Admin account එක මෙතැනින් delete කරන්න බැහැ.");
  if(!confirm("මෙම account එක deactivate කර සියලුම Govi-Netha data delete කරන්නද? Undo කළ නොහැක.")) return;
  const collections=["gigs","bookings","notifications","todayWorks"];
  for(const c of collections){
    const snap=await getDocs(query(collection(db,c),where(c==="gigs"?"ownerId":c==="bookings"?"farmerId":"userId","==",uid)));
    await Promise.all(snap.docs.map(d=>deleteDoc(d.ref)));
  }
  const owned=await getDocs(query(collection(db,"bookings"),where("ownerId","==",uid)));
  await Promise.all(owned.docs.map(d=>deleteDoc(d.ref)));
  const tid=`user_${uid}`, msgs=await getDocs(collection(db,"chatThreads",tid,"messages"));
  await Promise.all(msgs.docs.map(d=>deleteDoc(d.ref)));
  await deleteDoc(doc(db,"chatThreads",tid)).catch(()=>{});
  await deleteDoc(doc(db,"users",uid)).catch(()=>{});
  await setDoc(doc(db,"deactivatedAccounts",uid),{uid,deactivatedAt:serverTimestamp(),reason:"Admin deactivated"},{merge:true});
  window.toast?.("Account එක deactivate කර data delete කළා.");
};


// ---------- Gig Renewal Requests ----------
(function setupRenewals(){
  const panel=document.getElementById("tab-overview"); if(!panel)return;
  const sec=document.createElement("section"); sec.className="section"; sec.innerHTML=`<div class="section-heading-row"><h2 style="color:#33d896">💳 Gig Renewal Requests</h2></div><div id="renewalRequestsList" class="list"></div>`;
  panel.appendChild(sec);
  onSnapshot(query(collection(db,"renewalRequests"),where("status","==","pending")),(snap)=>{
    const el=document.getElementById("renewalRequestsList"); if(!el)return;
    el.innerHTML=snap.docs.length?snap.docs.map(d=>{const r=d.data();return `<div class="list-item"><div><b>Gig ID: ${escapeHtml(r.gigId)}</b><br><small>Owner: ${escapeHtml(r.ownerId)} · ${r.receiptPhoto?`<a href="${r.receiptPhoto}" target="_blank" style="color:#33d896">Payment Receipt</a>`:"No receipt"}</small></div><button class="btn primary" onclick="window.__approveRenewal('${d.id}','${r.gigId}')">Approve +10 Days</button></div>`}).join(""):`<div class="card">Pending renewal requests නැහැ.</div>`;
  });
})();
window.__approveRenewal=async(requestId,gigId)=>{
  if(!confirm("Payment proof check කරලා මේ Gig එක තවත් දින 10කට Active කරන්නද?"))return;
  try{await approveRenewal(requestId,gigId);window.toast?.("Gig renewal approved ✓");}catch(e){alert(e.message);}
};

// ---------- Admin clean sub-tabs ----------
(function(){
 const panel=document.getElementById("tab-overview"); if(!panel)return;
 const sections=[...panel.querySelectorAll(":scope > .section")];
 const groups=[
  ["approval","📥 Bookings / Approval",["Gig Approval Queue"]],
  ["gigs","📋 Gigs",["සියලුම Gigs"]],
  ["home","🏠 Homepage",["මුල් පිටුවේ සංඛ්‍යා"]],
  ["content","🌱 Content",["මුල් පිටුවේ අන්තර්ගතය"]],
  ["social","🔗 Social",["Social & Chat Links"]],
  ["ads","📢 Ads",["දැන්වීම්"]]
 ];
 const nav=document.createElement("div");nav.className="admin-subtabs";
 groups.forEach(([id,label,need])=>{const b=document.createElement("button");b.className="btn light";b.dataset.adminSub=id;b.textContent=label;nav.appendChild(b);});
 panel.insertBefore(nav,panel.querySelector(".panel-grid"));
 sections.forEach(sec=>{
   const txt=sec.innerText;
   const g=groups.find(x=>x[2].some(n=>txt.includes(n)));
   sec.dataset.adminSubPanel=g?g[0]:"approval";
 });
 function show(id){sections.forEach(x=>x.style.display=x.dataset.adminSubPanel===id?"":"none");nav.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.adminSub===id));}
 nav.addEventListener("click",e=>{const b=e.target.closest("button");if(b)show(b.dataset.adminSub);});
 show("approval");
})();

// ---------- Social links / logos ----------
let socialTouched=false;
["socialWhatsapp","socialYoutube","socialFacebook","logoWhatsapp","logoYoutube","logoFacebook"].forEach(id=>document.getElementById(id)?.addEventListener("input",()=>socialTouched=true));
function fillSocial(s){if(socialTouched)return;["socialWhatsapp","socialYoutube","socialFacebook"].forEach((id,i)=>{if($("#"+id))$("#"+id).value=[s.whatsappUrl,s.youtubeUrl,s.facebookUrl][i]||"";});["logoWhatsapp","logoYoutube","logoFacebook"].forEach((id,i)=>{if($("#"+id))$("#"+id).value=[s.whatsappLogo,s.youtubeLogo,s.facebookLogo][i]||"";});}
listenSocialSettings(fillSocial);
document.getElementById("socialForm")?.addEventListener("submit",async e=>{e.preventDefault();try{await saveSocialSettings({whatsappUrl:$("#socialWhatsapp").value.trim(),youtubeUrl:$("#socialYoutube").value.trim(),facebookUrl:$("#socialFacebook").value.trim(),whatsappLogo:$("#logoWhatsapp").value.trim(),youtubeLogo:$("#logoYoutube").value.trim(),facebookLogo:$("#logoFacebook").value.trim()});socialTouched=false;window.toast?.("Social links Save කළා ✓");}catch(err){alert("Save අසාර්ථකයි: "+err.message);}});

// ---------- Ads ----------
function localDate(ms) {
  if (!ms) return "—";
  try { return new Date(Number(ms)).toLocaleString("si-LK", { dateStyle:"short", timeStyle:"short" }); } catch { return "—"; }
}
function renderAds(list) {
  const el = $("#adsList");
  if (!el) return;
  const sorted = [...list].sort((a,b) => {
    const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
    const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    const at = a.createdAt?.toMillis?.() ?? 0;
    const bt = b.createdAt?.toMillis?.() ?? 0;
    if (at !== bt) return at - bt;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  el.innerHTML = sorted.length ? sorted.map(a => `
    <div class="ad-admin-card">
      ${a.mediaType === "video" ? `<div class="thumb video-thumb">🎬</div>` : `<img class="thumb" src="${a.url}" alt="">`}
      <div class="grow">
        <b>#${Number(a.order)||1} · ${a.title || "(මාතෘකාවක් නැත)"}</b>
        <small>${a.mediaType === "video" ? "🎬 Video" : "🖼️ Photo"} · ⏱️ ${(Number(a.durationSeconds)||15)} sec · ↗️ ${(Number(a.fadeInSeconds ?? 0.5)).toFixed(1)}s · ↘️ ${(Number(a.fadeOutSeconds ?? 0.5)).toFixed(1)}s
        ${a.startAtMs ? ` · Start: ${localDate(a.startAtMs)}` : ""}${a.endAtMs ? ` · End: ${localDate(a.endAtMs)}` : ""}
        ${a.linkUrl ? ` · <a href="${a.linkUrl}" target="_blank" style="color:#33d896">Link</a>` : ""}</small>
        <div class="ad-schedule-inline">
          <label>Order <input class="mini-input ad-order" data-id="${a.id}" type="number" min="1" value="${Number(a.order)||1}"></label>
          <label>Seconds <input class="mini-input ad-duration" data-id="${a.id}" type="number" min="3" max="3600" value="${Number(a.durationSeconds)||15}"></label>
          <label>Fade In <input class="mini-input ad-fade-in" data-id="${a.id}" type="number" min="0" max="10" step="0.1" value="${Number(a.fadeInSeconds ?? 0.5)}"></label>
          <label>Fade Out <input class="mini-input ad-fade-out" data-id="${a.id}" type="number" min="0" max="10" step="0.1" value="${Number(a.fadeOutSeconds ?? 0.5)}"></label>
          <button class="btn light mini-save" onclick="window.__saveAdSchedule('${a.id}')">Save timing</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:9px;align-items:center;flex-wrap:wrap">
          <span class="pill-toggle ${a.active ? "on" : "off"}" onclick="window.__toggleAd('${a.id}',${!a.active})">${a.active ? "🟢 Active" : "⚪ Inactive"}</span>
          ${a.mediaType === "video" ? `<span class="pill-toggle ${a.muted === false ? "on" : "off"}" onclick="window.__toggleAdMute('${a.id}',${a.muted === false})">${a.muted === false ? "🔊 Sound" : "🔇 Muted"}</span>` : ""}
          <a class="btn light" href="${a.url}" target="_blank" style="padding:5px 10px;font-size:12px">බලන්න</a>
          <button class="btn danger" onclick="window.__deleteAd('${a.id}')">ඉවත් කරන්න</button>
        </div>
      </div>
    </div>`).join("") : `<div class="card">තවම දැන්වීමක් දාලා නැහැ.</div>`;
}

window.__toggleAd = async (id, active) => {
  await setAdActive(id, active);
  window.toast?.(active ? "දැන්වීම Active කළා ✓" : "දැන්වීම Inactive කළා");
};
window.__toggleAdMute = async (id, muted) => {
  await setAdMuted(id, muted);
  window.toast?.(muted ? "Video mute කළා 🔇" : "Video sound On කළා 🔊");
};
window.__saveAdSchedule = async (id) => {
  const order = document.querySelector(`.ad-order[data-id="${id}"]`)?.value || 1;
  const durationSeconds = document.querySelector(`.ad-duration[data-id="${id}"]`)?.value || 15;
  const fadeInSeconds = document.querySelector(`.ad-fade-in[data-id="${id}"]`)?.value ?? 0.5;
  const fadeOutSeconds = document.querySelector(`.ad-fade-out[data-id="${id}"]`)?.value ?? 0.5;
  try {
    await updateAdSchedule(id, { order, durationSeconds, fadeInSeconds, fadeOutSeconds });
    window.toast?.("Ad order / timing / fade update කළා ✓");
  } catch (e) { alert("Update අසාර්ථකයි: " + e.message); }
};
window.__deleteAd = async (id) => {
  if (!confirm("මේ දැන්වීම ඉවත් කරන්නද?")) return;
  await deleteAd(id);
  window.toast?.("දැන්වීම ඉවත් කළා");
};

document.getElementById("adForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = $("#adFile").files?.[0];
  if (!file) return alert("කරුණාකර Ad Photo / Video එකක් තෝරන්න");
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) return alert("JPG, PNG, WEBP photo හෝ MP4, WebM, MOV video එකක් upload කරන්න.");

  // Give a quick client-side check before the Cloudinary upload.
  const mediaSize = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    if (isImage) {
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Photo එක කියවන්න බැහැ")); };
      img.src = url;
    } else {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve({ width: video.videoWidth, height: video.videoHeight }); };
      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Video එක කියවන්න බැහැ")); };
      video.src = url;
    }
  }).catch(err => { alert(err.message); return null; });
  if (!mediaSize) return;
  const ratio = mediaSize.height ? mediaSize.width / mediaSize.height : 0;
  // Photos: no fixed resolution restriction. Videos: accept normal landscape/vertical uploads too;
  // the player uses contain/cover CSS so Admin can upload common video sizes.


  const btn = $("#adSubmitBtn"), oldLabel = btn.textContent;
  btn.disabled = true; btn.textContent = "Upload වෙමින්...";
  try {
    const toMs = (id) => {
      const v = $(id)?.value;
      return v ? new Date(v).getTime() : null;
    };
    await createAd({
      title: $("#adTitle").value,
      linkUrl: $("#adLink").value,
      order: $("#adOrder").value,
      durationSeconds: $("#adDuration").value,
      fadeInSeconds: $("#adFadeIn").value,
      fadeOutSeconds: $("#adFadeOut").value,
      startAtMs: toMs("#adStart"),
      endAtMs: toMs("#adEnd")
    }, file);
    e.target.reset();
    window.toast?.("දැන්වීම එක් කළා ✓");
  } catch (err) {
    console.error(err);
    alert("දැන්වීම දැමීම අසාර්ථකයි: " + err.message);
  } finally { btn.disabled = false; btn.textContent = oldLabel; }
});

window.__viewGig = (id) => {
  const g = (window.__gigsCache || []).find(x => x.id === id);
  if (!g) return;
  const carouselId = `admin-car-${g.id}`;
  document.getElementById("photoModalBody").innerHTML = `
    <p><b>${g.title}</b></p>
    <p style="font-size:13px;color:#9db3a6">Owner: ${g.ownerName} · NIC: ${g.nic || "-"}<br>📞 ${g.phone1 || "-"} ${g.phone2 ? "/ " + g.phone2 : ""}<br>📍 ${g.address || "-"}${g.price ? `<br>💰 ගාන: Rs. ${g.price}` : ""}</p>
    <p style="font-size:13px;color:#9db3a6;margin-top:8px">ඡායාරූප:</p>
    ${(g.photos || []).length ? window.gigCarouselHtml(g.photos, carouselId, '260px') : "<i>ඡායාරූප නැත</i>"}
    <p style="font-size:13px;color:#9db3a6;margin-top:12px">📄 Bank Receipt (Listing Fee):</p>
    ${g.receiptPhoto ? `<a href="${g.receiptPhoto}" target="_blank"><img src="${g.receiptPhoto}" style="width:160px;border-radius:10px"></a>` : "<i style='color:#ff8f8f'>Receipt upload කරලා නැහැ</i>"}`;
  openModal("photoModal");
};

// ---------- Admin live chat ----------
let activeChatUid=null;
function escChat(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function setupAdminChat(){
  listenChatThreads(threads=>{
    const el=$("#chatThreads");if(!el)return;
    el.innerHTML=threads.length?threads.map(t=>`<button type="button" class="chat-thread ${t.id===`user_${activeChatUid}`?"active":""}" data-chat-uid="${t.userId}">
      <b>${escChat(t.userName||"User")}</b><small>${escChat(t.userPhone||t.userEmail||"")}</small><span>${escChat(t.lastMessage||"")}</span></button>`).join(""):"<p class='muted'>තවම chat නැහැ.</p>";
    el.querySelectorAll("[data-chat-uid]").forEach(x=>x.addEventListener("click",()=>openAdminChat(x.dataset.chatUid)));
  });
}
function openAdminChat(uid){
  activeChatUid=uid;
  const thread=(document.querySelector(`[data-chat-uid="${CSS.escape(uid)}"]`));
  $("#adminChatUser").textContent=thread?thread.innerText.split("\n").slice(0,2).join(" · "):"User";
  listenAdminChat(uid,m=>renderChatMessages($("#adminChatMessages"),m));
}

window.__adminChatMessageHandler = async (e)=>{
  const b=e.target.closest("button[data-mid]"); if(!b||!activeChatUid)return;
  try{
    if(b.classList.contains("chat-delete")||b.classList.contains("chat-delete-photo")){
      if(confirm("මේ message/photo එක delete කරන්නද?")) await deleteChatMessage(activeChatUid,b.dataset.mid);
    }else if(b.classList.contains("chat-edit")||b.classList.contains("chat-edit-photo")){
      const bubble=b.closest(".chat-bubble"); const text=bubble?.querySelector(":scope > div")?.textContent||"";
      const next=prompt("Message එක edit කරන්න:",text); if(next!==null) await updateChatMessage(activeChatUid,b.dataset.mid,next);
    }
  }catch(err){alert(err.message);}
};
$("#adminChatMessages")?.addEventListener("click",window.__adminChatMessageHandler);
document.getElementById("adminChatForm")?.addEventListener("submit",async e=>{
  e.preventDefault();if(!activeChatUid)return alert("Chat user කෙනෙක් තෝරන්න.");
  const text=$("#adminChatText").value.trim(),file=$("#adminChatPhoto").files?.[0];if(!text&&!file)return;
  try{
    let imageUrl="";
    if(file){const fd=new FormData();fd.append("file",file);fd.append("upload_preset","p0luehws");fd.append("folder",`chat/admin`);const r=await fetch("https://api.cloudinary.com/v1_1/favfuhcn/image/upload",{method:"POST",body:fd});const d=await r.json();if(!r.ok)throw Error(d.error?.message||"Photo upload failed");imageUrl=d.secure_url;}
    await sendAdminReply(activeChatUid,text,imageUrl);$("#adminChatText").value="";$("#adminChatPhoto").value="";
  }catch(err){alert(err.message);}
});
document.getElementById("adminChatPhotoBtn")?.addEventListener("click",()=>$("#adminChatPhoto")?.click());
setupAdminChat();
