import { View, Text, TouchableOpacity } from 'react-native';

interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
}

interface ChecklistCardProps {
  items: ChecklistItem[];
  onItemTap?: (label: string) => void;
}

export function ChecklistCard({ items, onItemTap }: ChecklistCardProps) {
  const completed = items.filter(i => i.completed).length;

  return (
    <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-text-primary font-semibold text-base">Getting Started</Text>
        <Text className="text-text-tertiary text-sm">{completed}/{items.length}</Text>
      </View>

      {/* Progress bar */}
      <View className="h-2 bg-surface-secondary rounded-full overflow-hidden mb-4">
        <View
          className="h-full bg-brand-500 rounded-full"
          style={{ width: `${items.length > 0 ? (completed / items.length) * 100 : 0}%` }}
        />
      </View>

      {items.map((item) => {
        const isPending = !item.completed && onItemTap;
        return isPending ? (
          <TouchableOpacity
            key={item.key}
            onPress={() => onItemTap(item.label)}
            className="flex-row items-center py-1.5 active:opacity-60"
          >
            <View className="w-5 h-5 rounded-full border-2 items-center justify-center mr-3 border-border-secondary">
            </View>
            <Text className="text-sm flex-1 text-text-primary">{item.label}</Text>
            <Text className="text-brand-default text-xs ml-1">→</Text>
          </TouchableOpacity>
        ) : (
          <View key={item.key} className="flex-row items-center py-1.5">
            <View className={`w-5 h-5 rounded-full border-2 items-center justify-center mr-3 ${
              item.completed ? 'bg-brand-500 border-brand-500' : 'border-border-secondary'
            }`}>
              {item.completed && <Text className="text-white text-xs">✓</Text>}
            </View>
            <Text className={`text-sm flex-1 ${item.completed ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
