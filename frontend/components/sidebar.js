import { getTranslation } from '/js/i18n.js';

export function renderSidebar(container) {
  container.innerHTML = `
    <div class="brand-card">
      <h1>Discipline OS</h1>
      <p>Anti-fake motivation core</p>
    </div>
    
    <nav class="nav-list">
      <button class="active" data-section="mission" data-i18n="dashboard">${getTranslation('dashboard')}</button>
      <button data-section="intel" data-i18n="intel_feed">${getTranslation('intel_feed')}</button>
      <button data-section="record" data-i18n="strike_record">${getTranslation('strike_record')}</button>
      <button data-section="config" data-i18n="system_config">${getTranslation('system_config')}</button>
    </nav>

    <div class="status-card" style="display:flex; flex-direction:column; gap:8px;">
      <div id="sysClock" style="font-family: 'Space Mono', monospace; color: #38BDF8; font-size: 14px; font-weight: bold; letter-spacing: 2px;">
        00:00:00 SYS
      </div>
      <div style="font-size: 11px; color: #9CA3AF; display:flex; justify-content: space-between;">
        <span><span data-i18n="streak">${getTranslation('streak')}</span>: <strong id="sideStreak" style="color:#F97316;">0</strong></span>
        <span><span data-i18n="shield">${getTranslation('shield')}</span>: <strong id="sideShield" style="color:#38BDF8;">0</strong></span>
      </div>
    </div>

    <button id="openDrawerBtn" class="primary-btn" data-i18n="open_ai_console">${getTranslation('open_ai_console')}</button>

    <div class="user-profile-container">
      <div class="user-trigger" id="userTrigger">
        <div class="avatar-wrapper">
          <div class="op-avatar circular" id="opAvatar">?</div>
          <div class="avatar-glow"></div>
        </div>
        <span class="operative-name" id="sideUsername">USER</span>
        <span class="chevron">▼</span>
      </div>

      <div id="userDropdown" class="dropdown-content hidden">
        <div class="dropdown-arrow"></div>
        <button class="dropdown-item" data-section="account" data-i18n="my_account">
          ${getTranslation('my_account')}
        </button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item terminate-link" id="logoutBtn" data-i18n="log_out">
          ${getTranslation('log_out')}
        </button>
      </div>
    </div>
  `;
}

export function bindSidebarNavigation(onNavigate) {
  document.querySelectorAll('[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update UI active state
      document.querySelectorAll('[data-section]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onNavigate(btn.dataset.section);
    });
  });
}
