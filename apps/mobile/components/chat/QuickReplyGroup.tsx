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
  if (!replies || replies.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="my-2 mx-1"
      contentContainerStyle={{ paddingHorizontal: 4 }}
    >
      {replies.map((reply, index) => (
        <Pressable
          key={index}
          className="bg-surface-primary border border-brand-500/40 rounded-full px-4 py-2 mr-2 active:bg-brand-500/10"
          onPress={() => onSelect?.(reply.value)}
        >
          <Text className="text-brand-400 text-sm font-medium">{reply.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
