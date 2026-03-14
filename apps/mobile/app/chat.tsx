import { useCallback, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useChatStore } from '../stores/chat';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { streamChatMessage, getPendingActions } from '../lib/api';
import { useTokens } from '../theme/tokens';
import type { UIComponent } from '@agentic-bank/shared';

export default function ChatScreen() {
  const {
    messages,
    status,
    progressMessage,
    conversationId,
    inProgressMessage,
    addUserMessage,
    addAssistantMessage,
    addErrorMessage,
    setStatus,
    startStreamingMessage,
    appendToken,
    commitStreamingMessage,
  } = useChatStore();
  const flatListRef = useRef<FlatList>(null);
  const hasGreetedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const t = useTokens();

  // Cancel any in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const runStream = useCallback(async (text: string, messageId: string, convId?: string) => {
    // Cancel any existing stream
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    startStreamingMessage(messageId);

    let accumulatedText = '';
    let finalUiComponents: UIComponent[] | undefined;
    let finalConversationId: string | undefined;

    try {
      const stream = streamChatMessage(
        { message: text, conversation_id: convId },
        controller.signal,
      );

      for await (const event of stream) {
        if (controller.signal.aborted) break;

        if (event.event === 'token') {
          const token = (event.data as { text: string }).text;
          accumulatedText += token;
          appendToken(messageId, token);
        } else if (event.event === 'tool_use') {
          const toolData = event.data as { name: string };
          const progressLabel = toolProgressLabel(toolData.name);
          setStatus('tool_executing', progressLabel);
        } else if (event.event === 'tool_result') {
          setStatus('streaming', '');
        } else if (event.event === 'ui_components') {
          finalUiComponents = event.data as UIComponent[];
        } else if (event.event === 'done') {
          const doneData = event.data as {
            message?: string;
            ui_components?: UIComponent[];
            conversation_id?: string;
          };
          // Prefer message from done payload; fall back to accumulated tokens
          if (doneData.message) accumulatedText = doneData.message;
          if (doneData.ui_components) finalUiComponents = doneData.ui_components;
          if (doneData.conversation_id) finalConversationId = doneData.conversation_id;
        } else if (event.event === 'error') {
          const errData = event.data as { message: string };
          throw new Error(errData.message || 'Stream error');
        }
      }

      if (!controller.signal.aborted) {
        commitStreamingMessage(messageId, accumulatedText, finalUiComponents, finalConversationId);
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        // Clear in-progress state and show error
        commitStreamingMessage(messageId, '');
        addErrorMessage(err.message || 'Connection failed. Please try again.');
      }
    }
  }, [startStreamingMessage, appendToken, setStatus, commitStreamingMessage, addErrorMessage]);

  const sendMessage = useCallback(async (text: string) => {
    addUserMessage(text);
    setStatus('thinking', 'Thinking...');
    const messageId = `bot-${Date.now()}`;
    await runStream(text, messageId, conversationId);
  }, [conversationId, addUserMessage, setStatus, runStream]);

  const sendGreeting = useCallback(async () => {
    setStatus('thinking', 'Loading...');
    const messageId = `greeting-${Date.now()}`;
    try {
      await runStream('__app_open__', messageId, undefined);
    } catch {
      addAssistantMessage(
        'welcome-fallback',
        "Hello! I'm your banking assistant. I can help you check your balance, view transactions, send payments, and more. What would you like to do?",
      );
    }
  }, [setStatus, runStream, addAssistantMessage]);

  const handleNewConversation = useCallback(() => {
    const hasPendingConfirmation = messages.some(m =>
      m.ui_components?.some((c: any) => c.type === 'confirmation_card')
    );

    if (hasPendingConfirmation) {
      Alert.alert(
        'Pending Confirmation',
        'You have a pending confirmation. Starting a new conversation will cancel it. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'New Chat',
            style: 'destructive',
            onPress: () => {
              useChatStore.getState().reset();
              sendGreeting();
            },
          },
        ],
      );
    } else {
      useChatStore.getState().reset();
      sendGreeting();
    }
  }, [messages, sendGreeting]);

  useEffect(() => {
    if (!hasGreetedRef.current && messages.length === 0) {
      hasGreetedRef.current = true;
      sendGreeting();
    }
  }, []);

  // EXI-06c: Resurface pending confirmation actions on mount (only when chat is fresh)
  useEffect(() => {
    let cancelled = false;

    async function surfacePendingActions() {
      // Only resurface when greeting is present but no conversation has started
      if (messages.length > 1) return;

      try {
        const { pending_actions } = await getPendingActions();
        if (cancelled) return;

        for (const action of pending_actions) {
          addAssistantMessage(
            `resurface-${action.id}`,
            `You have a pending confirmation: ${action.summary || action.tool_name}`,
            [{
              type: 'confirmation_card',
              data: {
                pending_action_id: action.id,
                summary: action.summary ?? `Confirm ${action.tool_name}`,
                details: action.details ?? action.params ?? {},
                expires_at: action.expires_at,
              },
            }],
            undefined,
          );
        }
      } catch {
        // Network failure or auth error — silently ignore, don't break chat
      }
    }

    surfacePendingActions();

    return () => {
      cancelled = true;
    };
  }, []);

  const isLoading = status !== 'idle';

  // Build the list data: prepend in-progress message (if any) so it renders at the bottom
  // The FlatList is inverted, so index 0 = bottom of screen.
  const listData = inProgressMessage && inProgressMessage.text.length > 0
    ? [
        {
          id: inProgressMessage.id,
          role: 'assistant' as const,
          text: inProgressMessage.text,
          timestamp: new Date(),
        },
        ...messages,
      ]
    : messages;

  return (
    <SafeAreaView className="flex-1 bg-background-primary">
      {/* Header */}
      <View
        className="flex-row items-center px-4 py-3 border-b border-border-default"
        style={{ backgroundColor: t.surface.raised }}
      >
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} className="w-10 h-10 items-center justify-center -ml-2">
          <Text className="text-brand-default text-base font-medium">✕</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-text-primary font-semibold text-base">Banking Assistant</Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            <View className="w-1.5 h-1.5 rounded-full bg-status-success-default" />
            <Text className="text-text-tertiary text-xs">Online</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleNewConversation} className="w-10 h-10 items-center justify-center -mr-2">
          <Text className="text-brand-default text-lg">↺</Text>
        </TouchableOpacity>
      </View>

      {/* Messages (inverted FlatList — newest at bottom) */}
      <FlatList
        ref={flatListRef}
        data={listData}
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
          isLoading && status !== 'streaming' ? <TypingIndicator label={progressMessage || undefined} /> : null
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

