import { getTranslation } from '../js/i18n.js';
import { fetchTasks, addTask, toggleTask, deleteTask, evaluateDate, updateConfig, braindumpTasks } from '../js/api.js';

const ROAST_MESSAGES = [
  "Thất bại. Lại doomscrolling điện thoại đến 2h sáng chứ gì?",
  "Kỷ luật thế này thì định làm Tỷ phú bằng nước bọt à?",
  "Bạn cùng trang lứa mua nhà mua xe hết rồi, còn bạn thì ngồi ấn nút gạch bỏ mục tiêu.",
  "Mới vài ngày đã bỏ cuộc. Đừng hỏi tại sao mãi ở vạch xuất phát.",
  "Hệ thống từ chối hiểu sự yếu kém này. Trừ 2 điểm."
];

const PROMOTION_MESSAGES = {
  BRONZE: "Hết thời tân binh. Chào mừng WARRIOR mới!",
  SILVER: "Màu Bạc khá đấy, nhưng đừng để nó xỉn màu vì lười biếng.",
  GOLD: "VÀNG! Ngươi đang đứng ở đỉnh cao của sự kiên trì.",
  DIAMOND: "Cứng như Kim Cương. Ngươi thực sự là một quái vật kỷ luật.",
  MASTER: "QUYỀN NĂNG TUYỆT ĐỐI. Ta không còn gì để dạy ngươi nữa."
};

export function updateScore(score) {
  const scoreEl = document.getElementById('scoreValue');
  if (!scoreEl) return;
  scoreEl.textContent = String(score);
  scoreEl.style.color = score >= 0 ? '#10B981' : '#FB7185';
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateString, delta) {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return formatDate(d);
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}

function toDisplayDate(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function getMonthName(monthIndex) {
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ][monthIndex];
}

function getRankInfo(streak) {
  if (streak >= 50) return { name: 'MASTER', class: 'rank-master' };
  if (streak >= 30) return { name: 'DIAMOND', class: 'rank-diamond' };
  if (streak >= 20) return { name: 'GOLD', class: 'rank-gold' };
  if (streak >= 10) return { name: 'SILVER', class: 'rank-silver' };
  if (streak >= 5) return { name: 'BRONZE', class: 'rank-bronze' };
  return { name: 'IRON', class: 'rank-iron' };
}

// 1. HÀM XỬ LÝ RANK & UI SIDEBAR
function updateRankUI(streak) {
  const rank = getRankInfo(streak);

  // Update Watermark Background
  document.body.setAttribute('data-rank', rank.name);

  // Keep rank classes scoped away from mission content to avoid accidental style bleed
  const dashboardContainer = document.getElementById('dashboard');
  if (dashboardContainer) {
    dashboardContainer.classList.remove('rank-iron', 'rank-bronze', 'rank-silver', 'rank-gold', 'rank-diamond', 'rank-master');
    dashboardContainer.classList.add(rank.class);
  }

  // Ensure mission streak badge never inherits rank card backgrounds
  const streakBadge = document.getElementById('streakBadge');
  if (streakBadge) {
    streakBadge.classList.remove('rank-iron', 'rank-bronze', 'rank-silver', 'rank-gold', 'rank-diamond', 'rank-master');
  }

  // Force fire icon to refresh style when rank changes/reset
  const fireIcon = document.querySelector('#streakBadge .streak-fire-icon');
  if (fireIcon) {
    fireIcon.classList.remove('streak-fire-icon');
    void fireIcon.offsetWidth;
    fireIcon.classList.add('streak-fire-icon');
  }

  // Update Badge ở Sidebar
  const sidebarBrand = document.querySelector('.brand-card') || document.querySelector('.sidebar-brand');
  if (sidebarBrand) {
    let badge = document.getElementById('currentRankBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'currentRankBadge';
      sidebarBrand.appendChild(badge);
    }
    badge.className = `rank-badge ${rank.class}`;
    badge.textContent = rank.name;
  }
}

// 2. HÀM XỬ LÝ GIÁP (SHIELD)
function updateShieldUI() {
  const shields = parseInt(localStorage.getItem('streak_shields') || '0', 10);
  const container = document.getElementById('shieldContainer');
  if (container) {
    container.innerHTML = shields > 0 ? `<span class="shield-active">🛡️ x${shields}</span>` : '';
  }
}

