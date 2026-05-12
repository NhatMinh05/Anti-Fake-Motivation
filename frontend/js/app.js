import { state, getActiveConversation } from './state.js';
import { api, fetchDashboardData, logDay, resetScore, setPersonalityMode, updateConfig, fetchIntel, getMe, logout } from './api.js';
import { renderSidebar, bindSidebarNavigation } from '../components/sidebar.js';
import { renderDashboard, updateScore } from '../components/dashboard.js';
import { renderIntelFeed } from '../components/intelFeed.js';
import { renderStrikeRecord } from '../components/strikeRecord.js';
import { renderSystemConfig } from '../components/systemConfig.js';
import { renderAccount } from '../components/account.js';
import {
  renderAIDrawer,
  loadConversations,
  saveConversations,
  renderConversationList,
  renderActiveConversation,
  appendChat,
  bindConversationButtons
} from '../components/aiDrawer.js';

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================
const TOAST_ICONS = { success: '✅', error: '❌', warning: '⚠️', info: '📡' };
function toast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${TOAST_ICONS[type] || '📡'}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration + 300);
}

// ============================================================
// OFFLINE BANNER
// ============================================================
function showOfflineBanner(msg = '⚠️ BACKEND OFFLINE — Attempting reconnection...') {
  let banner = document.getElementById('offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    document.body.prepend(banner);
  }
  banner.textContent = msg;
  banner.classList.add('visible');
}
function hideOfflineBanner() {
  document.getElementById('offline-banner')?.classList.remove('visible');
}

// ============================================================
// DEBOUNCE UTILITY
// ============================================================
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ============================================================
// INTEL CACHE
// ============================================================
const intelCache = { data: null, ts: 0, timeframe: null };
const INTEL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function showSection(id) {
  ['mission', 'intel', 'record', 'config', 'account'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('hidden', s !== id);
  });
}

function statusBadge(status) {
  const cls = status === 'SUCCESS' ? 'color: #34d399' : 'color: #fb7185';
  return `<span style="${cls}">${status}</span>`;
}

function renderHistoryTable() {
  const body = document.getElementById('historyBody');
  if (!body) return;

  const searchInput = document.getElementById('recordSearch');
  const statusSelect = document.getElementById('recordStatusFilter');
  const sortSelect = document.getElementById('recordSort');

  const search = searchInput ? searchInput.value.toLowerCase() : '';
  const status = statusSelect ? statusSelect.value : 'ALL';
  const sortMode = sortSelect ? sortSelect.value : 'newest';

  let filtered = state.history.filter(item => {
    if (status !== 'ALL' && item.status !== status) return false;
    if (search) {
      const notes = (item.notes || '').toLowerCase();
      if (!notes.includes(search)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortMode === 'newest') return new Date(b.timestamp) - new Date(a.timestamp);
    if (sortMode === 'oldest') return new Date(a.timestamp) - new Date(b.timestamp);
    if (sortMode === 'delta_high') return b.delta - a.delta;
    if (sortMode === 'delta_low') return a.delta - b.delta;
    return 0;
  });

  body.innerHTML = filtered.map(item => `
    <tr>
      <td>${new Date(item.timestamp).toLocaleString()}</td>
      <td>${statusBadge(item.status)}</td>
      <td>${item.delta > 0 ? '+' : ''}${item.delta}</td>
      <td>${item.notes || '-'}</td>
    </tr>
  `).join('');
}

function buildDayMap(records) {
  const map = new Map();
  records.forEach(r => map.set(r.date, r.status));
  return map;
}

function renderHeatmap30(rangeData) {
  const root = document.getElementById('heatmap30');
  if (!root) return;
  const map = buildDayMap(rangeData);
  root.innerHTML = '';
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const status = map.get(key);
    const cell = document.createElement('div');
    cell.className = 'heat-square';
    cell.style.width = '14px';
    cell.style.height = '14px';
    cell.style.background = status === 'SUCCESS' ? 'rgba(52,211,153,.9)' : status === 'FAILURE' ? 'rgba(251,113,133,.9)' : '#1a2030';
    root.appendChild(cell);
  }
}

