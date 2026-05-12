import { getMe, updateMe, deleteMe, logout } from '/js/api.js';
import { setLanguage, getTranslation } from '/js/i18n.js';

export async function renderAccount(container) {
  const currentLang = localStorage.getItem('sys_lang') || 'en';
  let user = { username: 'Operative', avatar_url: null, id: '???', display_name: '', bio: '' };
  try {
    user = await getMe();
  } catch (e) {
    console.error('Failed to load user for account page:', e);
  }

  const avatar = user.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.username}`;
  
  container.innerHTML = `
    <div id="account" class="section hidden">
      <header class="section-header">
        <h2>${getTranslation('user_profile')}</h2>
        <p>Manage your identity and operational parameters</p>
      </header>

      <div class="account-settings-wrapper">
        <aside class="settings-sidebar">
          <h3 class="settings-title">ACCOUNT_SETTINGS</h3>
          <ul class="settings-menu" id="accountMenu">
            <li class="active" data-tab="tab-profile">${getTranslation('user_profile')}</li>
            <li data-tab="tab-security">${getTranslation('security_auth')}</li>
            <li data-tab="tab-preferences">${getTranslation('preferences')}</li>
            <li class="danger-link" data-tab="tab-danger">${getTranslation('danger_zone')}</li>
          </ul>
        </aside>

        <main class="settings-content">
          <section id="tab-profile" class="tab-pane active">
            <h2 class="pane-header">[ PUBLIC_IDENTITY ]</h2>
            <div class="profile-edit-grid">
              <div class="avatar-section">
                <div class="avatar-box">
                  <img src="${avatar}" id="preview-avatar">
                  <div class="status-badge">ACTIVE</div>
                </div>
                <button class="btn-outline">UPLOAD NEW IMAGE</button>
              </div>
              <div class="info-section">
                <div class="form-group">
                  <label>USER ID (Read-only)</label>
                  <input type="text" value="#${user.id}" readonly class="locked-input">
                </div>
                <div class="form-group">
                  <label>DISPLAY NAME</label>
                  <input type="text" id="editDisplayName" value="${user.display_name || ''}" placeholder="Enter alias...">
                </div>
                <div class="form-group">
                  <label>BIOGRAPHY / QUOTE</label>
                  <textarea id="editBio" placeholder="Enter your discipline mantra..." rows="3">${user.bio || ''}</textarea>
                </div>
                <button class="btn-primary" id="saveProfileBtn">${getTranslation('save_changes')}</button>
              </div>
            </div>
          </section>

          <section id="tab-security" class="tab-pane">
            <h2 class="pane-header">[ SECURITY_AUTH ]</h2>
            <div class="security-block">
              <h3>Connected Accounts</h3>
              <div class="social-link-item">
                <div class="social-info">GITHUB</div>
                <button class="btn-disconnect">DISCONNECT</button>
              </div>
              <div class="social-link-item">
                <div class="social-info">GOOGLE</div>
                <button class="btn-outline">LINKED</button>
              </div>
            </div>
          </section>

          <section id="tab-preferences" class="tab-pane">
            <h2 class="pane-header">[ SYSTEM_PREFERENCES ]</h2>
            <div class="info-section">
              <div class="form-group">
                <label>${getTranslation('language')}</label>
                <select id="langSelect" style="background: #151520; border: 1px solid #38BDF8; color: #FFF; padding: 10px;">
                  <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English (US)</option>
                  <option value="vi" ${currentLang === 'vi' ? 'selected' : ''}>Tiếng Việt</option>
                </select>
              </div>
            </div>
          </section>

          <section id="tab-danger" class="tab-pane">
            <h2 class="pane-header" style="color: #FB7185;">[ DANGER_ZONE ]</h2>
            <div class="security-block" style="border: 1px solid rgba(251, 113, 133, 0.2);">
              <h3 style="color: #FB7185;">Permanent Actions</h3>
              <button class="btn-disconnect" id="deleteAccountBtn" style="padding: 12px 24px;">DELETE ACCOUNT</button>
            </div>
          </section>
        </main>
      </div>
    </div>
  `;

  // TAB SWITCHING
  const menuItems = container.querySelectorAll('.settings-menu li');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      container.querySelectorAll('.settings-menu li').forEach(i => i.classList.remove('active'));
      container.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const targetPane = container.querySelector('#' + tabId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // LANGUAGE SWITCH
  const langSelect = container.querySelector('#langSelect');
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
  }

  // SAVE CHANGES
  const saveBtn = container.querySelector('#saveProfileBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const display_name = container.querySelector('#editDisplayName').value.trim();
      const bio = container.querySelector('#editBio').value.trim();
      saveBtn.disabled = true;
      saveBtn.textContent = '...';
      try {
        await updateMe({ display_name, bio });
        if (window.toast) window.toast(getTranslation('success_msg'), 'success');
        const sideUsername = document.getElementById('sideUsername');
        if (sideUsername) sideUsername.textContent = display_name.toUpperCase();
      } catch (e) {
        if (window.toast) window.toast('Error', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = getTranslation('save_changes');
      }
    });
  }

  // DELETE ACCOUNT
  const deleteBtn = container.querySelector('#deleteAccountBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('WARNING: DELETE ALL DATA?')) return;
      try {
        await deleteMe();
        logout();
      } catch (e) {
        alert('Error');
      }
    });
  }
}
