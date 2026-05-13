import { getTranslation } from '../js/i18n.js';

export function renderSystemConfig(container) {
  const currentTheme = localStorage.getItem('user_theme') || 'cyberpunk';
  const soundOverride = localStorage.getItem('sys_sound_override') !== 'false';
  const autoIntel = localStorage.getItem('sys_auto_intel') !== 'false';
  const strictConfirm = localStorage.getItem('sys_strict_confirm') !== 'false';

  container.innerHTML = `
    <section id="config" class="section hidden">
      <div class="config-matrix">
          <div class="config-header">
              <h1 class="matrix-title" data-i18n="sys_config_title">${getTranslation('sys_config_title')}</h1>
              <p class="matrix-subtitle" data-i18n="sys_config_desc">${getTranslation('sys_config_desc')}</p>
          </div>

          <div class="config-panel">
              <div class="panel-label" data-i18n="ai_persona_matrix">${getTranslation('ai_persona_matrix')}</div>
              <div class="persona-selector">
                  <label class="persona-option">
                      <input type="radio" class="persona-radio" name="coachPersona" value="RUTHLESS_MODE" checked>
                      <span class="persona-card">
                          <span class="p-title" data-i18n="ruthless">${getTranslation('ruthless')}</span>
                          <span class="p-desc" data-i18n="ruthless_desc">${getTranslation('ruthless_desc')}</span>
                      </span>
                  </label>
                  <label class="persona-option">
                      <input type="radio" class="persona-radio" name="coachPersona" value="ANALYTICAL_MODE">
                      <span class="persona-card">
                          <span class="p-title" data-i18n="analytical">${getTranslation('analytical')}</span>
                          <span class="p-desc" data-i18n="analytical_desc">${getTranslation('analytical_desc')}</span>
                      </span>
                  </label>
                  <label class="persona-option">
                      <input type="radio" class="persona-radio" name="coachPersona" value="SILENT_OBSERVER">
                      <span class="persona-card">
                          <span class="p-title" data-i18n="silent">${getTranslation('silent')}</span>
                          <span class="p-desc" data-i18n="silent_desc">${getTranslation('silent_desc')}</span>
                      </span>
                  </label>
              </div>
          </div>

          <div class="config-panel">
              <div class="panel-label" data-i18n="runtime_protocols">${getTranslation('runtime_protocols')}</div>
              <div class="toggle-group">
                  <label class="cyber-toggle">
                      <span class="toggle-label" data-i18n="alert_sound">${getTranslation('alert_sound')}</span>
                      <input id="toggleSound" type="checkbox" ${soundOverride ? 'checked' : ''}>
                      <span class="toggle-track"></span>
                  </label>
                  <label class="cyber-toggle">
                      <span class="toggle-label" data-i18n="auto_intel">${getTranslation('auto_intel')}</span>
                      <input id="toggleAutoIntel" type="checkbox" ${autoIntel ? 'checked' : ''}>
                      <span class="toggle-track"></span>
                  </label>
                  <label class="cyber-toggle">
                      <span class="toggle-label" data-i18n="strict_reset">${getTranslation('strict_reset')}</span>
                      <input id="toggleStrictConfirm" type="checkbox" ${strictConfirm ? 'checked' : ''}>
                      <span class="toggle-track"></span>
                  </label>
              </div>
          </div>

          <div class="config-panel two-col">
              <div class="col-item">
                  <div class="panel-label" data-i18n="theme_engine">${getTranslation('theme_engine')}</div>
                  <div class="custom-select-wrapper">
                      <select id="themeSelect" class="cyber-select">
                          <option value="cyberpunk" ${currentTheme === 'cyberpunk' ? 'selected' : ''}>Terminal Dark (Default)</option>
                          <option value="psycoframe" ${currentTheme === 'psycoframe' ? 'selected' : ''}>Psycoframe Green</option>
                          <option value="bloodiron" ${currentTheme === 'bloodiron' ? 'selected' : ''}>Blood Iron Red</option>
                      </select>
                  </div>
              </div>
              <div class="col-item">
                  <div class="panel-label" data-i18n="state_profiles">${getTranslation('state_profiles')}</div>
                  <div style="display:flex; gap:8px; margin-bottom:10px; align-items:center;">
                      <input id="profileNameInput" class="cyber-select" style="flex:1; padding:6px 10px; font-size:11px;" data-i18n-placeholder="profile_placeholder" placeholder="${getTranslation('profile_placeholder')}" type="text">
                  </div>
                  <div class="action-buttons">
                      <button id="savePresetBtn" class="cyber-btn default" data-i18n="btn_save">${getTranslation('btn_save')}</button>
                      <button id="loadPresetBtn" class="cyber-btn ghost" data-i18n="btn_load">${getTranslation('btn_load')}</button>
                      <button id="deletePresetBtn" class="cyber-btn delete" data-i18n="btn_del">${getTranslation('btn_del')}</button>
                  </div>
                  <select id="profileSelect" class="cyber-select" style="margin-top:10px; font-size:11px;">
                      <option value="" data-i18n="select_profile">${getTranslation('select_profile')}</option>
                  </select>
              </div>
          </div>

          <div class="config-panel danger-zone">
              <div class="panel-label text-red" data-i18n="critical_actions">${getTranslation('critical_actions')}</div>
              <p class="warning-text" data-i18n="purge_warning">${getTranslation('purge_warning')}</p>
              <div class="danger-actions">
                  <button id="backupStateBtn" class="cyber-btn ghost-red" data-i18n="btn_backup">${getTranslation('btn_backup')}</button>
                  <button id="importStateBtn" class="cyber-btn ghost-red" data-i18n="btn_import">${getTranslation('btn_import')}</button>
                  <button id="resetBtn" class="cyber-btn destructive" data-i18n="btn_purge">${getTranslation('btn_purge')}</button>
              </div>
              <input id="importFileInput" type="file" accept=".json" style="display:none;">
          </div>
      </div>
    </section>
  `;
}

