const inPages = location.pathname.includes('/pages/');
const root = inPages ? '../' : './';
const goviUser = JSON.parse(localStorage.getItem('goviFirebaseUser') || 'null');

const authAction = goviUser
  ? `<a class="nav-auth" href="javascript:void(0)" id="headerLogoutBtn">Logout</a>`
  : `<a class="nav-auth" href="${root}login.html">Login</a>`;

const fallbackAvatarUrl = `https://ui-avatars.com/api/?background=5c7a00&color=fff&bold=true&name=${encodeURIComponent(goviUser?.name || goviUser?.email || 'User')}`;
const profileAvatarBtn = goviUser
  ? `<a class="nav-avatar-btn" href="${root}dashboard.html" title="Dashboard"><img src="${goviUser.photoURL || fallbackAvatarUrl}" alt="Profile" class="nav-avatar" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallbackAvatarUrl}'"></a>`
  : '';

const header = `
<header class="header">
  <div class="container nav">
    <a class="brand" href="${root}index.html">
      <img src="${root}assets/logo.png" alt="ගොවි නෙත LK">
      <span><strong>ගොවි නෙත</strong><small>Smart farming services</small></span>
    </a>
    <nav class="main-nav" aria-label="Main navigation">
      <a href="${root}index.html">මුල් පිටුව</a>
      <a href="${root}pages/ploughing.html">සී සෑම</a>
      <a href="${root}pages/harvesting.html">අස්වනු නෙලීම</a>
      <a href="${root}pages/extras.html">අමතර සේවා</a>
      <a href="${root}pages/weather.html">කාලගුණය</a>
      <a href="${root}customer-service.html">Customer Service</a>
    </nav>
    <div class="nav-actions">
      ${profileAvatarBtn}
      <a class="nav-dashboard" href="${root}dashboard.html">Dashboard</a>
      ${authAction}
      <button type="button" class="theme-toggle" id="themeToggleBtn" onclick="window.toggleTheme && window.toggleTheme()" aria-label="Theme toggle">☀️</button>
      <a class="mobile-dashboard-top-btn" href="${root}dashboard.html" aria-label="Dashboard">📊</a>
      <button type="button" class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Menu">☰</button>
    </div>
  </div>
</header>`;
document.getElementById('siteHeader').innerHTML = header;

document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
  const mainNav = document.querySelector('.main-nav');
  const adminMenu = document.getElementById('adminMobileMenu');
  const dashboardMenu = document.getElementById('dashboardMobileMenu');
  mainNav?.classList.toggle('open');
  adminMenu?.classList.toggle('open');
  dashboardMenu?.classList.toggle('open');
});

// Mobile dashboard/admin menus stay in normal document flow, directly under the header.
const mobileRole = goviUser?.role || localStorage.getItem('goviRole') || '';
const dashboardAdminLink = document.getElementById('dashboardAdminLink');
if (dashboardAdminLink && mobileRole !== 'admin') dashboardAdminLink.style.display = 'none';

const mobileAvatar = document.getElementById('mobileDashAvatar');
const mobileName = document.getElementById('mobileDashName');
const mobileRoleLabel = document.getElementById('mobileRoleLabel');
if (mobileAvatar && goviUser) {
  mobileAvatar.src = goviUser.photoURL || fallbackAvatarUrl;
  mobileName.textContent = goviUser.name || goviUser.email || 'User';
  mobileRoleLabel.textContent = mobileRole === 'admin' ? 'Admin' : (mobileRole === 'owner' ? 'වයාපාරික / යන්ත්‍ර හිමිකරු' : 'ගොවියා');
}

function wireMobileTabLinks(selector) {
  document.querySelectorAll(selector).forEach(link => {
    link.addEventListener('click', () => {
      const tab = link.dataset.tab;
      if (!tab) return;
      document.querySelector(`[data-tab="${tab}"]`)?.click();
      document.getElementById('adminMobileMenu')?.classList.remove('open');
      document.getElementById('dashboardMobileMenu')?.classList.remove('open');
    });
  });
}
wireMobileTabLinks('.admin-mobile-link, .dashboard-mobile-link');

document.getElementById('adminMobileLogout')?.addEventListener('click', () => document.getElementById('headerLogoutBtn')?.click());
document.getElementById('dashboardMobileLogout')?.addEventListener('click', () => document.getElementById('headerLogoutBtn')?.click());

document.getElementById('headerLogoutBtn')?.addEventListener('click', async () => {
  try {
    const mod = await import(`${root}js/firebase-config.js`);
    await mod.signOut(mod.auth);
  } catch (e) {
    console.warn('Firebase sign out unavailable:', e);
  } finally {
    localStorage.removeItem('goviFirebaseUser');
    localStorage.removeItem('goviRole');
    location.href = `${root}index.html`;
  }
});
