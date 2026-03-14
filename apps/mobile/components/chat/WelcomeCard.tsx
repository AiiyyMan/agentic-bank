import { View, Text, TouchableOpacity } from 'react-native';

interface WelcomeCardProps {
  displayName: string;
  greeting: string;
  onAction?: (message: string) => void;
}

const VALUE_PROPS = [
  { emoji: '💰', label: 'Check balance & spending insights', action: 'Show me my balance' },
  { emoji: '💸', label: 'Send money to friends & family', action: 'I want to send money' },
  { emoji: '🏦', label: 'Create savings pots for goals', action: 'Help me create a savings pot' },
  { emoji: '📊', label: 'Apply for loans & Flex plans', action: 'Tell me about loans' },
];

export function WelcomeCard({ displayName, greeting, onAction }: WelcomeCardProps) {
  return (
    <View className="bg-surface-raised border border-brand-default/20 rounded-2xl p-5 my-2 mx-1">
      {/* Header */}
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-10 h-10 rounded-full bg-brand-default items-center justify-center">
          <Text className="text-white text-lg font-bold">A</Text>
        </View>
        <View className="flex-1">
          <Text className="text-text-primary font-semibold text-base">
            Welcome{displayName ? `, ${displayName}` : ''}!
          </Text>
          <Text className="text-text-tertiary text-xs">Your AI banking assistant</Text>
        </View>
      </View>

      {/* Greeting text */}
      <Text className="text-text-secondary text-sm leading-5 mb-4">{greeting}</Text>

      {/* Value prop bullets */}
      <View className="gap-2 mb-4">
        {VALUE_PROPS.map((vp) => (
          <TouchableOpacity
            key={vp.action}
            onPress={() => onAction?.(vp.action)}
            className="flex-row items-center gap-3 bg-surface-sunken rounded-xl px-3 py-2.5 active:opacity-70"
            disabled={!onAction}
          >
            <Text className="text-lg">{vp.emoji}</Text>
            <Text className="text-text-primary text-sm flex-1">{vp.label}</Text>
            {onAction && <Text className="text-brand-default text-sm">→</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* CTA */}
      {onAction && (
        <TouchableOpacity
          onPress={() => onAction("Let's get started")}
          className="bg-brand-default rounded-xl py-3 items-center"
        >
          <Text className="text-white text-sm font-semibold">Let's get started →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
