import { fetchTasks, addTask, toggleTask, deleteTask, evaluateDate } from '../js/api.js';

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
  const milestones = [5, 10, 20, 30, 50, 100];
  if (!milestones.includes(streak)) return;

  const overlay = document.getElementById('streakMilestoneOverlay');
  const number = document.getElementById('milestoneNumber');
  if (!overlay || !number) return;

  let tierClass = 'fire-bronze';
  if (streak >= 50) tierClass = 'fire-master';
  else if (streak >= 30) tierClass = 'fire-diamond';
  else if (streak >= 20) tierClass = 'fire-gold';
  else if (streak >= 10) tierClass = 'fire-silver';

  number.textContent = String(streak);
  number.className = `milestone-number ${tierClass}`;

  overlay.classList.remove('fade-out');
  overlay.style.display = 'flex';

  setTimeout(() => {
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('fade-out');
    }, 500);
  }, 3000);
}

export function renderDashboard(container) {
  // Lấy chuỗi hiện tại và Cập nhật Rank background
  const currentStreakStr = localStorage.getItem('discipline_streak') || '0';
  updateRankUI(parseInt(currentStreakStr, 10));

  container.innerHTML = `
    <section id="mission" class="section">
      <header class="section-header">
        <h2>Mission Control</h2>
        <p>Strict Timeline Execution Protocol</p>
        
        <div style="display: flex; align-items: center; gap: 16px; margin-top: 8px;">
          <div style="font-size:36px;font-weight:700;color:#10B981;" id="scoreValue">0</div>
          
          <div id="streakBadge" style="background: rgba(251, 146, 60, 0.1); border: 1px solid #FB923C; color: #FB923C; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 600; font-family: 'Geist Mono', monospace; display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 16px;">🔥</span> 
            <span id="streakCount">${localStorage.getItem('discipline_streak') || '0'}</span> DAY STREAK
          </div>
          <div id="shieldContainer"></div>
        </div>
      </header>

      <div class="card" style="background:#131313;border:1px solid #2A2A2A;border-radius:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <div>
            <div style="font-size:12px;opacity:0.75;">DISCIPLINE SCORE STATUS</div>
            <div id="dashboardScoreHint" style="font-size:14px;color:#10B981;">CONNECTED TO CORE SCORE STREAM</div>
          </div>
          <div id="dashboardEvalStatus" style="font-size:12px;color:#38BDF8;">SYSTEM: READY</div>
        </div>
      </div>

      <div class="card" style="background:#131313;border:1px solid #2A2A2A;border-radius:0;position:relative;">
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;">
          <button id="timelinePrevDate" style="background:#0E0E0E;border:1px solid #2A2A2A;color:#E5E7EB;padding:8px 12px;border-radius:0;">< PREV</button>

          <button id="timelineDateButton" style="min-width:160px;text-align:center;border:1px solid #2A2A2A;padding:8px 12px;background:#0E0E0E;color:#10B981;font-family:monospace;outline:none;cursor:pointer;">
            00/00/0000
          </button>

          <button id="timelineNextDate" style="background:#0E0E0E;border:1px solid #2A2A2A;color:#E5E7EB;padding:8px 12px;border-radius:0;">NEXT ></button>
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
          <input id="timelineTaskInput" type="text" placeholder=">_ ENTER_OBJECTIVE..."
            style="flex:1;min-width:220px;background:#0E0E0E;border:1px solid #2A2A2A;color:#E5E7EB;padding:10px 12px;border-radius:0;outline:none;" />
          <button id="timelineAddTaskBtn" style="background:#0E0E0E;border:1px solid #10B981;color:#10B981;padding:10px 16px;border-radius:0;">
            [ ADD ]
          </button>
        </div>
      </div>

      <div class="card" style="background:#131313;border:1px solid #2A2A2A;border-radius:0;">
        <div style="font-size:12px;opacity:0.75;margin-bottom:8px;">TIMELINE GRID</div>
        <div id="timelineTaskList" style="display:flex;flex-direction:column;gap:8px;"></div>
      </div>

      <button id="timelineEvaluateBtn"
        style="width:100%;background:#0E0E0E;border:1px solid #FB7185;color:#FB7185;padding:16px 12px;border-radius:0;font-size:16px;font-weight:700;letter-spacing:0.04em;">
        [ EXECUTE EVALUATION PROTOCOL ]
      </button>

      <div id="streakMilestoneOverlay">
        <div class="milestone-content" id="milestoneContent">
          <span class="milestone-fire" id="milestoneFire">🔥</span>
          <span class="milestone-number" id="milestoneNumber">10</span>
          <div style="color: white; font-size: 20px; font-weight: 600; margin-top: 20px;">DAY STREAK UNLOCKED!</div>
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
  const taskList = root.querySelector('#timelineTaskList');
  const evaluateBtn = root.querySelector('#timelineEvaluateBtn');
  const evalStatus = root.querySelector('#dashboardEvalStatus');

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

  function renderTasks() {
    if (state.tasks.length === 0) {
      taskList.innerHTML = `<div style="padding:8px 10px;border:1px solid #2A2A2A;background:#0E0E0E;color:#9CA3AF;">NO TASKS LOADED FOR THIS DATE</div>`;
      return;
    }

    taskList.innerHTML = state.tasks.map(task => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #2A2A2A;background:#0E0E0E;padding:8px 10px;">
        <button data-toggle-id="${task.id}" ${state.locked ? 'disabled' : ''} style="flex:1;text-align:left;background:transparent;border:none;color:${task.is_completed ? '#10B981' : '#E5E7EB'};cursor:${state.locked ? 'not-allowed' : 'pointer'};">
          ${task.is_completed ? '[X]' : '[ ]'} ${escapeHtml(task.description)}
        </button>
        <button data-delete-id="${task.id}" ${state.locked ? 'disabled' : ''} style="background:transparent;border:1px solid #FB7185;color:#FB7185;padding:4px 8px;border-radius:0;cursor:${state.locked ? 'not-allowed' : 'pointer'};">
          DEL
        </button>
      </div>
    `).join('');

    taskList.querySelectorAll('[data-toggle-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (state.locked) return;
        const id = Number(btn.getAttribute('data-toggle-id'));
        try {
          await toggleTask(id);
          await loadTasks();
        } catch (err) {
          evalStatus.textContent = `ERROR: ${err.message}`;
          evalStatus.style.color = '#FB7185';
        }
      });
    });

    taskList.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
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

  evaluateBtn.addEventListener('click', async () => {
    if (state.locked) return;

    // Hiệu ứng click nút
    evaluateBtn.style.transform = 'scale(0.98)';
    evaluateBtn.style.backgroundColor = '#FB7185';
    evaluateBtn.style.color = '#131313';
    setTimeout(() => {
      evaluateBtn.style.transform = 'scale(1)';
      evaluateBtn.style.backgroundColor = '';
      evaluateBtn.style.color = '';
    }, 150);

    try {
      const result = await evaluateDate(state.selectedDate);
      
      // Lấy chuỗi và giáp hiện tại
      let currentStreak = parseInt(localStorage.getItem('discipline_streak') || '0', 10);
      let shields = parseInt(localStorage.getItem('streak_shields') || '0', 10);
      const oldRank = getRankInfo(currentStreak).name;
      const trigger = window.triggerAICoach || (() => {});

      if (result.status === 'SUCCESS') {
        evalStatus.textContent = `SUCCESS: Cố gắng tốt lắm!`;
        evalStatus.style.color = '#10B981';
        currentStreak++;

        const newRank = getRankInfo(currentStreak).name;
        if (newRank !== oldRank && PROMOTION_MESSAGES[newRank]) {
          trigger(PROMOTION_MESSAGES[newRank], 'promotion');
        } else {
          trigger(`SUCCESS. Tiếp tục duy trì chuỗi ${currentStreak} ngày nào.`, 'success');
        }

        triggerMilestoneCelebration(currentStreak);

        // Tặng Giáp: Cứ mỗi 10 ngày chuỗi nhận 1 Giáp
        if (currentStreak % 10 === 0) {
          shields++;
          trigger('🛡️ GIÁP BẢO VỆ ĐÃ ĐƯỢC CẤP! Ngươi có thêm một mạng sống.', 'info');
        }
      } else {
        // KIỂM TRA GIÁP KHI THẤT BẠI
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
      
      // Lưu trữ và cập nhật UI
      localStorage.setItem('discipline_streak', currentStreak.toString());
      localStorage.setItem('streak_shields', shields.toString());
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
  });

  syncCalendarViewToSelectedDate();
  renderCalendar();

  loadTasks().catch(err => {
    evalStatus.textContent = `ERROR: ${err.message}`;
    evalStatus.style.color = '#FB7185';
  });
}