// Map tool names to human-readable progress labels
// Tool names match apps/api/src/tools/definitions.ts TOOL_PROGRESS constant
function toolProgressLabel(toolName: string): string {
  const labels: Record<string, string> = {
    // Core banking — read
    check_balance: 'Checking your balance...',
    get_transactions: 'Loading transactions...',
    get_accounts: 'Loading accounts...',
    get_beneficiaries: 'Loading beneficiaries...',
    get_pots: 'Loading savings pots...',
    get_payment_history: 'Loading payment history...',
    get_loan_status: 'Checking loan status...',
    get_standing_orders: 'Loading standing orders...',
    // Core banking — write
    send_payment: 'Preparing payment...',
    add_beneficiary: 'Adding beneficiary...',
    delete_beneficiary: 'Removing beneficiary...',
    create_pot: 'Creating savings pot...',
    transfer_to_pot: 'Transferring to pot...',
    transfer_from_pot: 'Withdrawing from pot...',
    create_standing_order: 'Setting up standing order...',
    cancel_standing_order: 'Cancelling standing order...',
    // Lending — read
    check_credit_score: 'Checking credit score...',
    check_eligibility: 'Checking eligibility...',
    get_loan_schedule: 'Loading loan schedule...',
    get_flex_plans: 'Loading Flex plans...',
    get_flex_eligible: 'Checking eligible transactions...',
    // Lending — write
    apply_for_loan: 'Processing application...',
    make_loan_payment: 'Processing payment...',
    flex_purchase: 'Setting up Flex plan...',
    pay_off_flex: 'Paying off Flex plan...',
    // Insights
    get_spending_by_category: 'Analysing spending...',
    get_weekly_summary: 'Preparing weekly summary...',
    get_spending_insights: 'Checking spending patterns...',
    // Onboarding
    collect_name: 'Saving your name...',
    collect_dob: 'Saving date of birth...',
    collect_address: 'Saving your address...',
    verify_identity: 'Verifying your identity...',
    provision_account: 'Setting up your account...',
    get_value_prop_info: 'Getting information...',
    get_onboarding_checklist: 'Loading checklist...',
    update_checklist_item: 'Updating checklist...',
    complete_onboarding: 'Completing setup...',
    // Internal
    respond_to_user: '',
  };
  return labels[toolName] ?? 'Working...';
}
