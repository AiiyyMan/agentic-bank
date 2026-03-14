import { View, Text } from 'react-native';

interface ValuePropInfoCardProps {
  topic: string;
  title: string;
  content: string;
  icon?: string;
  highlights?: string[];
}

export function ValuePropInfoCard({ topic, title, content, icon, highlights }: ValuePropInfoCardProps) {
  return (
    <View className="bg-surface-raised border border-border-default rounded-2xl p-5 my-2 mx-1">
      <View className="flex-row items-center gap-2 mb-3">
        {icon ? (
          <Text className="text-2xl">{icon}</Text>
        ) : null}
        <View className="flex-1">
          <Text className="text-text-tertiary text-xs uppercase tracking-wide font-medium">{topic}</Text>
          <Text className="text-text-primary text-base font-semibold mt-0.5">{title}</Text>
        </View>
      </View>
      <Text className="text-text-secondary text-sm leading-5 mb-3">{content}</Text>
      {highlights && highlights.length > 0 && (
        <View className="gap-1.5">
          {highlights.map((h, i) => (
            <View key={i} className="flex-row items-start gap-2">
              <Text className="text-brand-default text-sm mt-0.5">•</Text>
              <Text className="text-text-secondary text-sm flex-1 leading-5">{h}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
