import { getMe, updateMe, deleteMe, logout, disconnectProvider } from '/js/api.js';
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
                <button class="btn-outline" id="uploadAvatarBtn">UPLOAD NEW IMAGE</button>
                <input type="file" id="avatarFileInput" accept="image/*" style="display: none;">
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
                ${user.github_id ? '<button class="btn-disconnect" id="unlinkGithubBtn">DISCONNECT</button>' : '<button class="btn-outline" id="linkGithubBtn">CONNECT</button>'}
              </div>
              <div class="social-link-item">
                <div class="social-info">GOOGLE</div>
                ${user.google_id ? '<button class="btn-disconnect" id="unlinkGoogleBtn">DISCONNECT</button>' : '<button class="btn-outline" id="linkGoogleBtn">CONNECT</button>'}
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
      document.querySelectorAll('.settings-menu li').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const targetPane = document.getElementById(tabId);
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
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const display_name = document.querySelector('#editDisplayName').value.trim();
      const bio = document.querySelector('#editBio').value.trim();

      if (!display_name) {
        if (window.toast) window.toast("Display name cannot be empty", "error");
        return;
      }

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

  // AVATAR UPLOAD
  const uploadBtn = container.querySelector('#uploadAvatarBtn');
  const fileInput = container.querySelector('#avatarFileInput');
  const previewImg = container.querySelector('#preview-avatar');

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        if (window.toast) window.toast('File too large (Max 2MB)', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        previewImg.src = base64;
        
        try {
          await updateMe({ avatar_url: base64 });
          if (window.toast) window.toast('Identity visual updated', 'success');
          
          // Update sidebar avatar if exists
          const sideAvatar = document.getElementById('sideAvatar');
          if (sideAvatar) sideAvatar.src = base64;
        } catch (err) {
          if (window.toast) window.toast('Update failed', 'error');
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // --- SOCIAL ACCOUNT LINKING ---
  const token = localStorage.getItem('access_token');

  // GitHub
  const linkGithubBtn = container.querySelector('#linkGithubBtn');
  const unlinkGithubBtn = container.querySelector('#unlinkGithubBtn');
  if (linkGithubBtn) {
    linkGithubBtn.addEventListener('click', () => {
      window.location.href = `http://127.0.0.1:8000/api/auth/github/login?token=${token}`;
    });
  }
  if (unlinkGithubBtn) {
    unlinkGithubBtn.addEventListener('click', async () => {
      if (!confirm('Disconnect GitHub account?')) return;
      try {
        await disconnectProvider('github');
        if (window.toast) window.toast('GitHub disconnected', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // Google
  const linkGoogleBtn = container.querySelector('#linkGoogleBtn');
  const unlinkGoogleBtn = container.querySelector('#unlinkGoogleBtn');
  if (linkGoogleBtn) {
    linkGoogleBtn.addEventListener('click', () => {
      window.location.href = `http://127.0.0.1:8000/api/auth/google/login?token=${token}`;
    });
  }
  if (unlinkGoogleBtn) {
    unlinkGoogleBtn.addEventListener('click', async () => {
      if (!confirm('Disconnect Google account?')) return;
      try {
        await disconnectProvider('google');
        if (window.toast) window.toast('Google disconnected', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }
}
