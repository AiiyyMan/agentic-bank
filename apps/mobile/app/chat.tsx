import { useCallback, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { useChatStore } from '../stores/chat';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { sendChatMessage } from '../lib/api';
import { useTokens } from '../theme/tokens';

function TypingIndicator({ message }: { message: string }) {
  const t = useTokens();
  return (
    <View className="px-4 py-1 items-start">
      <View className="bg-surface-raised border border-border-default rounded-2xl rounded-tl-sm px-4 py-3 flex-row items-center gap-2">
        <ActivityIndicator size="small" color={t.brand.default} />
        <Text className="text-text-secondary text-sm">{message || 'Thinking...'}</Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { messages, status, progressMessage, conversationId, addUserMessage, addAssistantMessage, addErrorMessage, setStatus } = useChatStore();
  const flatListRef = useRef<FlatList>(null);
  const hasGreetedRef = useRef(false);
  const t = useTokens();

  const sendMessage = useCallback(async (text: string) => {
    addUserMessage(text);
    setStatus('thinking', 'Thinking...');

    try {
      const response = await sendChatMessage({
        message: text,
        conversation_id: conversationId,
      });

      addAssistantMessage(
        `bot-${Date.now()}`,
        response.message,
        response.ui_components,
        response.conversation_id,
      );
    } catch (err: any) {
      addErrorMessage(err.message || 'Connection failed. Please try again.');
    }
  }, [conversationId, addUserMessage, addAssistantMessage, addErrorMessage, setStatus]);

  const sendGreeting = useCallback(async () => {
    setStatus('thinking', 'Loading...');
    try {
      const response = await sendChatMessage({
        message: '__app_open__',
        conversation_id: undefined,
      });

      addAssistantMessage(
        `greeting-${Date.now()}`,
        response.message,
        response.ui_components,
        response.conversation_id,
      );
    } catch {
      addAssistantMessage(
        'welcome-fallback',
        "Hello! I'm your banking assistant. I can help you check your balance, view transactions, send payments, and more. What would you like to do?",
      );
    }
  }, [setStatus, addAssistantMessage]);

  useEffect(() => {
    if (!hasGreetedRef.current && messages.length === 0) {
      hasGreetedRef.current = true;
      sendGreeting();
    }
  }, []);

  const isLoading = status !== 'idle';

  return (
    <SafeAreaView className="flex-1 bg-background-primary">
      {/* Header */}
      <View
        className="flex-row items-center px-4 py-3 border-b border-border-default"
        style={{ backgroundColor: t.surface.raised }}
      >
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
          <Text className="text-brand-default text-base font-medium">✕</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-text-primary font-semibold text-base">Banking Assistant</Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            <View className="w-1.5 h-1.5 rounded-full bg-status-success-default" />
            <Text className="text-text-tertiary text-xs">Online</Text>
          </View>
        </View>
        <View className="w-10" />
      </View>

      {/* Messages (inverted FlatList — newest at bottom) */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            onQuickReply={sendMessage}
          />
        )}
        inverted
        contentContainerStyle={{ paddingVertical: 12 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          isLoading ? <TypingIndicator message={progressMessage} /> : null
        }
      />

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={isLoading}
      />
    </SafeAreaView>
  );
}
