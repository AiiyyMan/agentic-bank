import { View, Text } from 'react-native';
import { UIComponentRenderer } from './UIComponentRenderer';
import type { ChatMessage } from '../../stores/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  onQuickReply?: (value: string) => void;
  onRefresh?: () => void;
  onSignIn?: () => void;
  onTellMeMore?: () => void;
}

export function MessageBubble({ message, onQuickReply, onRefresh, onSignIn, onTellMeMore }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View className={`px-4 py-1 ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Bubble */}
      {message.text ? (
        <View
          className={`rounded-2xl px-4 py-3 max-w-[85%] ${
            isUser
              ? 'bg-brand-default rounded-tr-sm'
              : 'bg-surface-raised border border-border-default rounded-tl-sm'
          }`}
        >
          <Text
            className={`text-[15px] leading-[22px] ${
              isUser ? 'text-text-inverse' : 'text-text-primary'
            }`}
          >
            {message.text}
          </Text>
        </View>
      ) : null}

      {/* UI cards below bubble (assistant only) */}
      {!isUser && message.ui_components && message.ui_components.length > 0 && (
        <View className="w-full mt-2">
          <UIComponentRenderer
            components={message.ui_components}
            onQuickReply={onQuickReply}
            onRefresh={onRefresh}
            onSignIn={onSignIn}
            onTellMeMore={onTellMeMore}
          />
        </View>
      )}
    </View>
  );
}
