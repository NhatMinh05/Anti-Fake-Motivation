import { state, getActiveConversation } from './state.js';
import { api, fetchDashboardData, logDay, resetScore, setPersonalityMode } from './api.js';
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
  body.innerHTML = state.history.map(item => `
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

function renderTrendChart() {
  const svg = document.getElementById('trendChart');
  if (!svg) return;
  const data = state.trend || [];
  svg.innerHTML = '';
  const w = 700, h = 220, pad = 24;

  const axis = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  axis.setAttribute('d', `M ${pad} ${h - pad} L ${w - pad} ${h - pad} M ${pad} ${pad} L ${pad} ${h - pad}`);
  axis.setAttribute('stroke', '#2c3b53');
  axis.setAttribute('fill', 'none');
  svg.appendChild(axis);

  if (!data.length) return;
  const min = Math.min(...data.map(d => d.score), 0);
  const max = Math.max(...data.map(d => d.score), 1);
  const span = Math.max(max - min, 1);

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
}

function renderGauge() {
  const gauge = document.getElementById('ratioGauge');
  const ratioText = document.getElementById('ratioText');
  if (!gauge || !ratioText) return;
  const total = state.success30 + state.failure30;
  const ratio = total === 0 ? 0 : Math.round((state.success30 / total) * 100);
  const radius = 62;
  const circ = 2 * Math.PI * radius;
  const dash = (ratio / 100) * circ;

  gauge.innerHTML = `
    <circle cx="80" cy="80" r="${radius}" stroke="#263248" stroke-width="12" fill="none"></circle>
    <circle cx="80" cy="80" r="${radius}" stroke="#34d399" stroke-width="12" fill="none"
      stroke-dasharray="${dash} ${circ - dash}" transform="rotate(-90 80 80)"></circle>
    <text x="80" y="86" text-anchor="middle" fill="#34d399" font-size="20">${ratio}%</text>
  `;
  ratioText.textContent = `${ratio}% SUCCESS`;
}

function renderIntel() {
  const intelList = document.getElementById('intelList');
  if (!intelList) return;
  const notes = [];
  if (state.score < 0) notes.push('ALERT: Score below zero.');
  if (state.failure30 > state.success30) notes.push('WARNING: Failure ratio is high.');
  if (state.success30 >= state.failure30) notes.push('NOTICE: Trend currently stable.');
  intelList.innerHTML = notes.map(n => `<li>${n}</li>`).join('');
}

async function refreshAll() {
  const { scoreData, historyData, rangeData, analytics } = await fetchDashboardData();
  state.score = scoreData.total_score;
  state.history = historyData;
  state.trend = analytics.trend_30d || [];
  state.success30 = analytics.success_30d || 0;
  state.failure30 = analytics.failure_30d || 0;

  updateScore(state.score);
  renderHistoryTable();
  renderHeatmap30(rangeData.slice(-30));
  renderAnnualHeatmap(rangeData);
  renderTrendChart();
  renderGauge();
  renderIntel();
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
  bindSidebarNavigation(showSection);

  document.getElementById('openDrawerBtn')?.addEventListener('click', () => {
    document.getElementById('aiDrawer')?.classList.remove('hidden');
  });
  document.getElementById('closeDrawerBtn')?.addEventListener('click', () => {
    document.getElementById('aiDrawer')?.classList.add('hidden');
  });

  document.getElementById('btnSuccess')?.addEventListener('click', async () => {
    const notes = prompt('Operational notes (optional):') || '';
    await logDay('SUCCESS', notes || null);
    await refreshAll();
  });

  document.getElementById('btnFailure')?.addEventListener('click', async () => {
    const notes = prompt('Operational notes (optional):') || '';
    await logDay('FAILURE', notes || null);
    await refreshAll();
  });

  document.getElementById('resetBtn')?.addEventListener('click', async () => {
    if (!confirm('Confirm reset? This purges all history.')) return;
    await resetScore();

    // VÁ LỖI: Dọn sạch gamification state trên trình duyệt
    localStorage.setItem('discipline_streak', '0');
    localStorage.setItem('streak_shields', '0');
    const streakEl = document.getElementById('streakCount');
    if (streakEl) streakEl.textContent = '0';

    const badge = document.getElementById('currentRankBadge');
    if (badge) {
      badge.className = 'rank-badge rank-iron';
      badge.textContent = 'IRON';
    }

    if (window.triggerAICoach) {
      window.triggerAICoach('Hệ thống đã Reset. Ngươi lại trở về làm một Tân binh (IRON). Bắt đầu lại đi!', 'warning');
    }

    await refreshAll();
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.personalityMode = btn.dataset.mode;
      await setPersonalityMode(state.personalityMode);
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
    if (selectedTheme === 'vercel') {
      document.body.setAttribute('data-theme', 'vercel');
      localStorage.setItem('user_theme', 'vercel');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('user_theme', 'cyberpunk');
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('user_theme');
  if (savedTheme === 'vercel') {
    document.body.setAttribute('data-theme', 'vercel');
    setTimeout(() => {
      const select = document.getElementById('themeSelect');
      if (select) select.value = 'vercel';
    }, 500);
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
