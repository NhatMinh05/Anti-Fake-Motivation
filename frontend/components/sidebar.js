export function renderSidebar(container) {
  container.innerHTML = `
    <div class="brand-card">
      <h1>Discipline OS</h1>
      <p>Anti-fake motivation core</p>
    </div>
    <nav class="nav-list">
      <button data-section="mission">Dashboard</button>
      <button data-section="intel">Intel Feed</button>
      <button data-section="record">Strike Record</button>
      <button data-section="config">System Config</button>
    </nav>
    <div class="status-card" style="display:flex; flex-direction:column; gap:8px;">
      <div id="sysClock" style="font-family: 'Space Mono', monospace; color: #38BDF8; font-size: 14px; font-weight: bold; letter-spacing: 2px;">
        00:00:00 SYS
      </div>
      <div style="font-size: 11px; color: #9CA3AF; display:flex; justify-content: space-between;">
        <span>STREAK: <strong id="sideStreak" style="color:#F97316;">0</strong></span>
        <span>SHIELD: <strong id="sideShield" style="color:#38BDF8;">0</strong></span>
      </div>
    </div>
    <button id="openDrawerBtn" class="primary-btn">OPEN AI CONSOLE</button>
    <div class="operative-footer">
      <div class="operative-trigger mini" id="opTrigger" title="System Access">
        <div class="op-avatar circular" id="opAvatar">?</div>
      </div>
      
      <div class="operative-menu mini-menu hidden" id="opMenu">
        <div class="menu-header" id="sideUsername">OPERATIVE</div>
        <button class="menu-item" id="logoutBtn">
          <span class="menu-icon">⏻</span>
          <span class="menu-text">TERMINATE SESSION</span>
        </button>
      </div>
    </div>
  `;
}

export function bindSidebarNavigation(onNavigate) {
  document.querySelectorAll('[data-section]').forEach(btn => {
    btn.addEventListener('click', () => onNavigate(btn.dataset.section));
  });
}
