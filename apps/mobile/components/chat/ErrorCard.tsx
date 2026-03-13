import { View, Text, TouchableOpacity } from 'react-native';

interface ErrorCardProps {
  message: string;
  retryable: boolean;
  onRetry?: () => void;
}

export function ErrorCard({ message, retryable, onRetry }: ErrorCardProps) {
  return (
    <View className="bg-surface-primary border border-status-error rounded-2xl p-4 my-2 mx-1">
      <Text className="text-status-error text-xs font-semibold uppercase mb-2">Error</Text>
      <Text className="text-text-primary text-sm mb-3">{message}</Text>
      {retryable && onRetry && (
        <TouchableOpacity
          className="py-2.5 rounded-xl items-center border border-status-error"
          onPress={onRetry}
        >
          <Text className="text-status-error font-semibold text-sm">Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
