import { state, STORAGE_KEY, getActiveConversation, createConversation, deleteActiveConversation, addMessageToActiveConversation } from '../js/state.js';

export function renderAIDrawer(container) {
  container.innerHTML = `
    <div id="aiDrawer" class="ai-drawer hidden">
      <aside class="drawer-left">
        <div class="drawer-head">Conversations</div>
        <div class="drawer-actions">
          <button id="newChatBtn">New</button>
          <button id="deleteChatBtn">Delete</button>
        </div>
        <div id="conversationList" class="conversation-list"></div>
      </aside>

      <section class="drawer-main">
        <header class="drawer-main-head">
          <h3>AI Assistant</h3>
          <button id="closeDrawerBtn">Close</button>
        </header>

        <div id="chatLog" class="chat-log"></div>

        <div class="composer">
          <div class="composer-top">
            <span>Tools</span>
            <div class="composer-modes">
              <button id="modeFlashBtn" class="active">FLASH</button>
              <button id="modeProBtn">PRO</button>
            </div>
          </div>
          <div class="composer-input-row">
            <textarea id="chatInput" placeholder="Ask anything..."></textarea>
            <button id="stopChatBtn" class="hidden">Stop</button>
            <button id="sendChatBtn">Send</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

export function saveConversations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    conversations: state.conversations,
    activeConversationId: state.activeConversationId
  }));
}

export function loadConversations() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state.conversations = Array.isArray(parsed.conversations) ? parsed.conversations : [];
      state.activeConversationId = parsed.activeConversationId || null;
    } catch {
      state.conversations = [];
      state.activeConversationId = null;
    }
  }
  if (!state.conversations.length) {
    createConversation();
  } else if (!state.conversations.find(c => c.id === state.activeConversationId)) {
    state.activeConversationId = state.conversations[0].id;
  }
}

export function renderConversationList() {
  const container = document.getElementById('conversationList');
  if (!container) return;
  container.innerHTML = state.conversations.map(c => `
    <button class="conversation-item ${c.id === state.activeConversationId ? 'active' : ''}" data-id="${c.id}">
      <div>${c.title}</div>
      <small>${new Date(c.updatedAt).toLocaleString()}</small>
    </button>
  `).join('');
  container.querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeConversationId = btn.dataset.id;
      saveConversations();
      renderConversationList();
      renderActiveConversation();
    });
  });
}

export function renderActiveConversation() {
  const chatLog = document.getElementById('chatLog');
  if (!chatLog) return;
  chatLog.innerHTML = '';
  const active = getActiveConversation();
  if (!active) return;
  active.messages.forEach(m => {
    const row = document.createElement('div');
    row.className = `chat-row ${m.role}`;
    row.innerHTML = `<b>${m.role.toUpperCase()}</b><p>${m.content}</p>`;
    chatLog.appendChild(row);
  });
  chatLog.scrollTop = chatLog.scrollHeight;
}

export function appendChat(role, content) {
  addMessageToActiveConversation(role, content, state.chatModelMode);
  saveConversations();
  renderConversationList();
  renderActiveConversation();
}

export function bindConversationButtons() {
  document.getElementById('newChatBtn')?.addEventListener('click', () => {
    createConversation();
    saveConversations();
    renderConversationList();
    renderActiveConversation();
  });

  document.getElementById('deleteChatBtn')?.addEventListener('click', () => {
    deleteActiveConversation();
    saveConversations();
    renderConversationList();
    renderActiveConversation();
  });
}
