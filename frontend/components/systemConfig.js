export function renderSystemConfig(container) {
  // Đọc theme hiện tại
  const currentTheme = localStorage.getItem('user_theme') || 'cyberpunk';

  container.innerHTML = `
    <section id="config" class="section hidden">
      <header class="section-header">
        <h2>System Config</h2>
        <p>Coach behavior controls</p>
      </header>

      <div class="mode-grid">
        <button class="mode-btn active" data-mode="RUTHLESS_MODE">Ruthless</button>
        <button class="mode-btn" data-mode="ANALYTICAL_MODE">Analytical</button>
        <button class="mode-btn" data-mode="SILENT_OBSERVER">Silent</button>
      </div>

      <div class="config-grid">
        <div class="card">
          <div class="card-title">Runtime Toggles</div>
          <label class="toggle-row"><input id="toggleSound" type="checkbox" /> Alert sound</label>
          <label class="toggle-row"><input id="toggleAutoIntel" type="checkbox" checked /> Auto intel refresh</label>
          <label class="toggle-row"><input id="toggleStrictConfirm" type="checkbox" checked /> Strict reset confirm</label>
        </div>

        <div class="card">
          <div class="card-title">User Interface</div>
          <label style="display:block; margin-top:10px;">
            Theme Engine
            <select id="themeSelect" style="width:100%; margin-top:5px; padding:8px; background: #0E0E0E; color: #10B981; border: 1px solid #2A2A2A; outline: none; border-radius: 4px;">
              <option value="cyberpunk" ${currentTheme === 'cyberpunk' ? 'selected' : ''}>Terminal Dark (Default)</option>
              <option value="vercel" ${currentTheme === 'vercel' ? 'selected' : ''}>Vercel Light (Geist)</option>
            </select>
          </label>
        </div>

        <div class="card">
          <div class="card-title">Preset Profiles</div>
          <div class="preset-actions">
            <button id="savePresetBtn">Save Current</button>
            <button id="loadPresetBtn">Load</button>
            <button id="deletePresetBtn">Delete</button>
          </div>
          <select id="presetSelect">
            <option value="">No preset selected</option>
          </select>
        </div>
      </div>

      <div class="danger-zone">
        <h4>Danger Zone</h4>
        <p>Resetting will purge all score history.</p>
        <div class="danger-actions">
          <button id="backupStateBtn" class="danger-btn">Backup Local State</button>
          <button id="resetBtn" class="danger-btn">Reset Core Score</button>
        </div>
      </div>
    </section>
  `;
}
