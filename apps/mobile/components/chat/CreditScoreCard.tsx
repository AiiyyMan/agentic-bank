import { View, Text } from 'react-native';

interface CreditScoreCardProps {
  score: number;
  rating: 'poor' | 'fair' | 'good' | 'excellent';
  factors?: {
    positive: string[];
    improve: string[];
  };
  lastUpdated?: string;
}

const RATING_CONFIG = {
  poor: { color: 'text-status-error', bg: 'bg-status-error/10', label: 'Poor' },
  fair: { color: 'text-warning-500', bg: 'bg-warning-500/10', label: 'Fair' },
  good: { color: 'text-status-success', bg: 'bg-status-success/10', label: 'Good' },
  excellent: { color: 'text-brand-400', bg: 'bg-brand-500/10', label: 'Excellent' },
};

export function CreditScoreCard({ score, rating, factors, lastUpdated }: CreditScoreCardProps) {
  const config = RATING_CONFIG[rating] || RATING_CONFIG.fair;
  // Score out of 999 (UK credit score range)
  const progressPercent = Math.min(100, (score / 999) * 100);

  return (
    <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
      <Text className="text-text-primary font-semibold text-base mb-3">Credit Score</Text>

      {/* Score display */}
      <View className="items-center mb-4">
        <Text className="text-text-primary text-4xl font-bold">{score}</Text>
        <View className={`${config.bg} rounded-full px-3 py-1 mt-1`}>
          <Text className={`${config.color} text-sm font-medium`}>{config.label}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View className="h-2 bg-surface-secondary rounded-full overflow-hidden mb-4">
        <View
          className="h-full bg-brand-500 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </View>
      <View className="flex-row justify-between mb-4">
        <Text className="text-text-tertiary text-xs">0</Text>
        <Text className="text-text-tertiary text-xs">999</Text>
      </View>

      {/* Factors */}
      {factors && (
        <View className="bg-surface-secondary rounded-xl p-3">
          {factors.positive?.length > 0 && (
            <View className="mb-2">
              <Text className="text-status-success text-xs font-medium mb-1">Positive</Text>
              {factors.positive.map((f, i) => (
                <Text key={i} className="text-text-secondary text-sm">+ {f}</Text>
              ))}
            </View>
          )}
          {factors.improve?.length > 0 && (
            <View>
              <Text className="text-warning-500 text-xs font-medium mb-1">To improve</Text>
              {factors.improve.map((f, i) => (
                <Text key={i} className="text-text-secondary text-sm">- {f}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {lastUpdated && (
        <Text className="text-text-tertiary text-xs mt-2 text-center">
          Last updated {new Date(lastUpdated).toLocaleDateString('en-GB')}
        </Text>
      )}
    </View>
  );
}
