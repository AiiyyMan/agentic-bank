import { View, Text } from 'react-native';

interface StandingOrderCardProps {
  id: string;
  beneficiaryName: string;
  amount: number;
  frequency: string;
  nextDate: string;
  status: string;
  reference?: string;
}

function statusStyle(status: string): string {
  switch (status) {
    case 'active': return 'text-status-success-text bg-status-success-subtle';
    case 'cancelled': return 'text-status-error-text bg-status-error-subtle';
    case 'paused': return 'text-status-warning-text bg-status-warning-subtle';
    default: return 'text-text-tertiary bg-surface-secondary';
  }
}

function frequencyLabel(frequency: string): string {
  switch (frequency) {
    case 'weekly': return 'Weekly';
    case 'monthly': return 'Monthly';
    default: return frequency.charAt(0).toUpperCase() + frequency.slice(1);
  }
}

export function StandingOrderCard({
  beneficiaryName,
  amount,
  frequency,
  nextDate,
  status,
  reference,
}: StandingOrderCardProps) {
  const formattedAmount = `£${amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const formattedDate = (() => {
    try {
      return new Date(nextDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch {
      return nextDate;
    }
  })();

  return (
    <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
      {/* Header row */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <Text className="text-xl mr-2">🔄</Text>
          <Text className="text-text-primary font-semibold text-base flex-1" numberOfLines={1}>
            {beneficiaryName}
          </Text>
        </View>
        <View className={`px-2 py-0.5 rounded-full ${statusStyle(status)}`}>
          <Text className={`text-xs font-medium capitalize ${statusStyle(status)}`}>
            {status}
          </Text>
        </View>
      </View>

      {/* Amount + frequency */}
      <View className="flex-row items-baseline mb-3">
        <Text className="text-text-primary text-2xl font-bold mr-2">{formattedAmount}</Text>
        <Text className="text-text-tertiary text-sm">{frequencyLabel(frequency)}</Text>
      </View>

      {/* Details */}
      <View className="bg-surface-secondary rounded-xl p-3 gap-2">
        <View className="flex-row justify-between">
          <Text className="text-text-tertiary text-sm">Next run</Text>
          <Text className="text-text-primary text-sm font-medium">{formattedDate}</Text>
        </View>
        {reference ? (
          <View className="flex-row justify-between">
            <Text className="text-text-tertiary text-sm">Reference</Text>
            <Text className="text-text-primary text-sm font-medium">{reference}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
