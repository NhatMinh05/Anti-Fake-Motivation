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

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    const msg = document.getElementById('loginMsg');
    
    if (!u || !p) {
      msg.textContent = 'ERR: Missing credentials.';
      return;
    }
    
    msg.textContent = 'AUTHENTICATING...';
    msg.style.color = '#38BDF8';

    try {
      // Create x-www-form-urlencoded data required by OAuth2PasswordRequestForm
      const params = new URLSearchParams();
      params.append('username', u);
      params.append('password', p);

      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!res.ok) {
        // If login failed, maybe they are a new user. Let's auto-register them!
        // This is a feature: "First time? You are registered."
        msg.textContent = 'NOT FOUND. REGISTERING NEW OPERATIVE...';
        
        const regRes = await fetch('http://localhost:8000/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        
        if (regRes.ok) {
          msg.textContent = 'REGISTERED. LOGGING IN...';
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
          }
        } else {
          msg.textContent = 'ACCESS DENIED: INVALID CREDENTIALS';
          msg.style.color = '#fb7185';
        }
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
