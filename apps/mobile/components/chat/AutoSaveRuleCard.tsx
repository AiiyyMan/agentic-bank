import { View, Text, TouchableOpacity } from 'react-native';

interface AutoSaveRuleCardProps {
  ruleName: string;
  description: string;
  targetPot?: string;
  isActive: boolean;
  savedThisMonth?: number;
  onToggle?: () => void;
}

export function AutoSaveRuleCard({
  ruleName,
  description,
  targetPot,
  isActive,
  savedThisMonth,
  onToggle,
}: AutoSaveRuleCardProps) {
  const formattedSaved =
    savedThisMonth !== undefined
      ? `£${savedThisMonth.toFixed(2)}`
      : null;

  return (
    <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
      {/* Header row */}
      <View className="flex-row items-start justify-between mb-3 gap-3">
        <View className="flex-1">
          <Text className="text-text-primary text-base font-semibold mb-1">{ruleName}</Text>
          <Text className="text-text-tertiary text-sm leading-5">{description}</Text>
        </View>

        {/* Toggle */}
        <TouchableOpacity
          className={`w-11 h-6 rounded-full justify-center px-0.5 mt-0.5 ${isActive ? 'bg-brand-default' : 'bg-border-primary'}`}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <View
            className={`w-5 h-5 rounded-full bg-white ${isActive ? 'self-end' : 'self-start'}`}
          />
        </TouchableOpacity>
      </View>

      {/* Meta row */}
      <View className="flex-row items-center gap-2.5 mb-3 flex-wrap">
        {targetPot ? (
          <View className="bg-surface-secondary border border-border-primary px-2.5 py-1 rounded-full">
            <Text className="text-brand-text text-xs font-medium">→ {targetPot}</Text>
          </View>
        ) : null}

        {formattedSaved ? (
          <View className="flex-row items-center bg-surface-secondary border border-border-primary px-2.5 py-1 rounded-full gap-1.5">
            <Text className="text-text-tertiary text-xs">This month</Text>
            <Text className="text-money-positive text-xs font-semibold">{formattedSaved}</Text>
          </View>
        ) : null}
      </View>

      {/* Status badge */}
      <View
        className={`flex-row items-center gap-1.5 self-start px-2.5 py-1 rounded-full ${isActive ? 'bg-status-success-subtle' : 'bg-surface-secondary'}`}
      >
        <View
          className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-status-success' : 'bg-text-tertiary'}`}
        />
        <Text
          className={`text-xs font-medium ${isActive ? 'text-status-success-text' : 'text-text-tertiary'}`}
        >
          {isActive ? 'Active' : 'Paused'}
        </Text>
      </View>
    </View>
  );
}
