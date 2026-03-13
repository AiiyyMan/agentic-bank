import { View, Text } from 'react-native';

interface PotItem {
  id: string;
  name: string;
  balance: number;
  goal: number | null;
  emoji: string | null;
  progress_percent: number | null;
}

interface PotStatusCardProps {
  pots: PotItem[];
}

export function PotStatusCard({ pots }: PotStatusCardProps) {
  if (!pots || pots.length === 0) {
    return (
      <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
        <Text className="text-text-secondary text-sm text-center">No savings pots yet</Text>
      </View>
    );
  }

  return (
    <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
      <Text className="text-text-primary font-semibold text-base mb-3">Savings Pots</Text>
      {pots.map((pot, index) => (
        <View key={pot.id || index} className={`${index > 0 ? 'mt-3 pt-3 border-t border-border-primary' : ''}`}>
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center flex-1">
              <Text className="text-lg mr-2">{pot.emoji || '🏦'}</Text>
              <Text className="text-text-primary font-medium text-sm">{pot.name}</Text>
            </View>
            <Text className="text-text-primary font-semibold text-sm">
              £{pot.balance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          {pot.goal != null && pot.goal > 0 && (
            <View className="mt-1">
              <View className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                <View
                  className="h-full bg-brand-500 rounded-full"
                  style={{ width: `${Math.min(100, pot.progress_percent ?? 0)}%` }}
                />
              </View>
              <Text className="text-text-tertiary text-xs mt-1">
                {pot.progress_percent ?? 0}% of £{pot.goal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