function renderAnnualHeatmap(rangeData) {
  const root = document.getElementById('annualHeatmap');
  const monthsRoot = document.getElementById('ghMonths');
  if (!root || !monthsRoot) return;
  
  const map = buildDayMap(rangeData);
  root.innerHTML = '';
  monthsRoot.innerHTML = '';
  
  const today = new Date();
  const todayDayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  
  // Total days to show: 52 full weeks (364 days) + days elapsed in current week
  const totalDays = 52 * 7 + todayDayOfWeek + 1; 
  let lastMonth = -1;
  const colWidth = 13; // 10px width + 3px gap
  
  let col = null;
  let colIndex = 0;

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay();
    
    // Create a new column if it's the very first day or if it's Sunday
    if (dayOfWeek === 0 || !col) {
      col = document.createElement('div');
      col.style.display = 'grid';
      col.style.gridTemplateRows = 'repeat(7, 10px)';
      col.style.gap = '3px';
      root.appendChild(col);
      
      // If it's the first column and doesn't start on Sunday, pad it with empty cells
      if (i === totalDays - 1 && dayOfWeek !== 0) {
         for(let pad=0; pad<dayOfWeek; pad++) {
           const emptyCell = document.createElement('div');
           emptyCell.style.width = '10px';
           emptyCell.style.height = '10px';
           col.appendChild(emptyCell);
         }
      }
      
      const m = d.getMonth();
      // Only place month label if the month changed, and ensure labels don't overlap too much
      // Wait, let's just place it if month changed.
      if (m !== lastMonth) { 
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mLabel = document.createElement('span');
        mLabel.className = 'gh-month-label';
        mLabel.textContent = monthNames[m];
        mLabel.style.left = `${colIndex * colWidth}px`;
        monthsRoot.appendChild(mLabel);
        lastMonth = m;
      }
      colIndex++;
    }
    
    const key = d.toISOString().slice(0, 10);
    const status = map.get(key);
    const cell = document.createElement('div');
    cell.className = 'mini-heat-square';
    cell.style.width = '10px';
    cell.style.height = '10px';
    cell.style.background = status === 'SUCCESS' ? 'rgba(52,211,153,.95)' : status === 'FAILURE' ? 'rgba(251,113,133,.95)' : '#1a2030';
    cell.title = `${key}: ${status ? status : 'No data'}`;
    col.appendChild(cell);
  }
}

function renderTrendChart(intelData, mode = 'line') {
  const svg = document.getElementById('trendChart');
  if (!svg) return;
  const data = intelData.trend || [];
  svg.innerHTML = '';
  const w = 700, h = 220, pad = 24;

  // Setup Definitions for Gradients
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.0" />
    </linearGradient>
    <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#34d399" stop-opacity="0.2" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  `;
  svg.appendChild(defs);

  const axis = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  axis.setAttribute('d', `M ${pad} ${h - pad} L ${w - pad} ${h - pad} M ${pad} ${pad} L ${pad} ${h - pad}`);
  axis.setAttribute('stroke', '#2c3b53');
  axis.setAttribute('fill', 'none');
  svg.appendChild(axis);

  if (!data.length) {
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', w/2); txt.setAttribute('y', h/2);
    txt.setAttribute('fill', '#475569'); txt.setAttribute('text-anchor', 'middle');
    txt.textContent = 'NO DATA AVAILABLE';
    svg.appendChild(txt);
    return;
  }
  
  const min = Math.min(...data.map(d => d.score), 0);
  const max = Math.max(...data.map(d => d.score), 1);
  const span = Math.max(max - min, 1);

  if (mode === 'line') {
    const coords = data.map((d, i) => {
      const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - ((d.score - min) / span) * (h - pad * 2);
      return { x, y, score: d.score };
    });
    
    const points = coords.map(c => `${c.x},${c.y}`).join(' ');
    
    // Gradient Polygon underneath
    if (coords.length > 1) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      const polyPoints = `${first.x},${h - pad} ${points} ${last.x},${h - pad}`;
      
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', polyPoints);
      polygon.setAttribute('fill', 'url(#lineGrad)');
      svg.appendChild(polygon);
    }

    // Main line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', points);
    line.setAttribute('stroke', '#38BDF8');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('filter', 'url(#glow)');
    svg.appendChild(line);
    
    // Points
    coords.forEach(c => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', c.x);
      circle.setAttribute('cy', c.y);
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', '#131313');
      circle.setAttribute('stroke', c.score > 0 ? '#34d399' : (c.score < 0 ? '#fb7185' : '#38BDF8'));
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('class', 'chart-point');
      svg.appendChild(circle);
    });
  } else {
    // Bar chart
    const barW = ((w - pad * 2) / data.length) * 0.8;
    data.forEach((d, i) => {
      const x = pad + (i / data.length) * (w - pad * 2) + barW * 0.1;
      const y0 = h - pad - ((0 - min) / span) * (h - pad * 2);
      const y = h - pad - ((d.score - min) / span) * (h - pad * 2);
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('width', Math.max(barW, 2));
      rect.setAttribute('y', Math.min(y, y0));
      rect.setAttribute('height', Math.max(Math.abs(y0 - y), 2));
      rect.setAttribute('rx', '2'); // Rounded corners
      
      let fillType = d.score > 0 ? 'url(#barGrad)' : (d.score < 0 ? '#fb7185' : '#1e293b');
      if (d.score > 0) {
        rect.setAttribute('fill', 'url(#barGrad)');
      } else if (d.score < 0) {
        rect.setAttribute('fill', '#e11d48');
      } else {
        rect.setAttribute('fill', '#1e293b');
      }
      
      svg.appendChild(rect);
    });
  }
}

