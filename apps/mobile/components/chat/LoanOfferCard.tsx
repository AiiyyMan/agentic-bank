import { View, Text } from 'react-native';

interface LoanOfferCardProps {
  amount: string;
  rate: string;
  term: number;
  monthlyPayment: string;
}

export function LoanOfferCard({ amount, rate, term, monthlyPayment }: LoanOfferCardProps) {
  return (
    <View className="bg-surface-primary border border-status-success-default rounded-2xl p-4 my-2 mx-1">
      <Text className="text-status-success text-xs font-semibold uppercase mb-3">Loan Offer</Text>

      <View className="items-center mb-4">
        <Text className="text-text-primary text-3xl font-bold">
          £{parseFloat(amount).toLocaleString()}
        </Text>
      </View>

      <View className="flex-row justify-around">
        <View className="items-center">
          <Text className="text-text-tertiary text-xs mb-1">APR</Text>
          <Text className="text-text-primary text-base font-semibold">{rate}%</Text>
        </View>
        <View className="items-center">
          <Text className="text-text-tertiary text-xs mb-1">Term</Text>
          <Text className="text-text-primary text-base font-semibold">{term} months</Text>
        </View>
        <View className="items-center">
          <Text className="text-text-tertiary text-xs mb-1">Monthly</Text>
          <Text className="text-text-primary text-base font-semibold">£{parseFloat(monthlyPayment).toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}
