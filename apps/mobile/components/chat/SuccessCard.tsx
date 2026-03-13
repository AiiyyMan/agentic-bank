import { View, Text } from 'react-native';

interface SuccessCardProps {
  title: string;
  message: string;
  details?: Record<string, string>;
}

export function SuccessCard({ title, message, details }: SuccessCardProps) {
  return (
    <View className="bg-surface-primary border border-status-success/30 rounded-2xl p-4 my-2 mx-1">
      <View className="flex-row items-center mb-2">
        <View className="w-8 h-8 rounded-full bg-status-success/20 items-center justify-center mr-3">
          <Text className="text-base">✓</Text>
        </View>
        <Text className="text-text-primary font-semibold text-base flex-1">{title}</Text>
      </View>
      <Text className="text-text-secondary text-sm mb-2">{message}</Text>
      {details && Object.keys(details).length > 0 && (
        <View className="bg-surface-secondary rounded-xl p-3 mt-1">
          {Object.entries(details).map(([key, value]) => (
            <View key={key} className="flex-row justify-between py-1">
              <Text className="text-text-tertiary text-sm">{key}</Text>
              <Text className="text-text-primary text-sm font-medium">{value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
