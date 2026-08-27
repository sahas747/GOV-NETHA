const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ---------- Dark / Light theme ----------
// The actual <html data-theme="..."> attribute is already set by the tiny inline
// script in each page's <head> (runs before CSS paints, so there's no flash).
// This just keeps the toggle button + future page loads in sync.
function applyThemeIcon() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  const isLight = document.documentElement.dataset.theme === 'light';
  btn.textContent = isLight ? '🌙' : '☀️';
  btn.title = isLight ? 'Dark mode' : 'Light mode';
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('goviTheme', next);
  applyThemeIcon();
}
window.toggleTheme = toggleTheme;
window.__applyThemeIcon = applyThemeIcon;
applyThemeIcon();

const toast = (m) => { let t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200) };
window.toast = toast;

function openModal(id) { document.getElementById(id)?.classList.add('show') }
function closeModal(id) { document.getElementById(id)?.classList.remove('show') }
window.openModal = openModal; window.closeModal = closeModal;

document.addEventListener('click', e => { const c = e.target.closest('[data-close]'); if (c) closeModal(c.dataset.close) });

if ($('#searchHome')) $('#searchHome').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('#homeSearch').value;
  localStorage.setItem('goviSearch', q);
  location.href = (location.pathname.includes('/pages/') ? 'ploughing.html' : 'pages/ploughing.html');
});

// ---------- Photo carousel (gig cards, admin gig view — swipe/arrow through all photos) ----------
function gigCarouselHtml(photos, carouselId, heightCss) {
  if (!photos || !photos.length) return '';
  const h = heightCss || '160px';
  const slides = photos.map((p, i) => `<img src="${p}" class="carousel-slide${i === 0 ? ' active' : ''}" loading="lazy" alt="ගිග් ඡායාරූපය ${i + 1}">`).join('');
  const controls = photos.length > 1 ? `
    <button type="button" class="carousel-arrow prev" onclick="window.__carouselNav(event,'${carouselId}',-1)">‹</button>
    <button type="button" class="carousel-arrow next" onclick="window.__carouselNav(event,'${carouselId}',1)">›</button>
    <div class="carousel-dots">${photos.map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>
    <span class="carousel-count">1/${photos.length}</span>` : '';
  return `<div class="carousel" id="${carouselId}" data-index="0" data-count="${photos.length}" style="height:${h}">
    <div class="carousel-track">${slides}</div>${controls}
  </div>`;
}
window.gigCarouselHtml = gigCarouselHtml;

window.__carouselNav = (e, id, dir) => {
  e?.preventDefault(); e?.stopPropagation();
  const el = document.getElementById(id);
  if (!el) return;
  const count = parseInt(el.dataset.count, 10);
  let idx = (parseInt(el.dataset.index, 10) + dir + count) % count;
  el.dataset.index = idx;
  el.querySelectorAll('.carousel-slide').forEach((s, i) => s.classList.toggle('active', i === idx));
  el.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  const countEl = el.querySelector('.carousel-count');
  if (countEl) countEl.textContent = `${idx + 1}/${count}`;
};

// Swipe support on mobile — works for any .carousel on the page.
let __touchStartX = null, __touchCarouselId = null;
document.addEventListener('touchstart', e => {
  const c = e.target.closest('.carousel');
  if (!c) return;
  __touchStartX = e.changedTouches[0].clientX;
  __touchCarouselId = c.id;
}, { passive: true });
document.addEventListener('touchend', e => {
  if (__touchStartX == null || !__touchCarouselId) return;
  const dx = e.changedTouches[0].clientX - __touchStartX;
  if (Math.abs(dx) > 40) window.__carouselNav(null, __touchCarouselId, dx < 0 ? 1 : -1);
  __touchStartX = null; __touchCarouselId = null;
}, { passive: true });
