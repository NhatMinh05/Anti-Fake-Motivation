export function renderSystemConfig(container) {
  const currentTheme = localStorage.getItem('user_theme') || 'cyberpunk';
  const soundOverride = localStorage.getItem('sys_sound_override') !== 'false';
  const autoIntel = localStorage.getItem('sys_auto_intel') !== 'false';
  const strictConfirm = localStorage.getItem('sys_strict_confirm') !== 'false';

  container.innerHTML = `
    <section id="config" class="section hidden">
      <div class="config-matrix">
          <div class="config-header">
              <h1 class="matrix-title">SYSTEM CONFIGURATION</h1>
              <p class="matrix-subtitle">Core execution parameters and AI behavior overrides</p>
          </div>

          <div class="config-panel">
              <div class="panel-label">[ AI COACH PERSONA MATRIX ]</div>
              <div class="persona-selector">
                  <label class="persona-option">
                      <input type="radio" class="persona-radio" name="coachPersona" value="RUTHLESS_MODE" checked>
                      <span class="persona-card">
                          <span class="p-title">RUTHLESS</span>
                          <span class="p-desc">Zero tolerance. Maximum roast.</span>
                      </span>
                  </label>
                  <label class="persona-option">
                      <input type="radio" class="persona-radio" name="coachPersona" value="ANALYTICAL_MODE">
                      <span class="persona-card">
                          <span class="p-title">ANALYTICAL</span>
                          <span class="p-desc">Data-driven performance review.</span>
                      </span>
                  </label>
                  <label class="persona-option">
                      <input type="radio" class="persona-radio" name="coachPersona" value="SILENT_OBSERVER">
                      <span class="persona-card">
                          <span class="p-title">SILENT</span>
                          <span class="p-desc">No feedback. Just execution.</span>
                      </span>
                  </label>
              </div>
          </div>

          <div class="config-panel">
              <div class="panel-label">[ RUNTIME PROTOCOLS ]</div>
              <div class="toggle-group">
                  <label class="cyber-toggle">
                      <span class="toggle-label">Alert Sound Override</span>
                      <input id="toggleSound" type="checkbox" ${soundOverride ? 'checked' : ''}>
                      <span class="toggle-track"></span>
                  </label>
                  <label class="cyber-toggle">
                      <span class="toggle-label">Auto Intel Feed Refresh</span>
                      <input id="toggleAutoIntel" type="checkbox" ${autoIntel ? 'checked' : ''}>
                      <span class="toggle-track"></span>
                  </label>
                  <label class="cyber-toggle">
                      <span class="toggle-label">Strict Reset Confirmation</span>
                      <input id="toggleStrictConfirm" type="checkbox" ${strictConfirm ? 'checked' : ''}>
                      <span class="toggle-track"></span>
                  </label>
              </div>
          </div>

          <div class="config-panel two-col">
              <div class="col-item">
                  <div class="panel-label">[ THEME ENGINE ]</div>
                  <div class="custom-select-wrapper">
                      <select id="themeSelect" class="cyber-select">
                          <option value="cyberpunk" ${currentTheme === 'cyberpunk' ? 'selected' : ''}>Terminal Dark (Default)</option>
                          <option value="psycoframe">Psycoframe Green</option>
                          <option value="bloodiron">Blood Iron Red</option>
                      </select>
                  </div>
              </div>
              <div class="col-item">
                  <div class="panel-label">[ STATE PROFILES ]</div>
                  <div class="action-buttons">
                      <button id="savePresetBtn" class="cyber-btn default">SAVE</button>
                      <button id="loadPresetBtn" class="cyber-btn ghost">LOAD</button>
                      <button id="deletePresetBtn" class="cyber-btn delete">DEL</button>
                  </div>
              </div>
          </div>

          <div class="config-panel danger-zone">
              <div class="panel-label text-red">[ CRITICAL ACTIONS ]</div>
              <p class="warning-text">WARNING: Resetting will permanently purge all execution score history. This action violates core discipline directives if done without cause.</p>
              <div class="danger-actions">
                  <button id="backupStateBtn" class="cyber-btn ghost-red">BACKUP LOCAL STATE</button>
                  <button id="resetBtn" class="cyber-btn destructive">PURGE CORE SCORE</button>
              </div>
          </div>
      </div>
    </section>
  `;
}
