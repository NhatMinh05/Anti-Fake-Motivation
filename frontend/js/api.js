const API_BASE = 'http://127.0.0.1:8000/api';

export async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  return res.json();
}

export async function fetchDashboardData() {
  const [scoreData, historyData, rangeData, analytics, configData] = await Promise.all([
    api('/score'),
    api('/history?limit=100'),
    api('/history/range?days=365'),
    api('/analytics'),
    api('/config')
  ]);
  return { scoreData, historyData, rangeData, analytics, configData };
}

export async function logDay(status, notes = null) {
  return api('/log', {
    method: 'POST',
    body: JSON.stringify({ status, notes })
  });
}

export async function evaluateDate(date) {
  return api('/evaluate_date', {
    method: 'POST',
    body: JSON.stringify({ date })
  });
}

export async function fetchTasks(date) {
  return api(`/tasks?date=${encodeURIComponent(date)}`);
}

export async function addTask(date, description) {
  return api('/tasks', {
    method: 'POST',
    body: JSON.stringify({ date, description })
  });
}

export async function toggleTask(taskId) {
  return api(`/tasks/${taskId}/toggle`, {
    method: 'PUT'
  });
}

export async function deleteTask(taskId) {
  return api(`/tasks/${taskId}`, {
    method: 'DELETE'
  });
}

export async function resetScore() {
  return api('/reset', {
    method: 'POST',
    body: JSON.stringify({ confirm: true })
  });
}

export async function setPersonalityMode(mode) {
  return api('/config', {
    method: 'POST',
    body: JSON.stringify({ personality_mode: mode })
  });
}

export async function updateConfig(payload) {
  return api('/config', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function fetchIntel(timeframe = 30) {
  return api('/intel', {
    method: 'POST',
    body: JSON.stringify({ timeframe })
  });
}