function renderGauge(intelData) {
  const gauge = document.getElementById('ratioGauge');
  const ratioText = document.getElementById('ratioText');
  if (!gauge || !ratioText) return;
  const ratio = intelData.ratio || 0;
  const radius = 62;
  const circ = 2 * Math.PI * radius;
  const dash = (ratio / 100) * circ;
  
  const color = ratio >= 70 ? '#34d399' : (ratio >= 40 ? '#facc15' : '#fb7185');
  const glowColor = ratio >= 70 ? '#10b981' : (ratio >= 40 ? '#ca8a04' : '#e11d48');

  gauge.innerHTML = `
    <defs>
      <linearGradient id="gaugeGrad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${glowColor}" />
        <stop offset="100%" stop-color="${color}" />
      </linearGradient>
      <filter id="gaugeGlow">
        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <circle cx="80" cy="80" r="${radius}" stroke="#1e293b" stroke-width="12" fill="none"></circle>
    <circle cx="80" cy="80" r="${radius}" stroke="url(#gaugeGrad)" stroke-width="12" fill="none"
      stroke-dasharray="${dash} ${circ - dash}" transform="rotate(-90 80 80)" 
      style="transition: stroke-dasharray 1s ease-out;" stroke-linecap="round" filter="url(#gaugeGlow)"></circle>
    <text x="80" y="86" text-anchor="middle" fill="${color}" font-size="20" font-weight="bold">${ratio}%</text>
  `;
  ratioText.textContent = `${ratio}% SUCCESS`;
  ratioText.style.color = color;
  ratioText.style.textShadow = `0 0 10px ${color}40`;
}

function renderIntel(intelData) {
  const intelList = document.getElementById('intelList');
  if (!intelList) return;
  intelList.innerHTML = intelData.intel.map(n => `<li>${n}</li>`).join('');
}

async function refreshIntelView() {
    const tfSelect = document.getElementById('intelTimeframe');
    const modeSelect = document.getElementById('intelChartMode');
    if (!tfSelect || !modeSelect) return;

    const timeframe = parseInt(tfSelect.value, 10) || 30;
    const mode = modeSelect.value;
    const now = Date.now();

    // Serve from cache if fresh and same timeframe
    if (intelCache.data && intelCache.timeframe === timeframe && (now - intelCache.ts) < INTEL_CACHE_TTL) {
        renderTrendChart(intelCache.data, mode);
        renderGauge(intelCache.data);
        renderIntel(intelCache.data);
        return;
    }

    const intelList = document.getElementById('intelList');
    if (intelList) intelList.innerHTML = '<li style="color:#64748b;">Analysing data via DeepSeek...</li>';

    try {
        const intelData = await fetchIntel(timeframe);
        // Update cache
        intelCache.data = intelData;
        intelCache.ts = Date.now();
        intelCache.timeframe = timeframe;

        renderTrendChart(intelData, mode);
        renderGauge(intelData);
        renderIntel(intelData);
    } catch (e) {
        console.error('Failed to load intel:', e);
        if (intelList) intelList.innerHTML = '<li style="color:#fb7185;">Error: Failed to connect to intel base.</li>';
        toast('Intel feed connection failed.', 'error');
    }
}

