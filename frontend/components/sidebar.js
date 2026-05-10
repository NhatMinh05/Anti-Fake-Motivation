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
    <div class="status-card">
      <div><span class="dot success"></span>System online</div>
      <div><span class="dot info"></span>Uplink stable</div>
    </div>
    <button id="openDrawerBtn" class="primary-btn">Open AI Drawer</button>
  `;
}

export function bindSidebarNavigation(onNavigate) {
  document.querySelectorAll('[data-section]').forEach(btn => {
    btn.addEventListener('click', () => onNavigate(btn.dataset.section));
  });
}
