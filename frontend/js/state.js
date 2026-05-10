export const state = {
  score: 0,
  history: [],
  trend: [],
  success30: 0,
  failure30: 0,
  personalityMode: 'RUTHLESS_MODE',
  chatModelMode: 'FLASH',
  isChatSending: false,
  chatAbortController: null,
  conversations: [],
  activeConversationId: null
};

export const STORAGE_KEY = 'discipline_os_conversations_v1';

export function getActiveConversation() {
  return state.conversations.find(c => c.id === state.activeConversationId) || null;
}

export function setActiveConversation(id) {
  state.activeConversationId = id;
}

export function createConversation(title = null) {
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const conversation = {
    id,
    title: title || `Session ${state.conversations.length + 1}`,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  state.conversations.unshift(conversation);
  state.activeConversationId = id;
  return conversation;
}

export function deleteActiveConversation() {
  state.conversations = state.conversations.filter(c => c.id !== state.activeConversationId);
  if (!state.conversations.length) {
    createConversation();
  } else {
    state.activeConversationId = state.conversations[0].id;
  }
}

export function addMessageToActiveConversation(role, content, modelMode = state.chatModelMode) {
  const conv = getActiveConversation();
  if (!conv) return;
  conv.messages.push({ role, content, modelMode });
  if (conv.messages.length > 60) conv.messages.shift();
  if (!conv.title || conv.title.startsWith('Session')) {
    const firstUser = conv.messages.find(m => m.role === 'user');
    if (firstUser) conv.title = firstUser.content.slice(0, 24) || conv.title;
  }
  conv.updatedAt = Date.now();
}