async function _refreshAll() {
  try {
    const { scoreData, historyData, rangeData, analytics, configData } = await fetchDashboardData();
    hideOfflineBanner();

    state.score = scoreData.total_score;
    state.history = historyData;
    state.trend = analytics.trend_30d || [];
    state.success30 = analytics.success_30d || 0;
    state.failure30 = analytics.failure_30d || 0;

    // #2 Single source of truth — backend is authoritative for streak/shields
    if (configData.discipline_streak !== undefined) {
      localStorage.setItem('discipline_streak', String(configData.discipline_streak));
    }
    if (configData.streak_shields !== undefined) {
      localStorage.setItem('streak_shields', String(configData.streak_shields));
    }

    // #1 Sync Persona radio button from backend
    if (configData.personality_mode) {
      state.personalityMode = configData.personality_mode;
      document.querySelectorAll('.persona-radio').forEach(r => {
        r.checked = r.value === configData.personality_mode;
      });
    }

    // Sync sidebar stats
    const sideStreak = document.getElementById('sideStreak');
    const sideShield = document.getElementById('sideShield');
    if (sideStreak) sideStreak.textContent = localStorage.getItem('discipline_streak') || '0';
    if (sideShield) sideShield.textContent = localStorage.getItem('streak_shields') || '0';

    // Fetch User Info for Sidebar
    try {
      const user = await getMe();
      const sideUsername = document.getElementById('sideUsername');
      const opAvatar = document.getElementById('opAvatar');
      
      if (sideUsername) sideUsername.textContent = user.username.toUpperCase();
      if (opAvatar) {
        if (user.avatar_url) {
          opAvatar.innerHTML = `<img src="${user.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
          opAvatar.style.border = 'none';
        } else {
          opAvatar.textContent = user.username.charAt(0).toUpperCase();
        }
      }
    } catch (err) {
      console.warn('Failed to fetch user info:', err);
    }

    updateScore(state.score);
    renderHistoryTable();
    renderHeatmap30(rangeData.slice(-30));
    renderAnnualHeatmap(rangeData);

    const statTotalDays = document.getElementById('statTotalDays');
    const statWinRate = document.getElementById('statWinRate');
    if (statTotalDays) statTotalDays.textContent = analytics.total_days || 0;
    if (statWinRate) statWinRate.textContent = (analytics.overall_rate || 0) + '%';
  } catch (err) {
    // #3 Error boundary — show offline banner instead of crashing
    console.error('refreshAll error:', err);
    showOfflineBanner();
  }
}
// #6 Debounced wrapper — prevents hammering the API on rapid events
const refreshAll = debounce(_refreshAll, 400);

function setChatSendingState(sending) {
  state.isChatSending = sending;
  const send = document.getElementById('sendChatBtn');
  const stop = document.getElementById('stopChatBtn');
  const input = document.getElementById('chatInput');
  if (!send || !stop || !input) return;
  send.disabled = sending;
  input.disabled = sending;
  send.textContent = sending ? 'Sending...' : 'Send';
  stop.classList.toggle('hidden', !sending);
}

function appendLoadingBubble() {
  const log = document.getElementById('chatLog');
  if (!log) return;
  const node = document.createElement('div');
  node.id = 'chatLoadingBubble';
  node.className = 'chat-row assistant';
  node.innerHTML = `<b>ASSISTANT</b><p>Receiving intel...</p>`;
  log.appendChild(node);
  log.scrollTop = log.scrollHeight;
}

function removeLoadingBubble() {
  document.getElementById('chatLoadingBubble')?.remove();
}

async function sendChatMessage() {
  if (state.isChatSending) return;
  const input = document.getElementById('chatInput');
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;

  appendChat('user', message);
  input.value = '';

  setChatSendingState(true);
  appendLoadingBubble();
  state.chatAbortController = new AbortController();

  try {
    const data = await api('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        personality: state.personalityMode,
        model_mode: state.chatModelMode,
        history: (getActiveConversation()?.messages || [])
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-8)
          .map(m => ({ role: m.role, content: m.content }))
      }),
      signal: state.chatAbortController.signal
    });
    removeLoadingBubble();
    appendChat('assistant', data.reply || 'No response');
  } catch (e) {
    removeLoadingBubble();
    if (e.name === 'AbortError') appendChat('assistant', 'Request canceled by operator.');
    else appendChat('assistant', `Link error: ${e.message}`);
  } finally {
    state.chatAbortController = null;
    setChatSendingState(false);
    input.focus();
  }
}

function bindEvents() {
  bindSidebarNavigation((id) => {
    showSection(id);
    if (id === 'intel') {
      refreshIntelView();
    }
  });

  // User Profile Dropdown Logic
  const userTrigger = document.getElementById('userTrigger');
  const userDropdown = document.getElementById('userDropdown');
  
  if (userTrigger && userDropdown) {
    userTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('active');
      userDropdown.classList.toggle('hidden');
      userTrigger.classList.toggle('active');
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!userTrigger.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.classList.remove('active');
        userDropdown.classList.add('hidden');
        userTrigger.classList.remove('active');
      }
    });

    // Dropdown Items Navigation
    userDropdown.querySelectorAll('.dropdown-item[data-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        showSection(btn.dataset.section);
        userDropdown.classList.remove('active');
        userDropdown.classList.add('hidden');
        userTrigger.classList.remove('active');
      });
    });
  }

  document.getElementById('intelTimeframe')?.addEventListener('change', refreshIntelView);
  document.getElementById('intelChartMode')?.addEventListener('change', refreshIntelView);

  document.getElementById('openDrawerBtn')?.addEventListener('click', () => {
    document.getElementById('aiDrawer')?.classList.remove('hidden');
  });
  document.getElementById('closeDrawerBtn')?.addEventListener('click', () => {
    document.getElementById('aiDrawer')?.classList.add('hidden');
  });

  document.getElementById('btnSuccess')?.addEventListener('click', async () => {
    const notes = prompt('Operational notes (optional):') || '';
    await logDay('SUCCESS', notes || null);
    // Read streak from localStorage (synced from backend on last refreshAll)
    let streak = parseInt(localStorage.getItem('discipline_streak') || '0', 10);
    let shields = parseInt(localStorage.getItem('streak_shields') || '0', 10);
    streak++;
    if (streak % 10 === 0) { shields++; toast(`🛡️ Shield earned! You now have ${shields} shields.`, 'success'); }
    await updateConfig({ discipline_streak: streak, streak_shields: shields });
    intelCache.ts = 0; // Force Intel Feed to update real-time
    await refreshAll();
  });

  document.getElementById('btnFailure')?.addEventListener('click', async () => {
    const notes = prompt('Operational notes (optional):') || '';
    await logDay('FAILURE', notes || null);
    let shields = parseInt(localStorage.getItem('streak_shields') || '0', 10);
    if (shields > 0) {
      if (confirm('THẤT BẠI! Bạn có muốn dùng 1 🛡️ GIÁP để giữ chuỗi không?')) {
        shields--;
        await updateConfig({ streak_shields: shields });
        toast('🛡️ Shield consumed. Streak preserved.', 'warning');
      } else {
        await updateConfig({ discipline_streak: 0 });
      }
    } else {
      await updateConfig({ discipline_streak: 0 });
    }
    intelCache.ts = 0; // Force Intel Feed to update real-time
    await refreshAll();
  });

  document.getElementById('resetBtn')?.addEventListener('click', async () => {
    const isStrict = localStorage.getItem('sys_strict_confirm') !== 'false';
    if (isStrict) {
        const promptRes = prompt('STRICT MODE: Gõ "PURGE" để xác nhận xóa vĩnh viễn toàn bộ lịch sử.');
        if (promptRes !== 'PURGE') {
            alert('Đã hủy lệnh xóa.');
            return;
        }
    } else {
        if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử không?')) return;
    }
    await resetScore();

    // VÁ LỖI: Dọn sạch gamification state trên trình duyệt và cả Backend
    localStorage.setItem('discipline_streak', '0');
    localStorage.setItem('streak_shields', '0');
    try { await updateConfig({ discipline_streak: 0, streak_shields: 0 }); } catch (err) { console.error('Failed to reset config on server:', err); }
    
    intelCache.ts = 0; // Force Intel Feed to update real-time
    
    const streakEl = document.getElementById('streakCount');
    if (streakEl) streakEl.textContent = '0';

    const badge = document.getElementById('currentRankBadge');
    if (badge) {
      badge.className = 'rank-badge rank-iron';
      badge.textContent = 'IRON';
    }

    if (window.triggerAICoach) {
      window.triggerAICoach('Hệ thống đã Reset. Ngươi lại trở về làm một Tân binh (IRON). Khởi động lại UI...', 'warning');
    }
    
    // Force a full reload to clear all active grids (Timeline, Heatmaps) from DOM
    setTimeout(() => {
        window.location.reload();
    }, 1200);
  });

  document.querySelectorAll('.persona-radio').forEach(radio => {
    radio.addEventListener('change', async (e) => {
      if (e.target.checked) {
        state.personalityMode = e.target.value;
        await setPersonalityMode(state.personalityMode);
      }
    });
  });

  document.getElementById('modeFlashBtn')?.addEventListener('click', () => {
    state.chatModelMode = 'FLASH';
    document.getElementById('modeFlashBtn')?.classList.add('active');
    document.getElementById('modeProBtn')?.classList.remove('active');
  });

  document.getElementById('modeProBtn')?.addEventListener('click', () => {
    state.chatModelMode = 'PRO';
    document.getElementById('modeProBtn')?.classList.add('active');
    document.getElementById('modeFlashBtn')?.classList.remove('active');
  });

  document.getElementById('sendChatBtn')?.addEventListener('click', sendChatMessage);
  document.getElementById('stopChatBtn')?.addEventListener('click', () => {
    if (state.chatAbortController) state.chatAbortController.abort();
  });
  document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  window.addEventListener('dashboard:evaluated', async () => {
    await refreshAll();
  });

  document.getElementById('recordSearch')?.addEventListener('input', renderHistoryTable);
  document.getElementById('recordStatusFilter')?.addEventListener('change', renderHistoryTable);
  document.getElementById('recordSort')?.addEventListener('change', renderHistoryTable);

  document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
    if (!state.history || state.history.length === 0) {
      alert('No data to export.');
      return;
    }
    const headers = ['Timestamp', 'Status', 'Delta', 'Notes'];
    const rows = state.history.map(item => [
      new Date(item.timestamp).toISOString(),
      item.status,
      item.delta,
      `"${(item.notes || '').replace(/"/g, '""')}"`
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "strike_record_export.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  // SYSTEM CONFIG BINDINGS
  document.getElementById('toggleSound')?.addEventListener('change', (e) => {
      localStorage.setItem('sys_sound_override', e.target.checked);
  });
  document.getElementById('toggleAutoIntel')?.addEventListener('change', (e) => {
      localStorage.setItem('sys_auto_intel', e.target.checked);
  });
  document.getElementById('toggleStrictConfirm')?.addEventListener('change', (e) => {
      localStorage.setItem('sys_strict_confirm', e.target.checked);
  });

  // ---- #10 Multi-slot Profile helpers ----
  function getProfiles() {
    try { return JSON.parse(localStorage.getItem('sys_profiles') || '{}'); } catch { return {}; }
  }
  function saveProfiles(profiles) {
    localStorage.setItem('sys_profiles', JSON.stringify(profiles));
  }
  function refreshProfileSelect() {
    const sel = document.getElementById('profileSelect');
    if (!sel) return;
    const profiles = getProfiles();
    sel.innerHTML = '<option value="">— Select profile —</option>' +
      Object.keys(profiles).map(name => `<option value="${name}">${name}</option>`).join('');
  }
  refreshProfileSelect();

  document.getElementById('savePresetBtn')?.addEventListener('click', () => {
    const nameInput = document.getElementById('profileNameInput');
    const name = nameInput?.value.trim() || `Profile ${new Date().toLocaleDateString()}`;
    const profiles = getProfiles();
    profiles[name] = {
      theme: localStorage.getItem('user_theme'),
      sound: localStorage.getItem('sys_sound_override'),
      autoIntel: localStorage.getItem('sys_auto_intel'),
      strictConfirm: localStorage.getItem('sys_strict_confirm'),
      persona: state.personalityMode
    };
    saveProfiles(profiles);
    refreshProfileSelect();
    toast(`Profile "${name}" saved.`, 'success');
    if (nameInput) nameInput.value = '';
  });

  document.getElementById('loadPresetBtn')?.addEventListener('click', async () => {
    const sel = document.getElementById('profileSelect');
    const name = sel?.value;
    if (!name) { toast('Select a profile first.', 'warning'); return; }
    const profiles = getProfiles();
    const backup = profiles[name];
    if (!backup) { toast('Profile not found.', 'error'); return; }
    if (backup.theme) localStorage.setItem('user_theme', backup.theme);
    if (backup.sound !== undefined) localStorage.setItem('sys_sound_override', backup.sound);
    if (backup.autoIntel !== undefined) localStorage.setItem('sys_auto_intel', backup.autoIntel);
    if (backup.strictConfirm !== undefined) localStorage.setItem('sys_strict_confirm', backup.strictConfirm);
    if (backup.persona) { state.personalityMode = backup.persona; await setPersonalityMode(backup.persona); }
    toast(`Profile "${name}" loaded. Reloading...`, 'info');
    setTimeout(() => window.location.reload(), 1000);
  });

  document.getElementById('deletePresetBtn')?.addEventListener('click', () => {
    const sel = document.getElementById('profileSelect');
    const name = sel?.value;
    if (!name) { toast('Select a profile to delete.', 'warning'); return; }
    const profiles = getProfiles();
    delete profiles[name];
    saveProfiles(profiles);
    refreshProfileSelect();
    toast(`Profile "${name}" deleted.`, 'warning');
  });

  // ---- Backup / Import JSON (#9) ----
  document.getElementById('backupStateBtn')?.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(localStorage));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `fake_motivation_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    toast('Local state backed up.', 'success');
  });

  document.getElementById('importStateBtn')?.addEventListener('click', () => {
    document.getElementById('importFileInput')?.click();
  });
  document.getElementById('importFileInput')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
        toast('State imported. Reloading...', 'success');
        setTimeout(() => window.location.reload(), 1200);
      } catch { toast('Invalid JSON file.', 'error'); }
    };
    reader.readAsText(file);
  });

  bindConversationButtons();
}

async function mountLayout() {
  renderSidebar(document.getElementById('sidebar'));

  const main = document.getElementById('mainContent');
  if (main) {
    main.innerHTML = '';
    const renderers = [
      renderDashboard,
      renderIntelFeed,
      renderStrikeRecord,
      renderSystemConfig,
      renderAccount
    ];

    // Chờ tất cả các section vẽ xong nội dung
    await Promise.all(renderers.map(async (renderer) => {
      const mount = document.createElement('div');
      await renderer(mount);
      main.appendChild(mount);
    }));
  }

  renderAIDrawer(document.getElementById('drawerMount'));
}

// #7 Skeleton loading — show shimmer while waiting for data
function showSkeletons() {
  const skTargets = ['statTotalDays', 'statWinRate', 'streakCount'];
  skTargets.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.dataset.real = el.textContent; el.innerHTML = '<span class="skeleton skeleton-line short" style="display:inline-block;width:40px;height:14px;"></span>'; }
  });
}
function hideSkeletons() {
  const skTargets = ['statTotalDays', 'statWinRate', 'streakCount'];
  skTargets.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.querySelector('.skeleton')) el.innerHTML = el.dataset.real || '';
  });
}

function startClock() {
  const clockEl = document.getElementById('sysClock');
  if (!clockEl) return;
  setInterval(() => {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${h}:${m}:${s} SYS`;
  }, 1000);
}

