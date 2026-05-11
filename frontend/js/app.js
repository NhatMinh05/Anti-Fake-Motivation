import { state, getActiveConversation } from './state.js';
import { api, fetchDashboardData, logDay, resetScore, setPersonalityMode, updateConfig, fetchIntel } from './api.js';
import { renderSidebar, bindSidebarNavigation } from '../components/sidebar.js';
import { renderDashboard, updateScore } from '../components/dashboard.js';
import { renderIntelFeed } from '../components/intelFeed.js';
import { renderStrikeRecord } from '../components/strikeRecord.js';
import { renderSystemConfig } from '../components/systemConfig.js';
import {
  renderAIDrawer,
  loadConversations,
  saveConversations,
  renderConversationList,
  renderActiveConversation,
  appendChat,
  bindConversationButtons
} from '../components/aiDrawer.js';

function showSection(id) {
  ['mission', 'intel', 'record', 'config'].forEach(s => {
    document.getElementById(s)?.classList.toggle('hidden', s !== id);
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
  if (!root) return;
  const map = buildDayMap(rangeData);
  root.innerHTML = '';
  for (let week = 0; week < 52; week++) {
    const col = document.createElement('div');
    col.style.display = 'grid';
    col.style.gap = '3px';
    for (let day = 0; day < 7; day++) {
      const offset = (51 - week) * 7 + (6 - day);
      const d = new Date();
      d.setDate(d.getDate() - offset);
      const key = d.toISOString().slice(0, 10);
      const status = map.get(key);
      const cell = document.createElement('div');
      cell.className = 'mini-heat-square';
      cell.style.width = '10px';
      cell.style.height = '10px';
      cell.style.background = status === 'SUCCESS' ? 'rgba(52,211,153,.95)' : status === 'FAILURE' ? 'rgba(251,113,133,.95)' : '#1a2030';
      col.appendChild(cell);
    }
    root.appendChild(col);
  }
}

function renderTrendChart(intelData, mode = 'line') {
  const svg = document.getElementById('trendChart');
  if (!svg) return;
  const data = intelData.trend || [];
  svg.innerHTML = '';
  const w = 700, h = 220, pad = 24;

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
    const points = data.map((d, i) => {
      const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - ((d.score - min) / span) * (h - pad * 2);
      return `${x},${y}`;
    }).join(' ');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', points);
    line.setAttribute('stroke', '#60a5fa');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke-width', '2');
    svg.appendChild(line);
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
      rect.setAttribute('fill', d.score > 0 ? '#34d399' : (d.score < 0 ? '#fb7185' : '#475569'));
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

  gauge.innerHTML = `
    <circle cx="80" cy="80" r="${radius}" stroke="#263248" stroke-width="12" fill="none"></circle>
    <circle cx="80" cy="80" r="${radius}" stroke="${color}" stroke-width="12" fill="none"
      stroke-dasharray="${dash} ${circ - dash}" transform="rotate(-90 80 80)" style="transition: stroke-dasharray 1s ease-out;"></circle>
    <text x="80" y="86" text-anchor="middle" fill="${color}" font-size="20" font-weight="bold">${ratio}%</text>
  `;
  ratioText.textContent = `${ratio}% SUCCESS`;
  ratioText.style.color = color;
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
    
    const intelList = document.getElementById('intelList');
    if (intelList) intelList.innerHTML = '<li style="color:#64748b;">Analysing data via DeepSeek...</li>';
    
    try {
        const intelData = await fetchIntel(timeframe);
        renderTrendChart(intelData, mode);
        renderGauge(intelData);
        renderIntel(intelData);
    } catch (e) {
        console.error("Failed to load intel:", e);
        if (intelList) intelList.innerHTML = '<li style="color:#fb7185;">Error: Failed to connect to intel base.</li>';
    }
}

async function refreshAll() {
  const { scoreData, historyData, rangeData, analytics, configData } = await fetchDashboardData();
  state.score = scoreData.total_score;
  state.history = historyData;
  state.trend = analytics.trend_30d || [];
  state.success30 = analytics.success_30d || 0;
  state.failure30 = analytics.failure_30d || 0;

  if (configData.discipline_streak !== undefined) {
    localStorage.setItem('discipline_streak', configData.discipline_streak);
  }
  if (configData.streak_shields !== undefined) {
    localStorage.setItem('streak_shields', configData.streak_shields);
  }

  updateScore(state.score);
  renderHistoryTable();
  renderHeatmap30(rangeData.slice(-30));
  renderAnnualHeatmap(rangeData);

  const statTotalDays = document.getElementById('statTotalDays');
  const statWinRate = document.getElementById('statWinRate');
  if (statTotalDays) statTotalDays.textContent = analytics.total_days || 0;
  if (statWinRate) statWinRate.textContent = (analytics.overall_rate || 0) + '%';
}

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
    
    let streak = parseInt(localStorage.getItem('discipline_streak') || '0', 10);
    let shields = parseInt(localStorage.getItem('streak_shields') || '0', 10);
    streak++;
    if (streak % 10 === 0) shields++;
    
    localStorage.setItem('discipline_streak', streak.toString());
    localStorage.setItem('streak_shields', shields.toString());
    await updateConfig({ discipline_streak: streak, streak_shields: shields });
    await refreshAll();
  });

  document.getElementById('btnFailure')?.addEventListener('click', async () => {
    const notes = prompt('Operational notes (optional):') || '';
    await logDay('FAILURE', notes || null);
    
    let shields = parseInt(localStorage.getItem('streak_shields') || '0', 10);
    if (shields > 0) {
      if (confirm('THẤT BẠI! Bạn có muốn dùng 1 🛡️ GIÁP để giữ chuỗi không?')) {
        shields--;
        localStorage.setItem('streak_shields', shields.toString());
        await updateConfig({ streak_shields: shields });
      } else {
        localStorage.setItem('discipline_streak', '0');
        await updateConfig({ discipline_streak: 0 });
      }
    } else {
      localStorage.setItem('discipline_streak', '0');
      await updateConfig({ discipline_streak: 0 });
    }
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

  document.getElementById('savePresetBtn')?.addEventListener('click', () => {
      const backup = {
          theme: localStorage.getItem('user_theme'),
          sound: localStorage.getItem('sys_sound_override'),
          autoIntel: localStorage.getItem('sys_auto_intel'),
          strictConfirm: localStorage.getItem('sys_strict_confirm'),
          persona: state.personalityMode
      };
      localStorage.setItem('sys_profile_1', JSON.stringify(backup));
      if (window.triggerAICoach) window.triggerAICoach('Profile State Saved to Local Storage.', 'success');
      else alert('Profile SAVED to Local Storage.');
  });

  document.getElementById('loadPresetBtn')?.addEventListener('click', async () => {
      const backupStr = localStorage.getItem('sys_profile_1');
      if (!backupStr) {
          if (window.triggerAICoach) window.triggerAICoach('No saved profile found in Local Storage.', 'warning');
          else alert('No profile found.');
          return;
      }
      const backup = JSON.parse(backupStr);
      
      if (backup.theme) localStorage.setItem('user_theme', backup.theme);
      if (backup.sound !== undefined) localStorage.setItem('sys_sound_override', backup.sound);
      if (backup.autoIntel !== undefined) localStorage.setItem('sys_auto_intel', backup.autoIntel);
      if (backup.strictConfirm !== undefined) localStorage.setItem('sys_strict_confirm', backup.strictConfirm);
      if (backup.persona) {
          state.personalityMode = backup.persona;
          await setPersonalityMode(backup.persona);
      }
      
      alert('Profile LOADED. Reloading interface...');
      window.location.reload();
  });

  document.getElementById('deletePresetBtn')?.addEventListener('click', () => {
      localStorage.removeItem('sys_profile_1');
      if (window.triggerAICoach) window.triggerAICoach('Profile State DELETED.', 'warning');
      else alert('Profile DELETED.');
  });

  document.getElementById('backupStateBtn')?.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localStorage));
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute("href", dataStr);
      dlAnchorElem.setAttribute("download", `fake_motivation_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(dlAnchorElem);
      dlAnchorElem.click();
      dlAnchorElem.remove();
  });

  bindConversationButtons();
}

function mountLayout() {
  renderSidebar(document.getElementById('sidebar'));

  const main = document.getElementById('mainContent');
  if (main) {
    main.innerHTML = '';
    const sections = [
      renderDashboard,
      renderIntelFeed,
      renderStrikeRecord,
      renderSystemConfig
    ];

    sections.forEach(renderer => {
      const mount = document.createElement('div');
      renderer(mount);
      main.appendChild(mount); // <--- Bơm trực tiếp khối DOM thật vào trang
    });
  }

  renderAIDrawer(document.getElementById('drawerMount'));
}

async function start() {
  mountLayout();
  loadConversations();
  renderConversationList();
  renderActiveConversation();
  bindEvents();
  showSection('mission');
  await refreshAll();
}

start().catch(err => {
  console.error(err);
  alert(`Startup error: ${err.message}`);
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
