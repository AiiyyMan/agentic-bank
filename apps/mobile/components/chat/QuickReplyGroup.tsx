import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';

interface QuickReply {
  label: string;
  value: string;
}

interface QuickReplyGroupProps {
  replies: QuickReply[];
  onSelect?: (value: string) => void;
}

export function QuickReplyGroup({ replies, onSelect }: QuickReplyGroupProps) {
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  if (!replies || replies.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="my-2 mx-1"
      contentContainerStyle={{ paddingHorizontal: 4 }}
    >
      {replies.map((reply, index) => {
        const isPressed = pressedIndex === index;
        return (
          <Pressable
            key={index}
            className={`border rounded-full px-4 py-2 mr-2 ${
              isPressed
                ? 'bg-brand-subtle border-brand-default'
                : 'bg-surface-primary border-brand-muted'
            }`}
            style={isPressed ? { transform: [{ scale: 0.95 }] } : undefined}
            onPress={() => onSelect?.(reply.value)}
            onPressIn={() => setPressedIndex(index)}
            onPressOut={() => setPressedIndex(null)}
          >
            <Text
              className={`text-sm font-medium ${isPressed ? 'text-text-primary' : 'text-brand-text'}`}
            >
              {reply.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
