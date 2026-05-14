window.loginWithGithub = function() {
  console.log("Redirecting to Backend...");
  window.location.href = "http://127.0.0.1:8000/api/auth/github/login";
};

window.loginWithGoogle = function() {
  console.log("Redirecting to Google Gateway...");
  window.location.href = "http://127.0.0.1:8000/api/auth/google/login";
};

const bootLines = [
  "INITIALIZING DISCIPLINE OS...",
  "LOADING KERNEL MODULES... [OK]",
  "MOUNTING ENCRYPTED FILE SYSTEM... [OK]",
  "ESTABLISHING SECURE UPLINK TO MOTHERBASE... [OK]",
  "BYPASSING CIVILIAN FIREWALLS... [OK]",
  "SYNCING NEURAL INTERFACE... [OK]",
  "CHECKING BIOMETRIC CLEARANCE... [FAILED]",
  "MANUAL OVERRIDE REQUIRED.",
  "PROMPT: ENTER OPERATIVE CREDENTIALS."
];

async function runBootSequence() {
  const terminal = document.getElementById('bootSequence');
  for (let i = 0; i < bootLines.length; i++) {
    const line = document.createElement('div');
    line.className = 'term-line';
    line.textContent = `> ${bootLines[i]}`;
    terminal.appendChild(line);
    // Random delay between 100ms and 400ms
    await new Promise(r => setTimeout(r, Math.random() * 300 + 100));
  }
  
  await new Promise(r => setTimeout(r, 500));
  terminal.classList.add('hidden');
  document.getElementById('loginFormContainer').classList.remove('hidden');
  document.getElementById('username').focus();
}

document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  if (localStorage.getItem('access_token')) {
    window.location.href = 'index.html';
    return;
  }
  runBootSequence();

  // 1. Chức năng Hiện/Ẩn Passcode
  const togglePassBtn = document.getElementById('togglePass');
  const passInput = document.getElementById('password');

  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        togglePassBtn.textContent = '[ HIDE ]';
        togglePassBtn.style.color = '#38bdf8'; // Sáng màu lên
      } else {
        passInput.type = 'password';
        togglePassBtn.textContent = '[ SHOW ]';
        togglePassBtn.style.color = '#64748b'; // Trở lại màu xám
      }
    });
  }

  let isRegisterMode = false;
  const enrollBtn = document.getElementById('enrollNew');
  const btnAuth = document.getElementById('btnAuth');
  const boxHeader = document.querySelector('.box-header');

  enrollBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    if (isRegisterMode) {
      btnAuth.textContent = 'SIGN UP';
      boxHeader.textContent = '[ NEW OPERATIVE ENROLLMENT ]';
      enrollBtn.textContent = '[ BACK TO LOGIN ]';
      const muted = document.querySelector('.muted-text');
      if (muted) muted.textContent = 'Existing Operative?';
    } else {
      btnAuth.textContent = 'LOG IN';
      boxHeader.textContent = '[ SYSTEM AUTHENTICATION ]';
      enrollBtn.textContent = '[ REGISTER ]';
      const muted = document.querySelector('.muted-text');
      if (muted) muted.textContent = 'New Operative?';
    }
  });

  console.log("SYSTEM: Authentication modules initialized.");
  
  // Nút GitHub và Google đã được xử lý trực tiếp bằng onclick trong HTML

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    const msg = document.getElementById('loginMsg');
    
    if (!u || !p) {
      msg.textContent = 'ERR: Missing credentials.';
      return;
    }
    
    msg.textContent = isRegisterMode ? 'ENROLLING...' : 'AUTHENTICATING...';
    msg.style.color = '#38BDF8';

    try {
      if (isRegisterMode) {
        // EXPLICIT REGISTER
        const regRes = await fetch('http://localhost:8000/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        if (regRes.ok) {
          msg.textContent = 'ENROLLMENT SUCCESS. LOGGING IN...';
          msg.style.color = '#34d399';
          // Fall through to login logic
        } else {
          const errData = await regRes.json();
          msg.textContent = `ERR: ${errData.detail || 'ENROLLMENT FAILED'}`;
          msg.style.color = '#fb7185';
          return;
        }
      }

      // LOGIN LOGIC
      const params = new URLSearchParams();
      params.append('username', u);
      params.append('password', p);

      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!res.ok) {
        if (!isRegisterMode) {
           // Auto-register fallback for convenience if not in register mode
           msg.textContent = 'NOT FOUND. TRYING AUTO-ENROLL...';
           const regRes = await fetch('http://localhost:8000/api/auth/register', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ username: u, password: p })
           });
           if (regRes.ok) {
             // Try login again
             const retryRes = await fetch('http://localhost:8000/api/auth/login', {
               method: 'POST',
               headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
               body: params.toString()
             });
             const retryData = await retryRes.json();
             if (retryData.access_token) {
               localStorage.setItem('access_token', retryData.access_token);
               window.location.href = 'index.html';
               return;
             }
           }
        }
        msg.textContent = 'ACCESS DENIED: INVALID CREDENTIALS';
        msg.style.color = '#fb7185';
      } else {
        const data = await res.json();
        if (data.access_token) {
          localStorage.setItem('access_token', data.access_token);
          msg.textContent = 'ACCESS GRANTED. DECRYPTING BASE...';
          msg.style.color = '#34d399';
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 500);
        }
      }
    } catch (err) {
      msg.textContent = 'ERR: CONNECTION SEVERED.';
      msg.style.color = '#fb7185';
    }
  });
});