function triggerMilestoneCelebration(streak) {
  const milestones = [5, 10, 20, 30, 50];
  if (!milestones.includes(streak)) return Promise.resolve();

  const overlay = document.getElementById('streakMilestoneOverlay');
  const number = document.getElementById('milestoneNumber');
  const fireImage = document.getElementById('milestoneFireImage');
  const body = document.body;
  if (!overlay || !number || !body) return Promise.resolve();

  let tierClass = 'fire-bronze';
  let duration = 2000;
  let intensity = 'intensity-low';

  if (streak >= 50) {
    tierClass = 'fire-master';
    intensity = 'intensity-high';
    duration = 5500;
  } else if (streak >= 30) {
    tierClass = 'fire-diamond';
    intensity = 'intensity-mid';
    duration = 4000;
  } else if (streak >= 20) {
    tierClass = 'fire-gold';
    intensity = 'intensity-mid';
    duration = 3000;
  } else if (streak >= 10) {
    tierClass = 'fire-silver';
    intensity = 'intensity-mid';
    duration = 3000;
  }

  number.textContent = String(streak);
  const milestoneContent = document.getElementById('milestoneContent');
  const sparkleLayer = document.getElementById('sparkleLayer');

  if (milestoneContent) {
    milestoneContent.className = `milestone-content ${tierClass}`;
  }

  // Force update SVG gradient colors safely to avoid browser inheritance bugs
  const stop1 = document.getElementById('stop1');
  const stop2 = document.getElementById('stop2');
  const stop3 = document.getElementById('stop3');

  const gradientColors = {
    'fire-bronze': ['#fff', '#facc15', '#ea580c'],
    'fire-silver': ['#ffffff', '#e2e8f0', '#94a3b8'],
    'fire-gold': ['#fff', '#fef08a', '#ca8a04'],
    'fire-diamond': ['#fff', '#cffafe', '#0891b2'],
    'fire-master': ['#fff', '#e9d5ff', '#a855f7']
  };

  if (stop1 && gradientColors[tierClass]) {
    stop1.setAttribute('stop-color', gradientColors[tierClass][0]);
    stop2.setAttribute('stop-color', gradientColors[tierClass][1]);
    stop3.setAttribute('stop-color', gradientColors[tierClass][2]);
  }

  if (sparkleLayer) {
    sparkleLayer.innerHTML = '';
    sparkleLayer.className = `sparkle-layer ${tierClass}`;

    let particleCount = 5;
    if (streak >= 50) particleCount = 20;
    else if (streak >= 30) particleCount = 15;
    else if (streak >= 20) particleCount = 10;
    else if (streak >= 10) particleCount = 8;

    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement('div');
      p.className = 'sparkle-particle';
      p.style.left = `${Math.random() * 100}%`;
      p.style.top = `${Math.random() * 100}%`;
      p.style.animationDelay = `${Math.random() * 2}s`;
      p.style.animationDuration = `${1 + Math.random() * 1.5}s`;
      p.textContent = '✦'; // text character allows CSS coloring
      sparkleLayer.appendChild(p);
    }
  }

  overlay.classList.remove('fade-out');
  overlay.style.display = 'flex';

  // Kích hoạt transition opacity
  void overlay.offsetWidth;
  overlay.classList.add('active');

  return new Promise(resolve => {
    setTimeout(() => {
      overlay.classList.remove('active');
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.classList.remove('fade-out');
        body.classList.remove('intensity-low', 'intensity-mid', 'intensity-high');
        resolve();
      }, 500);
    }, duration);
  });
}

