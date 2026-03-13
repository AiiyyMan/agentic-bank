import { TouchableOpacity, Text, View } from 'react-native';
import { router } from 'expo-router';

interface ChatFABProps {
  unreadCount?: number;
}

export function ChatFAB({ unreadCount = 0 }: ChatFABProps) {
  return (
    <View className="absolute bottom-24 right-5" style={{ zIndex: 100 }}>
      <TouchableOpacity
        onPress={() => router.push('/chat')}
        className="w-14 h-14 rounded-full bg-brand-default items-center justify-center shadow-lg"
        style={{
          shadowColor: '#6c5ce7',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }}
        accessibilityLabel="Open banking assistant"
        accessibilityRole="button"
      >
        <Text className="text-2xl">💬</Text>
      </TouchableOpacity>

      {unreadCount > 0 && (
        <View className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-status-error-default items-center justify-center">
          <Text className="text-text-inverse text-xs font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </View>
  );
}
