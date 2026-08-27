// ---------- ගොවි නෙත LK · Weather (කාලගුණය) ----------
// Free, no-API-key services: Open-Meteo (weather + geocoding) + BigDataCloud (reverse geocode label).
// Exports: initHomeWeather() for the homepage widget, initWeatherPage() for the full /pages/weather.html page.

const COLOMBO = { lat: 6.9271, lon: 79.8612, label: "කොළඹ (default ස්ථානය)" };

// WMO weather_code -> [emoji, Sinhala label]
const WCODE = {
  0: ["☀️", "පැහැදිලි අහස"], 1: ["🌤️", "බොහෝදුරට පැහැදිලි"], 2: ["⛅", "අර්ධ වළාකුළු"], 3: ["☁️", "වළාකුළු බර අහස"],
  45: ["🌫️", "මීදුම"], 48: ["🌫️", "මීදුම"],
  51: ["🌦️", "සිහින් වැසි"], 53: ["🌦️", "සිහින් වැසි"], 55: ["🌦️", "සිහින් වැසි"],
  56: ["🌧️", "අයිස් සහිත වැසි"], 57: ["🌧️", "අයිස් සහිත වැසි"],
  61: ["🌧️", "සුළු වැසි"], 63: ["🌧️", "මධ්‍යම වැසි"], 65: ["🌧️", "තද වැසි"],
  66: ["🌧️", "අයිස් සහිත වැසි"], 67: ["🌧️", "අයිස් සහිත වැසි"],
  71: ["🌨️", "හිම වැටීම"], 73: ["🌨️", "හිම වැටීම"], 75: ["🌨️", "තද හිම"], 77: ["🌨️", "හිම කැට"],
  80: ["🌦️", "වැසි ඇල්ල"], 81: ["🌦️", "වැසි ඇල්ල"], 82: ["⛈️", "තද වැසි ඇල්ල"],
  85: ["🌨️", "හිම ඇල්ල"], 86: ["🌨️", "හිම ඇල්ල"],
  95: ["⛈️", "ගිගුරුම් සහිත වැසි"], 96: ["⛈️", "අයිස් සහිත ගිගුරුම්"], 99: ["⛈️", "අයිස් සහිත ගිගුරුම්"]
};
const iconFor = (code) => WCODE[code] || ["🌡️", "කාලගුණය"];
const DAY_SI = ["ඉරිදා", "සඳුදා", "අඟහරුවාදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"];

function getUserPosition() {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) { resolve(null); return; }
    let best = null, watchId = null, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      resolve(best);
    };
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = {
          lat: Number(pos.coords.latitude),
          lon: Number(pos.coords.longitude),
          accuracy: Number(pos.coords.accuracy || 9999)
        };
        if (!best || next.accuracy < best.accuracy) best = next;
        // Keep refining briefly, but finish early on a genuinely good GPS fix.
        if (next.accuracy <= 100) finish();
      },
      (err) => {
        console.warn("Geolocation error:", err.code, err.message);
        finish();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    setTimeout(finish, 14000);
  });
}
async function reverseGeocodeLabel(lat, lon) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    if (!res.ok) return null;
    const d = await res.json();
    return d.locality || d.city || d.principalSubdivision || null;
  } catch (e) { return null; }
}

async function resolveInitialLocation() {
  const pos = await getUserPosition();
  if (pos) {
    const label = await reverseGeocodeLabel(pos.lat, pos.lon);
    return { lat: pos.lat, lon: pos.lon, label: label || "ඔබේ වත්මන් ස්ථානය" };
  }
  // Browser GPS can be unavailable on desktop or when permission is denied.
  // Use IP location as a non-blocking fallback, then Colombo only if that also fails.
  try {
    const res = await fetch("https://ipapi.co/json/");
    const d = await res.json();
    if (d.latitude && d.longitude && (!d.country_code || d.country_code === "LK")) {
      return {
        lat: Number(d.latitude), lon: Number(d.longitude),
        label: [d.city, d.region].filter(Boolean).join(", ") || "ශ්‍රී ලංකාව (IP location)"
      };
    }
  } catch (e) { console.warn("IP location fallback failed:", e.message); }
  return { ...COLOMBO };
}

