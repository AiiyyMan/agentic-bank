import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { router } from 'expo-router';

const VALUE_PROPS = [
  { icon: '⚡', label: 'AI-powered banking' },
  { icon: '🔒', label: 'FSCS protected up to £85k' },
  { icon: '💬', label: 'Natural language control' },
  { icon: '📊', label: 'Smart spending insights' },
];

export default function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background-primary justify-between px-6 pb-8">
      {/* Hero */}
      <View className="items-center pt-20">
        <View className="w-18 h-18 rounded-2xl bg-surface-secondary border border-brand-default justify-center items-center mb-5"
          style={{ width: 72, height: 72 }}
        >
          <Text className="text-4xl">🏦</Text>
        </View>
        <Text className="text-text-primary text-3xl font-bold mb-2 tracking-tight">Agentic Bank</Text>
        <Text className="text-text-tertiary text-base text-center">Banking, reimagined with AI</Text>
      </View>

      {/* Value props */}
      <View className="flex-row flex-wrap gap-3 justify-center py-6">
        {VALUE_PROPS.map((vp) => (
          <View
            key={vp.label}
            className="flex-row items-center gap-2 bg-surface-secondary border border-border-primary rounded-full py-2 px-3.5"
          >
            <Text className="text-base">{vp.icon}</Text>
            <Text className="text-text-secondary text-sm font-medium">{vp.label}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View className="gap-3">
        <TouchableOpacity
          className="bg-brand-default py-4 rounded-2xl items-center"
          onPress={() => router.push('/(auth)/register')}
        >
          <Text className="text-white text-base font-semibold">Open a free account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="py-4 rounded-2xl items-center border border-border-primary"
          onPress={() => router.push('/(auth)/login')}
        >
          <Text className="text-text-secondary text-base">Sign in</Text>
        </TouchableOpacity>

        <Text className="text-text-tertiary text-xs text-center leading-4 mt-1">
          By continuing you agree to our Terms of Service.{'\n'}
          Agentic Bank is a demo product. Not a real bank.
        </Text>
      </View>
    </SafeAreaView>
  );
}
