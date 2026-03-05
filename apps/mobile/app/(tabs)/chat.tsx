import { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
// @ts-ignore - gifted-chat types may be incomplete
import { GiftedChat, IMessage, Bubble, InputToolbar, Composer, Send } from 'react-native-gifted-chat';
import { Text } from 'react-native';
import { ProgressIndicator } from '../../components/chat/ProgressIndicator';
import { UIComponentRenderer } from '../../components/chat/UIComponentRenderer';
import { sendChatMessage } from '../../lib/api';
import type { UIComponent } from '@agentic-bank/shared';

interface ExtendedMessage extends IMessage {
  ui_components?: UIComponent[];
}

const BOT_USER = { _id: 2, name: 'Banking Assistant' };
const USER = { _id: 1, name: 'You' };

export default function ChatScreen() {
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const conversationIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Welcome message
    setMessages([
      {
        _id: 'welcome',
        text: "Hello! I'm your banking assistant. I can help you check your balance, view transactions, send payments, and more. What would you like to do?",
        createdAt: new Date(),
        user: BOT_USER,
      },
    ]);
  }, []);

  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    const userMessage = newMessages[0];
    if (!userMessage?.text) return;

    // Add user message to chat
    setMessages(prev => GiftedChat.append(prev, newMessages));
    setIsTyping(true);
    setProgressMessage('Thinking...');

    try {
      const response = await sendChatMessage({
        message: userMessage.text,
        conversation_id: conversationIdRef.current,
      });

      // Save conversation ID
      conversationIdRef.current = response.conversation_id;

      // Create bot response message
      const botMessage: ExtendedMessage = {
        _id: `bot-${Date.now()}`,
        text: response.message,
        createdAt: new Date(),
        user: BOT_USER,
        ui_components: response.ui_components,
      };

      setMessages(prev => GiftedChat.append(prev, [botMessage]));
    } catch (err: any) {
      const errorMessage: ExtendedMessage = {
        _id: `error-${Date.now()}`,
        text: 'Sorry, I encountered an issue. Please try again.',
        createdAt: new Date(),
        user: BOT_USER,
        ui_components: [{
          type: 'error_card',
          data: { message: err.message || 'Connection failed', retryable: true },
        }],
      };
      setMessages(prev => GiftedChat.append(prev, [errorMessage]));
    } finally {
      setIsTyping(false);
      setProgressMessage('');
    }
  }, []);

  const renderBubble = (props: any) => {
    return (
      <View>
        <Bubble
          {...props}
          wrapperStyle={{
            left: {
              backgroundColor: '#1a1a2e',
              borderWidth: 1,
              borderColor: '#2d2d44',
            },
            right: {
              backgroundColor: '#6c5ce7',
            },
          }}
          textStyle={{
            left: { color: '#fff' },
            right: { color: '#fff' },
          }}
        />
        {props.currentMessage.ui_components?.length > 0 && (
          <UIComponentRenderer
            components={props.currentMessage.ui_components}
            onRefresh={() => {
              // Could trigger a balance refresh
            }}
          />
        )}
      </View>
    );
  };

  const renderInputToolbar = (props: any) => (
    <InputToolbar
      {...props}
      containerStyle={styles.inputToolbar}
      primaryStyle={styles.inputPrimary}
    />
  );

  const renderComposer = (props: any) => (
    <Composer
      {...props}
      textInputStyle={styles.composer}
      placeholderTextColor="#555"
      placeholder="Type a message..."
    />
  );

  const renderSend = (props: any) => (
    <Send {...props} containerStyle={styles.sendContainer}>
      <Text style={styles.sendText}>Send</Text>
    </Send>
  );

  const renderFooter = () => {
    if (!isTyping) return null;
    return <ProgressIndicator message={progressMessage} />;
  };

  return (
    <View style={styles.container}>
      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={USER}
        renderBubble={renderBubble}
        renderInputToolbar={renderInputToolbar}
        renderComposer={renderComposer}
        renderSend={renderSend}
        renderFooter={renderFooter}
        alwaysShowSend
        inverted={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  inputToolbar: {
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inputPrimary: {
    alignItems: 'center',
  },
  composer: {
    backgroundColor: '#0f0f23',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 8,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  sendText: {
    color: '#6c5ce7',
    fontWeight: '600',
    fontSize: 16,
  },
});