async function start() {
  mountLayout();
  loadConversations();
  renderConversationList();
  renderActiveConversation();
  bindEvents();
  showSection('mission');
  showSkeletons();
  startClock();
  await _refreshAll(); // call directly (not debounced) on first load
  hideSkeletons();
}

// Lắng nghe sự kiện đổi ngôn ngữ để vẽ lại giao diện tức thì
window.addEventListener('language-changed', async () => {
  const currentSection = ['mission', 'intel', 'record', 'config', 'account'].find(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  }) || 'mission';

  await mountLayout();
  bindEvents(); 
  showSection(currentSection);
  _refreshAll();
});

start().catch(err => {
  console.error(err);
  showOfflineBanner(`❌ Startup error: ${err.message}`);
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'themeSelect') {
    const selectedTheme = e.target.value;
    // Remove all theme attributes first
    document.body.removeAttribute('data-theme');
    if (selectedTheme !== 'cyberpunk') {
      document.body.setAttribute('data-theme', selectedTheme);
    }
    localStorage.setItem('user_theme', selectedTheme);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('user_theme');
  if (savedTheme && savedTheme !== 'cyberpunk') {
    document.body.setAttribute('data-theme', savedTheme);
    setTimeout(() => {
      const select = document.getElementById('themeSelect');
      if (select) select.value = savedTheme;
    }, 500);
  }

  // Auto Intel Feed Refresh — respect the sys_auto_intel toggle
  const AUTO_INTEL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  let intelRefreshInterval = null;

  function startIntelAutoRefresh() {
    if (intelRefreshInterval) return; // already running
    intelRefreshInterval = setInterval(() => {
      const enabled = localStorage.getItem('sys_auto_intel') !== 'false';
      if (!enabled) return;
      // Only refresh if the Intel section is currently visible
      const intelSection = document.getElementById('intel');
      if (intelSection && !intelSection.classList.contains('hidden')) {
        console.log('[AutoIntel] Auto-refreshing intel feed...');
        refreshIntelView();
      }
    }, AUTO_INTEL_INTERVAL_MS);
  }

  document.getElementById('toggleAutoIntel')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      startIntelAutoRefresh();
    } else {
      clearInterval(intelRefreshInterval);
      intelRefreshInterval = null;
    }
  });

  // Start on load if enabled
  if (localStorage.getItem('sys_auto_intel') !== 'false') {
    startIntelAutoRefresh();
  }

  // Operative Menu Toggle
  const opTrigger = document.getElementById('opTrigger');
  const opMenu = document.getElementById('opMenu');
  
  opTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    opMenu?.classList.toggle('hidden');
    const chevron = opTrigger.querySelector('.op-chevron');
    if (chevron) {
      chevron.style.transform = opMenu?.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    }
  });

  // Close menu when clicking outside
  document.addEventListener('click', () => {
    if (!opMenu?.classList.contains('hidden')) {
      opMenu?.classList.add('hidden');
      const chevron = opTrigger?.querySelector('.op-chevron');
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
  });

  // Logout button (now inside the menu)
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('TERMINATE SESSION AND DISCONNECT?')) logout();
  });

  // Load username and set avatar initials
  getMe().then(me => {
    const nameEl = document.getElementById('sideUsername');
    const avatarEl = document.getElementById('opAvatar');
    if (me?.username) {
      if (nameEl) nameEl.textContent = me.username.toUpperCase();
      if (avatarEl) avatarEl.textContent = me.username.substring(0, 2).toUpperCase();
    }
  }).catch(() => {});

});

// Global Bridge cho AI Coach
window.triggerAICoach = function(message, type = 'info') {
  const drawer = document.getElementById('aiDrawer');
  if (drawer && drawer.classList.contains('hidden')) {
    const buttons = document.querySelectorAll('button');
    const openBtn = Array.from(buttons).find(b => b.textContent.includes('Open AI Drawer'));
    if (openBtn) openBtn.click();
    else drawer.classList.remove('hidden');
  }

  const chatLog = document.querySelector('.chat-log') || document.getElementById('chatLog');
  if (chatLog) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `coach-message ${type}`;
    msgDiv.innerHTML = `<strong>COACH:</strong> ${message}`;
    chatLog.appendChild(msgDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
  } else {
    console.error('Không tìm thấy class .chat-log để gửi tin nhắn!');
  }
};