const LK_DISTRICT_ALIASES = {
  "කොළඹ": "Colombo", "ගම්පහ": "Gampaha", "කළුතර": "Kalutara",
  "මහනුවර": "Kandy", "මාතලේ": "Matale", "නුවරඑළිය": "Nuwara Eliya",
  "ගාල්ල": "Galle", "මාතර": "Matara", "හම්බන්තොට": "Hambantota",
  "යාපනය": "Jaffna", "කිලිනොච්චි": "Kilinochchi", "මන්නාරම": "Mannar",
  "වවුනියාව": "Vavuniya", "මුලතිව්": "Mullaitivu", "මඩකලපුව": "Batticaloa",
  "අම්පාර": "Ampara", "ත්‍රිකුණාමලය": "Trincomalee", "කුරුණෑගල": "Kurunegala",
  "පුත්තලම": "Puttalam", "අනුරාධපුර": "Anuradhapura", "පොළොන්නරුව": "Polonnaruwa",
  "බදුල්ල": "Badulla", "මොනරාගල": "Monaragala", "රත්නපුර": "Ratnapura",
  "කෑගල්ල": "Kegalle"
};

async function geocodeLK(query) {
  // Nominatim is particularly useful for Sri Lankan villages/localities.
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=lk&q=${encodeURIComponent(query)}`;
    const nomRes = await fetch(nomUrl, { headers: { "Accept-Language": "si,en" } });
    if (nomRes.ok) {
      const nom = await nomRes.json();
      if (nom.length) {
        return nom.map((r) => ({
          lat: Number(r.lat), lon: Number(r.lon),
          label: r.display_name ? r.display_name.split(",").slice(0, 3).join(", ") : query
        }));
      }
    }
  } catch (e) { console.warn("Nominatim geocode failed:", e.message); }

  const fallbackQuery = LK_DISTRICT_ALIASES[query] || query;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(fallbackQuery)}&count=10&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("geocode failed");
  const d = await res.json();
  const all = d.results || [];
  const lk = all.filter((r) => r.country_code === "LK");
  const pool = lk.length ? lk : all;
  return pool.slice(0, 8).map((r) => ({
    lat: r.latitude, lon: r.longitude,
    label: [r.name, r.admin2 || r.admin1].filter(Boolean).join(", ")
  }));
}
async function fetchWeatherData(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m` +
    `&hourly=precipitation_probability` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather fetch failed");
  return res.json();
}

function currentRainProb(data) {
  try {
    const hourKey = data.current.time.slice(0, 13); // "YYYY-MM-DDTHH"
    const idx = data.hourly.time.findIndex((t) => t.startsWith(hourKey));
    if (idx >= 0) return data.hourly.precipitation_probability[idx];
  } catch (e) { /* fall through */ }
  return data.daily?.precipitation_probability_max?.[0] ?? 0;
}

function buildAdvisory(daily, rainNow, windMax, tempMax) {
  const tips = [];
  const rainMax = daily.precipitation_probability_max?.[0] ?? rainNow;
  if (Math.max(rainNow, rainMax) >= 70) {
    tips.push("🌧️ අද අධික වැසි අවදානමක් ඇත — පොහොර/කෘමිනාශක ස්ප්‍රේ කිරීම කල් දමන්න, හැකි නම් අස්වනු නෙලීම කල් තබන්න.");
  } else if (Math.max(rainNow, rainMax) >= 40) {
    tips.push("🌦️ වැසි ඇතිවීමට යම් ඉඩක් ඇත — එළිමහන් වැඩ සැලසුම් කිරීමේදී පූර්වාරක්ෂාවෙන් සිටින්න.");
  }
  if (tempMax >= 34) {
    tips.push("☀️ අද අධික උණුසුමකි — දහවල් වේලාවේ ක්ෂේත්‍ර වැඩ අවම කර, උදෑසන/සවස වේලාවේ වැඩ කරන්න සහ බෝගවලට ප්‍රමාණවත් ජලය ලබා දෙන්න.");
  }
  if (windMax >= 30) {
    tips.push("💨 තද සුළං තත්ත්වයක් — උස බෝග (කෙසෙල්, පොල්) ආරක්ෂා කරගැනීමට සහ ස්ප්‍රේ කිරීම් අත්හිටුවීමට සලකා බලන්න.");
  }
  if (!tips.length) tips.push("✅ අද කාලගුණය සාමාන්‍ය ගොවිතැන් කටයුතු සඳහා සුදුසුයි.");
  return tips.slice(0, 4);
}