export function renderDashboard(container) {
  // Lấy chuỗi hiện tại và Cập nhật Rank background
  const currentStreakStr = localStorage.getItem('discipline_streak') || '0';
  updateRankUI(parseInt(currentStreakStr, 10));

  container.innerHTML = `
    <section id="mission" class="section">
      <header class="section-header">
        <h2 data-i18n="mission_control">${getTranslation('mission_control')}</h2>
        <p data-i18n="strict_timeline_protocol">${getTranslation('strict_timeline_protocol')}</p>
        
        <div style="display: flex; align-items: center; gap: 16px; margin-top: 8px; flex-wrap: wrap;">
          <div style="font-size:36px;font-weight:700;color:#10B981;" id="scoreValue">0</div>
          
          <div id="streakBadge" style="background: rgba(251, 146, 60, 0.1); border: 1px solid #FB923C; color: #FB923C; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 600; font-family: 'Geist Mono', monospace; display: flex; align-items: center; gap: 6px;">
            <span class="streak-fire-icon" style="font-size: 16px;">🔥</span> 
            <span id="streakCount">${localStorage.getItem('discipline_streak') || '0'}</span> <span class="streak-text" data-i18n="day_streak">${getTranslation('day_streak')}</span>
          </div>
          <div id="shieldContainer"></div>

          <div id="quickStats" style="display: flex; gap: 24px; margin-left: auto; font-size: 12px; color: #9CA3AF; text-align: right; border-left: 1px solid #2A2A2A; padding-left: 20px;">
            <div><span data-i18n="total_days">${getTranslation('total_days')}</span><br><strong id="statTotalDays" style="color: #E5E7EB; font-size: 20px; font-family: monospace;">0</strong></div>
            <div><span data-i18n="win_rate">${getTranslation('win_rate')}</span><br><strong id="statWinRate" style="color: #10B981; font-size: 20px; font-family: monospace;">0%</strong></div>
          </div>
        </div>
      </header>

      <div class="card" style="background:#131313;border:1px solid #2A2A2A;border-radius:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <div>
            <div style="font-size:12px;opacity:0.75;" data-i18n="score_status">${getTranslation('score_status')}</div>
            <div id="dashboardScoreHint" style="font-size:14px;color:#10B981;" data-i18n="core_score_stream">${getTranslation('core_score_stream')}</div>
          </div>
          <div id="dashboardEvalStatus" style="font-size:12px;color:#38BDF8;" data-i18n="system_ready">${getTranslation('system_ready')}</div>
        </div>
      </div>

      <div class="card" style="background:#131313;border:1px solid #2A2A2A;border-radius:0;position:relative;">
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;">
          <button id="timelinePrevDate" style="background:#0E0E0E;border:1px solid #2A2A2A;color:#E5E7EB;padding:8px 12px;border-radius:0;" data-i18n="prev_date">${getTranslation('prev_date')}</button>

          <button id="timelineDateButton" style="min-width:160px;text-align:center;border:1px solid #2A2A2A;padding:8px 12px;background:#0E0E0E;color:#10B981;font-family:monospace;outline:none;cursor:pointer;">
            00/00/0000
          </button>

          <button id="timelineNextDate" style="background:#0E0E0E;border:1px solid #2A2A2A;color:#E5E7EB;padding:8px 12px;border-radius:0;" data-i18n="next_date">${getTranslation('next_date')}</button>
        </div>

        <div id="timelineCalendarPanel" style="display:none;position:absolute;top:56px;left:50%;transform:translateX(-50%);width:min(420px,92vw);background:#0E0E0E;border:1px solid #2A2A2A;z-index:20;padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <button id="calendarPrevMonth" style="background:#131313;border:1px solid #2A2A2A;color:#E5E7EB;padding:6px 10px;cursor:pointer;">‹</button>
            <div id="calendarMonthLabel" style="font-size:14px;color:#10B981;font-weight:700;"></div>
            <button id="calendarNextMonth" style="background:#131313;border:1px solid #2A2A2A;color:#E5E7EB;padding:6px 10px;cursor:pointer;">›</button>
          </div>

          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px;font-size:11px;opacity:0.8;">
            <div style="text-align:center;">SUN</div>
            <div style="text-align:center;">MON</div>
            <div style="text-align:center;">TUE</div>
            <div style="text-align:center;">WED</div>
            <div style="text-align:center;">THU</div>
            <div style="text-align:center;">FRI</div>
            <div style="text-align:center;">SAT</div>
          </div>

          <div id="calendarGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;"></div>
        </div>
      </div>

      <div class="card" style="background:#131313;border:1px solid #2A2A2A;border-radius:0;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input id="timelineTaskInput" type="text" data-i18n-placeholder="enter_objective" placeholder="${getTranslation('enter_objective')}"
            style="flex:1;min-width:220px;background:#0E0E0E;border:1px solid #2A2A2A;color:#E5E7EB;padding:10px 12px;border-radius:0;outline:none;" />
          <button id="timelineAddTaskBtn" style="background:#0E0E0E;border:1px solid #10B981;color:#10B981;padding:10px 16px;border-radius:0;cursor:pointer;" data-i18n="add_task">
            ${getTranslation('add_task')}
          </button>
          <button id="toggleBraindumpBtn" style="background:#0E0E0E;border:1px solid #38BDF8;color:#38BDF8;padding:10px 16px;border-radius:0;cursor:pointer;" data-i18n="ai_braindump">
            ${getTranslation('ai_braindump')}
          </button>
        </div>

        <!-- AI Braindump Panel -->
        <div id="braindumpPanel" class="braindump-panel" style="margin-top: 15px;">
          <div style="font-size:12px; color:#38BDF8; margin-bottom:10px; font-weight:bold;">[ DEEPSEEK ARCHITECT MODE ]</div>
          <textarea id="braindumpText" class="braindump-textarea" placeholder="Dump all your messy thoughts, sub-tasks, and goals here. The AI will parse them into a strict Tech-Tree..."></textarea>
          <div style="display:flex; justify-content:flex-end;">
            <button id="processBraindumpBtn" style="background:#38BDF8; border:none; color:#0E0E0E; font-weight:bold; padding:8px 16px; cursor:pointer; display:flex; align-items:center; gap:8px;">
              <span>PROCESS ARCHITECTURE</span>
            </button>
          </div>
        </div>
      </div>

      <div class="card" style="background:#131313;border:1px solid #2A2A2A;border-radius:0;">
        <div style="font-size:12px;opacity:0.75;margin-bottom:8px;" data-i18n="tactical_mission_tree">${getTranslation('tactical_mission_tree')}</div>
        <div id="missionTreeContainer" class="mission-tree-container"></div>
      </div>

      <button id="timelineEvaluateBtn"
        style="position:relative;overflow:hidden;width:100%;background:#0E0E0E;border:1px solid #FB7185;color:#FB7185;padding:16px 12px;border-radius:0;font-size:16px;font-weight:700;letter-spacing:0.04em;cursor:pointer;user-select:none;touch-action:none;">
        <div id="evaluateProgress" style="position:absolute;top:0;left:0;height:100%;width:0%;background:rgba(251,113,133,0.3);pointer-events:none;"></div>
        <span style="position:relative;z-index:1;pointer-events:none;" data-i18n="hold_to_execute">${getTranslation('hold_to_execute')}</span>
      </button>

      <div id="streakMilestoneOverlay">
        <div class="milestone-content" id="milestoneContent">
          <div class="milestone-flame-container" id="milestoneFlameContainer">
             <div class="sparkle-layer" id="sparkleLayer"></div>
             <svg class="milestone-fire-svg" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="flameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" class="stop-1" id="stop1" />
                        <stop offset="30%" class="stop-2" id="stop2" />
                        <stop offset="100%" class="stop-3" id="stop3" />
                    </linearGradient>
                </defs>
                <path class="flame-layer-1" d="M11.66 21.99a8.55 8.55 0 0 1-5.07-2.3 8.35 8.35 0 0 1-2.58-6.1c0-2.82 1.34-5.26 3.03-7.23C8.42 4.75 10 3.3 10 1.5c0-.2.25-.3.4-.17a10.63 10.63 0 0 1 4.34 6.75c.18.96.11 1.95-.2 2.87-.2.63.54 1.1 1.05.65.65-.58 1.17-1.3 1.5-2.1.28-.66.45-1.37.5-2.09.03-.31.42-.42.6-.17.9 1.26 1.4 2.8 1.4 4.38 0 4.67-3.72 8.44-8.32 8.44a8.23 8.23 0 0 1-.36-.01z" fill="url(#flameGradient)" />
                <path class="flame-layer-2" d="M11.5 20c-2.5 0-4.5-2-4.5-4.5 0-1.7 1-3.2 2.5-4 0 1.5 1 2.5 2 2.5s2-1 2-2.5c1.5.8 2.5 2.3 2.5 4 0 2.5-2 4.5-4.5 4.5z" fill="#ffffff" opacity="0.9" />
             </svg>
             <div class="streak-number-colossal" id="milestoneNumber">10</div>
          </div>
          <div class="unlocked-text" data-i18n="day_streak_unlocked">${getTranslation('day_streak_unlocked')}</div>
        </div>
      </div>
    </section>
  `;

  const root = container;
  const dateButton = root.querySelector('#timelineDateButton');
  const prevBtn = root.querySelector('#timelinePrevDate');
  const nextBtn = root.querySelector('#timelineNextDate');
  const taskInput = root.querySelector('#timelineTaskInput');
  const addBtn = root.querySelector('#timelineAddTaskBtn');
  const evaluateBtn = root.querySelector('#timelineEvaluateBtn');
  const evalStatus = root.querySelector('#dashboardEvalStatus');
  const treeContainer = root.querySelector('#missionTreeContainer');
  
  const toggleBraindumpBtn = root.querySelector('#toggleBraindumpBtn');
  const braindumpPanel = root.querySelector('#braindumpPanel');
  const braindumpText = root.querySelector('#braindumpText');
  const processBraindumpBtn = root.querySelector('#processBraindumpBtn');

  const calendarPanel = root.querySelector('#timelineCalendarPanel');
  const calendarMonthLabel = root.querySelector('#calendarMonthLabel');
  const calendarGrid = root.querySelector('#calendarGrid');
  const calendarPrevMonth = root.querySelector('#calendarPrevMonth');
  const calendarNextMonth = root.querySelector('#calendarNextMonth');

  updateShieldUI();

  const state = {
    selectedDate: formatDate(new Date()),
    tasks: [],
    locked: false,
    calendarOpen: false,
    calendarViewYear: new Date().getFullYear(),
    calendarViewMonth: new Date().getMonth()
  };

  function buildTreeHTML(task, childrenMap) {
    const children = childrenMap[task.id] || [];
    const hasChildren = children.length > 0;
    
    const nodeClass = `tree-node ${task.is_completed ? 'completed' : ''} tree-node-box ${hasChildren ? 'has-children' : ''}`;
    
    const nodeHTML = `
      <div class="${nodeClass}" data-task-id="${task.id}" data-parent-id="${task.parent_id || ''}" draggable="${!state.locked}" style="${state.locked ? 'cursor:not-allowed;' : 'cursor:grab;'}">
        <div class="node-icon">${task.is_completed ? '☑' : '☐'}</div>
        <div class="node-text">${escapeHtml(task.description)}</div>
        <button class="node-delete" data-delete-id="${task.id}" ${state.locked ? 'disabled' : ''}>×</button>
      </div>
    `;

    if (!hasChildren) {
      return `<li class="tree-li">${nodeHTML}</li>`;
    }

    const childrenHTML = children.map(child => buildTreeHTML(child, childrenMap)).join('');
    return `
      <li class="tree-li">
        ${nodeHTML}
        <ul class="tree-ul sub-tree">
          ${childrenHTML}
        </ul>
      </li>
    `;
  }

  function renderTasks() {
    if (state.tasks.length === 0) {
      treeContainer.innerHTML = `<div style="padding:12px;border:1px solid #2A2A2A;background:#0E0E0E;color:#9CA3AF;text-align:center;font-family:monospace;width:100%;">NO MISSIONS ASSIGNED FOR THIS DATE</div>`;
      return;
    }

    // Group by parent_id
    const roots = state.tasks.filter(t => !t.parent_id);
    const childrenMap = {};
    state.tasks.forEach(t => {
      if (t.parent_id) {
        if (!childrenMap[t.parent_id]) childrenMap[t.parent_id] = [];
        childrenMap[t.parent_id].push(t);
      }
    });

    let html = `<ul class="tree-ul root-tree">`;
    roots.forEach(rootTask => {
      html += buildTreeHTML(rootTask, childrenMap);
    });
    html += `</ul>`;

    treeContainer.innerHTML = html;

    // Bind Toggle & Delete events
    treeContainer.querySelectorAll('.tree-node').forEach(node => {
      node.addEventListener('click', async (e) => {
        if (e.target.closest('.node-delete')) return;
        if (state.locked) return;
        
        const id = Number(node.getAttribute('data-task-id'));
        try {
          await toggleTask(id);
          await loadTasks();
        } catch (err) {
          evalStatus.textContent = `ERROR: ${err.message}`;
          evalStatus.style.color = '#FB7185';
        }
      });
    });

    treeContainer.querySelectorAll('.node-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (state.locked) return;
        const id = Number(btn.getAttribute('data-delete-id'));
        try {
          await deleteTask(id);
          await loadTasks();
        } catch (err) {
          evalStatus.textContent = `ERROR: ${err.message}`;
          evalStatus.style.color = '#FB7185';
        }
      });
    });
    
    // Bind Drag and Drop Events
    if (state.locked) return;

    let draggedId = null;

    treeContainer.querySelectorAll('.tree-node').forEach(node => {
      node.addEventListener('dragstart', (e) => {
        draggedId = Number(node.getAttribute('data-task-id'));
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => node.style.opacity = '0.4', 0);
      });
      node.addEventListener('dragend', () => {
        node.style.opacity = '1';
        draggedId = null;
        treeContainer.querySelectorAll('.drop-intent-child, .drop-intent-sibling').forEach(el => {
          el.classList.remove('drop-intent-child', 'drop-intent-sibling');
        });
        treeContainer.classList.remove('drag-over-empty');
      });
    });

    // Handle dropping on nodes
    treeContainer.querySelectorAll('.tree-node').forEach(dropZone => {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        const rect = dropZone.getBoundingClientRect();
        // If mouse is in the right half of the node, intent is child
        if (e.clientX > rect.right - (rect.width / 2)) {
          dropZone.classList.add('drop-intent-child');
          dropZone.classList.remove('drop-intent-sibling');
        } else {
          dropZone.classList.add('drop-intent-sibling');
          dropZone.classList.remove('drop-intent-child');
        }
      });
      
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drop-intent-child', 'drop-intent-sibling');
      });

      dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isChildIntent = dropZone.classList.contains('drop-intent-child');
        dropZone.classList.remove('drop-intent-child', 'drop-intent-sibling');
        
        if (!draggedId) return;

        const targetNodeId = Number(dropZone.getAttribute('data-task-id'));
        if (targetNodeId === draggedId) return;

        // If intent is child, parent_id = targetNodeId
        // If intent is sibling, parent_id = targetNode's parent_id (null if root)
        let parentId = null;
        if (isChildIntent) {
           parentId = targetNodeId;
        } else {
           const pIdStr = dropZone.getAttribute('data-parent-id');
           parentId = pIdStr ? Number(pIdStr) : null;
        }

        try {
          const { moveTask } = await import('../js/api.js');
          await moveTask(draggedId, parentId);
          await loadTasks();
        } catch (err) {
          evalStatus.textContent = `MOVE ERROR: ${err.message}`;
          evalStatus.style.color = '#FB7185';
        }
      });
    });

    // Handle dropping into empty space (make root)
    treeContainer.addEventListener('dragover', (e) => {
      // Only allow if not over a node
      if (!e.target.closest('.tree-node')) {
        e.preventDefault();
        treeContainer.classList.add('drag-over-empty');
      }
    });

    treeContainer.addEventListener('dragleave', () => {
      treeContainer.classList.remove('drag-over-empty');
    });

    treeContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      treeContainer.classList.remove('drag-over-empty');
      
      if (!draggedId) return;
      if (e.target.closest('.tree-node')) return; // handled by node drop

      // Dropped in empty space -> make root
      try {
        const { moveTask } = await import('../js/api.js');
        await moveTask(draggedId, null);
        await loadTasks();
      } catch (err) {
        evalStatus.textContent = `MOVE ERROR: ${err.message}`;
        evalStatus.style.color = '#FB7185';
      }
    });
  }

  function openCalendar() {
    state.calendarOpen = true;
    calendarPanel.style.display = 'block';
  }

  function closeCalendar() {
    state.calendarOpen = false;
    calendarPanel.style.display = 'none';
  }

  function syncCalendarViewToSelectedDate() {
    const d = new Date(`${state.selectedDate}T00:00:00`);
    state.calendarViewYear = d.getFullYear();
    state.calendarViewMonth = d.getMonth();
  }

  function renderCalendar() {
    calendarMonthLabel.textContent = `${getMonthName(state.calendarViewMonth)} ${state.calendarViewYear}`;
    calendarGrid.innerHTML = '';

    const firstDay = new Date(state.calendarViewYear, state.calendarViewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(state.calendarViewYear, state.calendarViewMonth + 1, 0).getDate();

    for (let i = 0; i < startWeekday; i += 1) {
      const blank = document.createElement('div');
      blank.style.height = '34px';
      calendarGrid.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${state.calendarViewYear}-${String(state.calendarViewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const btn = document.createElement('button');
      const isSelected = iso === state.selectedDate;
      btn.textContent = String(day);
      btn.style.height = '34px';
      btn.style.border = '1px solid #2A2A2A';
      btn.style.background = isSelected ? '#10B981' : '#131313';
      btn.style.color = isSelected ? '#0E0E0E' : '#E5E7EB';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', async () => {
        state.selectedDate = iso;
        dateButton.textContent = toDisplayDate(state.selectedDate);
        closeCalendar();
        await loadTasks();
      });
      calendarGrid.appendChild(btn);
    }
  }

  async function loadTasks() {
    dateButton.textContent = toDisplayDate(state.selectedDate);
    const tasks = await fetchTasks(state.selectedDate);
    state.tasks = tasks;
    state.locked = tasks.some(t => t.is_locked);
    addBtn.disabled = state.locked;
    taskInput.disabled = state.locked;
    evaluateBtn.disabled = state.locked;
    if (state.locked) {
      evalStatus.textContent = `DATE ${state.selectedDate} LOCKED`;
      evalStatus.style.color = '#FB7185';
    } else {
      evalStatus.textContent = 'SYSTEM: READY';
      evalStatus.style.color = '#38BDF8';
    }
    renderTasks();
    renderCalendar();
  }

  async function handleAddTask() {
    const description = taskInput.value.trim();
    if (!description || state.locked) return;
    try {
      await addTask(state.selectedDate, description);
      taskInput.value = '';
      await loadTasks();
    } catch (err) {
      evalStatus.textContent = `ERROR: ${err.message}`;
      evalStatus.style.color = '#FB7185';
    }
  }

  // Braindump Logic
  toggleBraindumpBtn.addEventListener('click', () => {
    braindumpPanel.classList.toggle('active');
    if (braindumpPanel.classList.contains('active')) {
      braindumpText.focus();
    }
  });

  braindumpText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      processBraindumpBtn.click();
    }
  });

  processBraindumpBtn.addEventListener('click', async () => {
    const text = braindumpText.value.trim();
    if (!text || state.locked) return;
    
    processBraindumpBtn.innerHTML = '<span class="ai-pulse-text">AI IS ARCHITECTING...</span>';
    processBraindumpBtn.disabled = true;
    
    try {
      await braindumpTasks(state.selectedDate, text);
      braindumpText.value = '';
      braindumpPanel.classList.remove('active');
      await loadTasks();
    } catch (err) {
      evalStatus.textContent = `BRAINDUMP ERROR: ${err.message}`;
      evalStatus.style.color = '#FB7185';
    } finally {
      processBraindumpBtn.innerHTML = '<span>PROCESS ARCHITECTURE</span>';
      processBraindumpBtn.disabled = false;
    }
  });

  prevBtn.addEventListener('click', async () => {
    state.selectedDate = addDays(state.selectedDate, -1);
    syncCalendarViewToSelectedDate();
    await loadTasks();
  });

  nextBtn.addEventListener('click', async () => {
    state.selectedDate = addDays(state.selectedDate, 1);
    syncCalendarViewToSelectedDate();
    await loadTasks();
  });

  dateButton.addEventListener('click', () => {
    if (state.calendarOpen) {
      closeCalendar();
      return;
    }
    syncCalendarViewToSelectedDate();
    renderCalendar();
    openCalendar();
  });

  calendarPrevMonth.addEventListener('click', () => {
    if (state.calendarViewMonth === 0) {
      state.calendarViewMonth = 11;
      state.calendarViewYear -= 1;
    } else {
      state.calendarViewMonth -= 1;
    }
    renderCalendar();
  });

  calendarNextMonth.addEventListener('click', () => {
    if (state.calendarViewMonth === 11) {
      state.calendarViewMonth = 0;
      state.calendarViewYear += 1;
    } else {
      state.calendarViewMonth += 1;
    }
    renderCalendar();
  });

  document.addEventListener('click', (e) => {
    if (!state.calendarOpen) return;
    const target = e.target;
    if (calendarPanel.contains(target) || dateButton.contains(target)) return;
    closeCalendar();
  });

  addBtn.addEventListener('click', handleAddTask);
  taskInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleAddTask();
    }
  });

  evaluateBtn.style.transition = 'all 0.1s ease';

  let holdTimer = null;
  let progressInterval = null;
  let isExecuting = false;
  const evaluateProgress = root.querySelector('#evaluateProgress');

  function cancelHold() {
    if (isExecuting || state.locked) return;
    clearTimeout(holdTimer);
    clearInterval(progressInterval);
    if (evaluateProgress) {
        evaluateProgress.style.transition = 'width 0.3s ease';
        evaluateProgress.style.width = '0%';
    }
    evaluateBtn.style.transform = 'scale(1)';
  }

  evaluateBtn.addEventListener('mousedown', startHold);
  evaluateBtn.addEventListener('touchstart', startHold);
  
  evaluateBtn.addEventListener('mouseup', cancelHold);
  evaluateBtn.addEventListener('mouseleave', cancelHold);
  evaluateBtn.addEventListener('touchend', cancelHold);

  function startHold(e) {
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (state.locked || isExecuting) return;
    
    evaluateBtn.style.transform = 'scale(0.98)';
    if (evaluateProgress) {
      evaluateProgress.style.transition = 'none';
      evaluateProgress.style.width = '0%';
    }
    
    let start = Date.now();
    const duration = 2000;
    
    progressInterval = setInterval(() => {
        let elapsed = Date.now() - start;
        let percent = Math.min((elapsed / duration) * 100, 100);
        if (evaluateProgress) evaluateProgress.style.width = `${percent}%`;
    }, 16);

    holdTimer = setTimeout(async () => {
        clearInterval(progressInterval);
        isExecuting = true;
        if (evaluateProgress) evaluateProgress.style.width = '100%';
        
        evaluateBtn.style.backgroundColor = '#FB7185';
        evaluateBtn.style.color = '#131313';
        
        document.body.classList.add('screen-shake');
        setTimeout(() => document.body.classList.remove('screen-shake'), 300);
        
        setTimeout(() => {
          evaluateBtn.style.transform = 'scale(1)';
          evaluateBtn.style.backgroundColor = '';
          evaluateBtn.style.color = '';
        }, 300);

        await executeEvaluation();
        
        isExecuting = false;
        if (evaluateProgress) evaluateProgress.style.width = '0%';
    }, duration);
  }

  async function executeEvaluation() {
    try {
      const result = await evaluateDate(state.selectedDate);

      let currentStreak = parseInt(localStorage.getItem('discipline_streak') || '0', 10);
      let shields = parseInt(localStorage.getItem('streak_shields') || '0', 10);
      const oldRank = getRankInfo(currentStreak).name;
      const trigger = window.triggerAICoach || (() => { });

      if (result.status === 'SUCCESS') {
        evalStatus.textContent = `SUCCESS: Cố gắng tốt lắm!`;
        evalStatus.style.color = '#10B981';
        currentStreak++;

        const newRank = getRankInfo(currentStreak).name;
        const pendingPromotionMessage =
          newRank !== oldRank && PROMOTION_MESSAGES[newRank]
            ? PROMOTION_MESSAGES[newRank]
            : null;

        await triggerMilestoneCelebration(currentStreak);

        if (pendingPromotionMessage) {
          trigger(pendingPromotionMessage, 'promotion');
        }

        if (currentStreak % 10 === 0) {
          shields++;
          trigger('🛡️ GIÁP BẢO VỆ ĐÃ ĐƯỢC CẤP! Ngươi có thêm một mạng sống.', 'info');
        }
      } else {
        if (shields > 0) {
          trigger(`CẢNH BÁO: Chuỗi ${currentStreak} ngày sắp nổ tung! Bạn có muốn dùng 🛡️ Giáp không?`, 'warning');
          const useShield = confirm('THẤT BẠI! Bạn có muốn tiêu tốn 1 🛡️ GIÁP để giữ chuỗi không?');
          if (useShield) {
            shields--;
            evalStatus.textContent = 'GIÁP ĐÃ KÍCH HOẠT! Chuỗi được bảo toàn.';
            evalStatus.style.color = '#38bdf8';
            trigger('🛡️ GIÁP ĐÃ KÍCH HOẠT. Chuỗi được bảo toàn thành công.', 'info');
          } else {
            currentStreak = 0;
            const roast = ROAST_MESSAGES[Math.floor(Math.random() * ROAST_MESSAGES.length)];
            evalStatus.textContent = `FAILURE: ${roast}`;
            evalStatus.style.color = '#ff5b4f';
            trigger(`FAILURE. ${roast}`, 'failure');
          }
        } else {
          currentStreak = 0;
          const roast = ROAST_MESSAGES[Math.floor(Math.random() * ROAST_MESSAGES.length)];
          evalStatus.textContent = `FAILURE: ${roast}`;
          evalStatus.style.color = '#ff5b4f';
          trigger('FAILURE. Bạn không có giáp. Chuỗi đã nổ tung.', 'failure');
        }
      }

      localStorage.setItem('discipline_streak', currentStreak.toString());
      localStorage.setItem('streak_shields', shields.toString());
      updateConfig({ discipline_streak: currentStreak, streak_shields: shields }).catch(console.error);
      const streakEl = document.getElementById('streakCount');
      if (streakEl) streakEl.textContent = String(currentStreak);
      updateRankUI(currentStreak);
      updateShieldUI();

      updateScore(result.cumulative_score);
      await loadTasks();
      window.dispatchEvent(new CustomEvent('dashboard:evaluated', { detail: result }));
    } catch (err) {
      evalStatus.textContent = `ERROR: ${err.message}`;
      evalStatus.style.color = '#FB7185';
    }
  }

  syncCalendarViewToSelectedDate();
  renderCalendar();

  loadTasks().catch(err => {
    evalStatus.textContent = `ERROR: ${err.message}`;
    evalStatus.style.color = '#FB7185';
  });
}
