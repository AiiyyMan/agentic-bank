import { View, Text } from 'react-native';

interface BalanceCardProps {
  balance: number | string;
  currency: string;
  accountName: string;
  accountNumber?: string;
}

export function BalanceCard({ balance, currency, accountName, accountNumber }: BalanceCardProps) {
  const formattedBalance = `£${parseFloat(String(balance)).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <View className="bg-surface-raised border border-border-default rounded-2xl p-5 my-2 mx-1 shadow-sm">
      <Text className="text-text-tertiary text-sm font-medium mb-1">Available Balance</Text>
      <Text className="text-brand-default text-3xl font-bold mb-3">{formattedBalance}</Text>
      <View className="flex-row justify-between">
        <Text className="text-text-secondary text-sm">{accountName}</Text>
        {accountNumber && (
          <Text className="text-text-tertiary text-sm">{accountNumber}</Text>
        )}
      </View>
    </View>
  );
}