function renderCurrentCard(el, { label, current, daily, rainNow, updatedAt }) {
  const [icon, condLabel] = iconFor(current.weather_code);
  const sunrise = daily.sunrise[0].slice(11, 16);
  const sunset = daily.sunset[0].slice(11, 16);
  el.innerHTML = `
    <div class="weather-current">
      <div class="weather-main">
        <div class="weather-icon-big">${icon}</div>
        <div class="weather-temp-block">
          <div class="weather-place">📍 ${label}</div>
          <b>${Math.round(current.temperature_2m)}°C</b>
          <span>${condLabel} · දැනෙන උෂ්ණත්වය ${Math.round(current.apparent_temperature)}°C</span>
        </div>
      </div>
    </div>
    <div class="weather-meta-grid">
      <div class="weather-meta-item"><span class="wi">💧</span><b>${current.relative_humidity_2m}%</b><span>ආර්ද්‍රතාවය</span></div>
      <div class="weather-meta-item"><span class="wi">🌬️</span><b>${Math.round(current.wind_speed_10m)} km/h</b><span>සුළං වේගය</span></div>
      <div class="weather-meta-item"><span class="wi">🌧️</span><b>${Math.round(rainNow)}%</b><span>වැසි ඉඩකඩ</span></div>
      <div class="weather-meta-item"><span class="wi">🌅</span><b>${sunrise}</b><span>හිරු උදාව</span></div>
      <div class="weather-meta-item"><span class="wi">🌇</span><b>${sunset}</b><span>හිරු බැසීම</span></div>
      <div class="weather-meta-item"><span class="wi">📈</span><b>${Math.round(daily.temperature_2m_max[0])}° / ${Math.round(daily.temperature_2m_min[0])}°</b><span>ඉහළ/පහළ</span></div>
    </div>
    <div class="weather-updated">🕒 අවසන් යාවත්කාලීන කිරීම: ${updatedAt}</div>`;
}

function renderAdvisory(el, tips) {
  el.innerHTML = `<h4>🌾 ගොවි උපදෙස්</h4><ul class="advisory-list">${tips.map((t) => `<li>${t}</li>`).join("")}</ul>`;
}

function renderForecast(el, daily) {
  el.innerHTML = daily.time.map((d, i) => {
    const [icon] = iconFor(daily.weather_code[i]);
    const dow = DAY_SI[new Date(d + "T12:00:00").getDay()];
    return `<div class="forecast-day">
      <div class="fd-name">${i === 0 ? "අද" : dow}</div>
      <div class="fd-icon">${icon}</div>
      <div class="fd-temps"><b>${Math.round(daily.temperature_2m_max[i])}°</b> <span>${Math.round(daily.temperature_2m_min[i])}°</span></div>
      <div class="fd-rain">🌧️ ${daily.precipitation_probability_max[i]}%</div>
    </div>`;
  }).join("");
}

function windyUrl(lat, lon) {
  return `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&zoom=8&level=surface&overlay=rain&menu=true&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1`;
}

