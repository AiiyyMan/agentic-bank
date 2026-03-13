import { View, Text } from 'react-native';

interface Transaction {
  amount: string;
  currency?: string;
  direction: 'credit' | 'debit';
  type?: string;
  description?: string;
  date: string;
  balance_after?: string;
}

interface TransactionListCardProps {
  transactions: Transaction[];
}

export function TransactionListCard({ transactions }: TransactionListCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const formatAmount = (amount: string, direction: string) => {
    const prefix = direction === 'credit' ? '+' : '-';
    return `${prefix}£${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
      <Text className="text-text-tertiary text-xs font-medium uppercase mb-3">Recent Transactions</Text>
      {transactions.map((tx, index) => (
        <View
          key={index}
          className={`flex-row justify-between items-center py-2.5 ${index < transactions.length - 1 ? 'border-b border-border-primary' : ''}`}
        >
          <View className="flex-1">
            <Text className="text-text-primary text-sm font-medium">
              {tx.description || tx.type || 'Transaction'}
            </Text>
            <Text className="text-text-tertiary text-xs mt-0.5">{formatDate(tx.date)}</Text>
          </View>
          <Text
            className={`text-sm font-semibold ${tx.direction === 'credit' ? 'text-money-positive' : 'text-money-negative'}`}
          >
            {formatAmount(tx.amount, tx.direction)}
          </Text>
        </View>
      ))}
    </View>
  );
}
