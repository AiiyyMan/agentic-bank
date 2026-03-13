import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../../stores/chat';

// Reset store state between tests
beforeEach(() => {
  useChatStore.getState().reset();
});

describe('useChatStore', () => {
  describe('initial state', () => {
    it('starts with empty messages', () => {
      const { messages } = useChatStore.getState();
      expect(messages).toEqual([]);
    });

    it('starts with idle status', () => {
      const { status } = useChatStore.getState();
      expect(status).toBe('idle');
    });

    it('starts with no conversationId', () => {
      const { conversationId } = useChatStore.getState();
      expect(conversationId).toBeUndefined();
    });
  });

  describe('addUserMessage', () => {
    it('prepends a user message', () => {
      useChatStore.getState().addUserMessage('Hello');
      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].text).toBe('Hello');
    });

    it('returns the created message', () => {
      const msg = useChatStore.getState().addUserMessage('Test');
      expect(msg.id).toMatch(/^user-/);
      expect(msg.text).toBe('Test');
    });

    it('newest messages appear first (inverted list)', () => {
      useChatStore.getState().addUserMessage('First');
      useChatStore.getState().addUserMessage('Second');
      const { messages } = useChatStore.getState();
      expect(messages[0].text).toBe('Second');
      expect(messages[1].text).toBe('First');
    });
  });

  describe('addAssistantMessage', () => {
    it('prepends an assistant message', () => {
      useChatStore.getState().addAssistantMessage('bot-1', 'Hello back');
      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].text).toBe('Hello back');
    });

    it('sets conversationId when provided', () => {
      useChatStore.getState().addAssistantMessage('bot-1', 'Hi', undefined, 'conv-123');
      expect(useChatStore.getState().conversationId).toBe('conv-123');
    });

    it('preserves existing conversationId when not provided', () => {
      useChatStore.getState().setConversationId('conv-existing');
      useChatStore.getState().addAssistantMessage('bot-1', 'Hi');
      expect(useChatStore.getState().conversationId).toBe('conv-existing');
    });

    it('resets status to idle', () => {
      useChatStore.getState().setStatus('thinking', 'Loading...');
      useChatStore.getState().addAssistantMessage('bot-1', 'Done');
      expect(useChatStore.getState().status).toBe('idle');
      expect(useChatStore.getState().progressMessage).toBe('');
    });

    it('stores ui_components on the message', () => {
      const components = [{ type: 'balance_card' as const, data: { balance: 1000, currency: 'GBP', account_name: 'Test' } }];
      useChatStore.getState().addAssistantMessage('bot-1', 'Here is your balance', components);
      const { messages } = useChatStore.getState();
      expect(messages[0].ui_components).toEqual(components);
    });
  });

  describe('addErrorMessage', () => {
    it('adds an assistant error message with error_card', () => {
      useChatStore.getState().addErrorMessage('Connection failed');
      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].ui_components?.[0].type).toBe('error_card');
    });

    it('resets status to idle', () => {
      useChatStore.getState().setStatus('thinking');
      useChatStore.getState().addErrorMessage('Error');
      expect(useChatStore.getState().status).toBe('idle');
    });
  });

  describe('setStatus', () => {
    it('updates status and progressMessage', () => {
      useChatStore.getState().setStatus('thinking', 'Loading your balance...');
      expect(useChatStore.getState().status).toBe('thinking');
      expect(useChatStore.getState().progressMessage).toBe('Loading your balance...');
    });

    it('defaults progressMessage to empty string', () => {
      useChatStore.getState().setStatus('tool_executing');
      expect(useChatStore.getState().progressMessage).toBe('');
    });
  });

  describe('setConversationId', () => {
    it('sets conversationId', () => {
      useChatStore.getState().setConversationId('conv-abc');
      expect(useChatStore.getState().conversationId).toBe('conv-abc');
    });
  });

  describe('reset', () => {
    it('clears all messages, status, and conversationId', () => {
      useChatStore.getState().addUserMessage('Hello');
      useChatStore.getState().setStatus('thinking', 'Loading...');
      useChatStore.getState().setConversationId('conv-123');

      useChatStore.getState().reset();

      const state = useChatStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.status).toBe('idle');
      expect(state.progressMessage).toBe('');
      expect(state.conversationId).toBeUndefined();
    });
  });
});