// ---------- Homepage widget (below hero) ----------
export async function initHomeWeather() {
  const wrap = document.getElementById("homeWeatherCard");
  if (!wrap) return;
  const advWrap = document.getElementById("homeWeatherAdvisory");
  const searchForm = document.getElementById("homeWeatherSearchForm");
  const searchInput = document.getElementById("homeWeatherSearchInput");
  const suggestions = document.getElementById("homeWeatherSuggestions");
  const locationBtn = document.getElementById("homeWeatherLocationBtn");

  async function loadLocation() {
    wrap.innerHTML = `<div class="weather-loading"><div style="font-size:38px">📍</div><b>ඔබේ Live Location එකෙන් කාලගුණය හොයමින්...</b><br><small>GPS location එකට හොඳම available fix එක ලබාගන්නවා</small></div>`;
    try {
      const loc = await resolveInitialLocation();
      await loadFor(loc.lat, loc.lon, loc.label);
    } catch (e) {
      wrap.innerHTML = `<div class="weather-error">⚠️ Live Location කාලගුණය load කිරීමට නොහැකි විය.<br><small>Browser Location Permission → Allow කරලා නැවත උත්සාහ කරන්න.</small><br><button type="button" class="btn light" id="weatherRetry">🔄 නැවත උත්සාහ කරන්න</button></div>`;
      document.getElementById("weatherRetry")?.addEventListener("click", loadLocation);
      console.warn("home weather error:", e);
    }
  }

  async function loadFor(lat, lon, label) {
    wrap.innerHTML = `<div class="weather-loading">⛅ ${label} සඳහා කාලගුණ දත්ත load වෙමින්...</div>`;
    const data = await fetchWeatherData(lat, lon);
    const rainNow = currentRainProb(data);
    const updatedAt = new Date().toLocaleTimeString("si-LK", { hour:"2-digit", minute:"2-digit" });
    renderCurrentCard(wrap, { label, current: data.current, daily: data.daily, rainNow, updatedAt });
    const button = document.createElement("button");
    button.className = "weather-location-refresh btn light";
    button.type = "button";
    button.textContent = "📍 මගේ Live Location";
    button.addEventListener("click", loadLocation);
    wrap.appendChild(button);
    if (advWrap) {
      const tips = buildAdvisory(data.daily, rainNow, data.daily.wind_speed_10m_max[0], data.daily.temperature_2m_max[0]);
      advWrap.classList.remove("hidden");
      renderAdvisory(advWrap, tips);
    }
  }

  let searchTimer = null;
  searchInput?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (suggestions) suggestions.classList.add("hidden");
    if (q.length < 2) return;
    searchTimer = setTimeout(async () => {
      try {
        const results = await geocodeLK(q);
        if (!suggestions) return;
        suggestions.innerHTML = results.map((r, i) =>
          `<button type="button" class="weather-suggestion" data-index="${i}">📍 ${r.label}</button>`
        ).join("");
        suggestions._results = results;
        suggestions.classList.toggle("hidden", !results.length);
      } catch (e) {
        console.warn("Weather search failed:", e);
      }
    }, 350);
  });

  suggestions?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".weather-suggestion");
    if (!btn) return;
    const r = suggestions._results?.[Number(btn.dataset.index)];
    if (!r) return;
    searchInput.value = r.label;
    suggestions.classList.add("hidden");
    try { await loadFor(r.lat, r.lon, r.label); }
    catch (err) { wrap.innerHTML = `<div class="weather-error">⚠️ ${r.label} සඳහා කාලගුණ දත්ත ලබාගැනීමට නොහැකි විය.</div>`; }
  });

  searchForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = searchInput?.value.trim();
    if (!q) return loadLocation();
    try {
      const results = await geocodeLK(q);
      if (!results.length) {
        wrap.innerHTML = `<div class="weather-error">🔎 "${q}" හමු වුණේ නැහැ. දිස්ත්‍රික්කය, ප්‍රදේශය හෝ ගමේ නම නැවත පරීක්ෂා කරන්න.</div>`;
        return;
      }
      const r = results[0];
      searchInput.value = r.label;
      suggestions?.classList.add("hidden");
      await loadFor(r.lat, r.lon, r.label);
    } catch (e) {
      wrap.innerHTML = `<div class="weather-error">⚠️ ස්ථානය සෙවීම අසාර්ථකයි. නැවත උත්සාහ කරන්න.</div>`;
      console.warn("home weather search error:", e);
    }
  });

  locationBtn?.addEventListener("click", loadLocation);
  document.addEventListener("click", (e) => {
    if (suggestions && !e.target.closest(".weather-search-form")) suggestions.classList.add("hidden");
  });

  await loadLocation();
}
// ---------- Full /pages/weather.html page ----------
export async function initWeatherPage() {
  const curWrap = document.getElementById("weatherPageCurrent");
  if (!curWrap) return;
  const advWrap = document.getElementById("weatherPageAdvisory");
  const forecastWrap = document.getElementById("weatherForecastStrip");
  const windyFrame = document.getElementById("windyFrame");
  const searchForm = document.getElementById("weatherSearchForm");
  const searchInput = document.getElementById("weatherSearchInput");
  const suggestBox = document.getElementById("weatherSuggestions");

  async function loadFor(lat, lon, label) {
    curWrap.innerHTML = `<div class="weather-loading">⛅ කාලගුණ දත්ත load වෙමින්...</div>`;
    try {
      const data = await fetchWeatherData(lat, lon);
      const rainNow = currentRainProb(data);
      const updatedAt = new Date().toLocaleTimeString("si-LK", { hour: "2-digit", minute: "2-digit" });
      renderCurrentCard(curWrap, { label, current: data.current, daily: data.daily, rainNow, updatedAt });
      const tips = buildAdvisory(data.daily, rainNow, data.daily.wind_speed_10m_max[0], data.daily.temperature_2m_max[0]);
      if (advWrap) { advWrap.classList.remove("hidden"); renderAdvisory(advWrap, tips); }
      if (forecastWrap) renderForecast(forecastWrap, data.daily);
      if (windyFrame) windyFrame.src = windyUrl(lat, lon);
    } catch (e) {
      curWrap.innerHTML = `<div class="weather-error">⚠️ කාලගුණ දත්ත load කිරීමට නොහැකි විය. පසුව නැවත උත්සාහ කරන්න.</div>`;
      console.warn("weather page error:", e);
    }
  }

  const loc = await resolveInitialLocation();
  await loadFor(loc.lat, loc.lon, loc.label);

  let debTimer;
  searchInput?.addEventListener("input", () => {
    clearTimeout(debTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { suggestBox?.classList.add("hidden"); if (suggestBox) suggestBox.innerHTML = ""; return; }
    debTimer = setTimeout(async () => {
      try {
        const results = await geocodeLK(q);
        if (!suggestBox) return;
        if (!results.length) {
          suggestBox.innerHTML = `<div class="empty">ප්‍රතිඵල හමු නොවීය</div>`;
          suggestBox.classList.remove("hidden");
          return;
        }
        suggestBox.innerHTML = results.map((r) =>
          `<button type="button" data-lat="${r.lat}" data-lon="${r.lon}" data-label="${r.label.replace(/"/g, "&quot;")}">📍 ${r.label}</button>`
        ).join("");
        suggestBox.classList.remove("hidden");
      } catch (e) { suggestBox?.classList.add("hidden"); }
    }, 350);
  });

  suggestBox?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-lat]");
    if (!btn) return;
    searchInput.value = btn.dataset.label;
    suggestBox.classList.add("hidden");
    loadFor(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lon), btn.dataset.label);
  });

  document.addEventListener("click", (e) => {
    if (suggestBox && !e.target.closest(".weather-search-wrap")) suggestBox.classList.add("hidden");
  });

  searchForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;
    try {
      const results = await geocodeLK(q);
      if (!results.length) { window.toast && window.toast("ස්ථානය හමු නොවීය"); return; }
      const r = results[0];
      searchInput.value = r.label;
      suggestBox?.classList.add("hidden");
      loadFor(r.lat, r.lon, r.label);
    } catch (e) { window.toast && window.toast("සෙවීමේ දෝෂයක් ඇති විය"); }
  });
}
