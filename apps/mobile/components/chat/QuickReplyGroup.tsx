import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

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
            style={[
              styles.pill,
              isPressed && styles.pillPressed,
            ]}
            onPress={() => onSelect?.(reply.value)}
            onPressIn={() => setPressedIndex(index)}
            onPressOut={() => setPressedIndex(null)}
          >
            <Text style={[styles.label, isPressed && styles.labelPressed]}>
              {reply.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.4)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    transform: [{ scale: 1 }],
  },
  pillPressed: {
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    borderColor: '#6c5ce7',
    transform: [{ scale: 0.95 }],
  },
  label: {
    color: '#a29bfe',
    fontSize: 14,
    fontWeight: '500',
  },
  labelPressed: {
    color: '#fff',
  },
});
