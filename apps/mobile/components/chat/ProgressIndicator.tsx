import { View, Text, ActivityIndicator } from 'react-native';
import { useTokens } from '../../theme/tokens';

interface ProgressIndicatorProps {
  message?: string;
}

export function ProgressIndicator({ message = 'Thinking...' }: ProgressIndicatorProps) {
  const t = useTokens();
  return (
    <View className="flex-row items-center gap-2 py-2 px-3">
      <ActivityIndicator size="small" color={t.brand.default} />
      <Text className="text-text-tertiary text-sm italic">{message}</Text>
    </View>
  );
}
