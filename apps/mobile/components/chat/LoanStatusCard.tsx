import { View, Text } from 'react-native';

interface LoanStatusCardProps {
  principal: string;
  remaining: string;
  rate: string;
  monthlyPayment: string;
  nextDate: string;
  status: string;
  paymentsMade?: number;
  termMonths?: number;
  payoffDate?: string;
}

export function LoanStatusCard({
  principal,
  remaining,
  rate,
  monthlyPayment,
  nextDate,
  status,
  paymentsMade,
  termMonths,
  payoffDate,
}: LoanStatusCardProps) {
  const principalNum = parseFloat(principal);
  const progress = principalNum > 0 ? 1 - parseFloat(remaining) / principalNum : 0;

  return (
    <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-text-tertiary text-xs font-medium uppercase">Active Loan</Text>
        <View className={`px-2 py-0.5 rounded-full overflow-hidden ${status === 'active' ? 'bg-status-success/15' : 'bg-surface-secondary'}`}>
          <Text className={`text-xs capitalize ${status === 'active' ? 'text-status-success' : 'text-text-tertiary'}`}>
            {status}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View className="h-1.5 bg-border-primary rounded-full overflow-hidden mb-2">
        <View
          className="h-full bg-brand-default rounded-full"
          style={{ width: `${Math.max(progress * 100, 2)}%` }}
        />
      </View>
      <Text className="text-text-tertiary text-xs mb-3">
        £{parseFloat(remaining).toFixed(2)} remaining of £{parseFloat(principal).toFixed(2)}
      </Text>

      <View>
        <View className="flex-row justify-between py-1.5">
          <Text className="text-text-tertiary text-sm">Monthly Payment</Text>
          <Text className="text-text-primary text-sm font-medium">£{parseFloat(monthlyPayment).toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between py-1.5">
          <Text className="text-text-tertiary text-sm">Interest Rate</Text>
          <Text className="text-text-primary text-sm font-medium">{rate}% APR</Text>
        </View>
        <View className="flex-row justify-between py-1.5">
          <Text className="text-text-tertiary text-sm">Next Payment</Text>
          <Text className="text-text-primary text-sm font-medium">{nextDate}</Text>
        </View>
        {paymentsMade !== undefined && termMonths !== undefined && (
          <View className="flex-row justify-between py-1.5">
            <Text className="text-text-tertiary text-sm">Payments Made</Text>
            <Text className="text-text-primary text-sm font-medium">{paymentsMade} of {termMonths}</Text>
          </View>
        )}
        {payoffDate && (
          <View className="flex-row justify-between py-1.5">
            <Text className="text-text-tertiary text-sm">Est. Payoff</Text>
            <Text className="text-text-primary text-sm font-medium">{new Date(payoffDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

