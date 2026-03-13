import { View, Text } from 'react-native';

interface InsightCardProps {
  title: string;
  message: string;
  category?: string;
  changePercent?: number;
  period?: string;
}

export function InsightCard({ title, message, changePercent, period }: InsightCardProps) {
  const isUp = changePercent != null && changePercent > 0;
  const isDown = changePercent != null && changePercent < 0;

  return (
    <View className="bg-surface-primary border border-ai-border rounded-2xl p-4 my-2 mx-1">
      <View className="flex-row items-center mb-2">
        <View className="w-8 h-8 rounded-full bg-ai-surface items-center justify-center mr-3">
          <Text className="text-base">💡</Text>
        </View>
        <Text className="text-text-primary font-semibold text-base flex-1">{title}</Text>
      </View>
      <Text className="text-text-secondary text-sm leading-5">{message}</Text>
      {changePercent != null && (
        <View className="flex-row items-center mt-2">
          <Text className={`text-sm font-medium ${isUp ? 'text-status-error' : isDown ? 'text-status-success' : 'text-text-tertiary'}`}>
            {isUp ? '↑' : isDown ? '↓' : '→'} {Math.abs(changePercent)}%
          </Text>
          {period && <Text className="text-text-tertiary text-xs ml-2">{period}</Text>}
        </View>
      )}
    </View>
  );
}
