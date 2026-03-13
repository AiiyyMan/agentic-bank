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
    <View className="bg-brand-default rounded-2xl p-5 my-2 mx-1">
      <Text className="text-white/70 text-sm font-medium mb-1">Available Balance</Text>
      <Text className="text-white text-3xl font-bold mb-3">{formattedBalance}</Text>
      <View className="flex-row justify-between">
        <Text className="text-white/80 text-sm">{accountName}</Text>
        {accountNumber && (
          <Text className="text-white/60 text-sm">{accountNumber}</Text>
        )}
      </View>
    </View>
  );
}
