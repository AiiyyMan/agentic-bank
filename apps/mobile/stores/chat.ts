import { create } from 'zustand';
import type { UIComponent } from '@agentic-bank/shared';

export type ChatStatus = 'idle' | 'thinking' | 'streaming' | 'tool_executing';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ui_components?: UIComponent[];
  timestamp: Date;
  toolName?: string;
}

export interface InProgressMessage {
  id: string;
  text: string;
}

interface ChatState {
  messages: ChatMessage[];
  status: ChatStatus;
  progressMessage: string;
  conversationId: string | undefined;
  inProgressMessage: InProgressMessage | null;

  addUserMessage: (text: string) => ChatMessage;
  addAssistantMessage: (id: string, text: string, ui_components?: UIComponent[], conversationId?: string) => void;
  addErrorMessage: (message: string) => void;
  setStatus: (status: ChatStatus, progressMessage?: string) => void;
  setConversationId: (id: string) => void;
  startStreamingMessage: (id: string) => void;
  appendToken: (id: string, token: string) => void;
  commitStreamingMessage: (id: string, text: string, ui_components?: UIComponent[], conversationId?: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  status: 'idle',
  progressMessage: '',
  conversationId: undefined,
  inProgressMessage: null,

  addUserMessage: (text) => {
    const msg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random()}`,
      role: 'user',
      text,
      timestamp: new Date(),
    };
    // Prepend (newest first) — chat.tsx FlatList uses `inverted` prop,
    // which reverses rendering so the newest message appears at the bottom.
    set((s) => ({ messages: [msg, ...s.messages] }));
    return msg;
  },

  addAssistantMessage: (id, text, ui_components, conversationId) => {
    const msg: ChatMessage = {
      id,
      role: 'assistant',
      text,
      ui_components,
      timestamp: new Date(),
    };
    // Prepend (newest first) — same inverted FlatList pattern as addUserMessage.
    set((s) => ({
      messages: [msg, ...s.messages],
      conversationId: conversationId ?? s.conversationId,
      status: 'idle',
      progressMessage: '',
    }));
  },

  addErrorMessage: (message) => {
    const msg: ChatMessage = {
      id: `error-${Date.now()}`,
      role: 'assistant',
      text: message,
      ui_components: [{ type: 'error_card', data: { message, retryable: true } }],
      timestamp: new Date(),
    };
    set((s) => ({
      messages: [msg, ...s.messages],
      status: 'idle',
      progressMessage: '',
    }));
  },

  setStatus: (status, progressMessage = '') => {
    set({ status, progressMessage });
  },

  setConversationId: (id) => set({ conversationId: id }),

  startStreamingMessage: (id) => {
    set({ inProgressMessage: { id, text: '' }, status: 'streaming', progressMessage: '' });
  },

  appendToken: (id, token) => {
    set((s) => {
      if (s.inProgressMessage?.id !== id) return s;
      return { inProgressMessage: { id, text: s.inProgressMessage.text + token } };
    });
  },

  commitStreamingMessage: (id, text, ui_components, conversationId) => {
    const msg: ChatMessage = {
      id,
      role: 'assistant',
      text,
      ui_components,
      timestamp: new Date(),
    };
    set((s) => ({
      messages: [msg, ...s.messages],
      conversationId: conversationId ?? s.conversationId,
      status: 'idle',
      progressMessage: '',
      inProgressMessage: null,
    }));
  },

  reset: () => set({ messages: [], status: 'idle', progressMessage: '', conversationId: undefined, inProgressMessage: null }),
}));
