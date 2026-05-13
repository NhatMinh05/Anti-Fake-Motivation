const API_BASE = 'http://127.0.0.1:8000/api';

function getToken() {
  return localStorage.getItem('access_token');
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options
  });
  if (res.status === 401) {
    // Token expired or invalid, force re-login
    localStorage.removeItem('access_token');
    window.location.href = 'login.html';
    return;
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  return res.json();
}

export async function getMe() {
  return api('/me', { cache: 'no-store' });
}

export async function updateMe(data) {
  return api('/me', {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteMe() {
  return api('/me', {
    method: 'DELETE'
  });
}

export function logout() {
  localStorage.removeItem('access_token');
  window.location.href = 'login.html';
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

export async function addTask(date, description, parent_id = null) {
  return api('/tasks', {
    method: 'POST',
    body: JSON.stringify({ date, description, parent_id })
  });
}

export async function toggleTask(taskId) {
  return api(`/tasks/${taskId}/toggle`, {
    method: 'PUT'
  });
}

export async function moveTask(taskId, parentId) {
  return api(`/tasks/${taskId}/move`, {
    method: 'PUT',
    body: JSON.stringify({ parent_id: parentId })
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

export async function braindumpTasks(date, text) {
  return api('/braindump', {
    method: 'POST',
    body: JSON.stringify({ date, text })
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
