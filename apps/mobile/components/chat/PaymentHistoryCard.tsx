import { View, Text } from 'react-native';

interface Payment {
  id: string;
  beneficiary_name: string;
  amount: number;
  status: string;
  created_at: string;
  reference?: string;
}

interface PaymentHistoryCardProps {
  payments: Payment[];
  summary?: {
    total_sent: number;
    payment_count: number;
  };
}

export function PaymentHistoryCard({ payments = [], summary }: PaymentHistoryCardProps) {
  return (
    <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
      <Text className="text-text-primary font-semibold text-base mb-3">Payment History</Text>

      {summary && (
        <View className="bg-surface-secondary rounded-xl p-3 mb-3 flex-row justify-between">
          <View>
            <Text className="text-text-tertiary text-xs">Total Sent</Text>
            <Text className="text-text-primary font-bold text-lg">
              £{summary.total_sent.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-text-tertiary text-xs">Payments</Text>
            <Text className="text-text-primary font-bold text-lg">{summary.payment_count}</Text>
          </View>
        </View>
      )}

      {payments.map((payment, index) => (
        <View key={payment.id || index} className={`flex-row items-center py-2 ${
          index > 0 ? 'border-t border-border-primary' : ''
        }`}>
          <View className="flex-1">
            <Text className="text-text-primary text-sm font-medium">{payment.beneficiary_name}</Text>
            <Text className="text-text-tertiary text-xs">
              {new Date(payment.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
              {payment.reference ? ` · ${payment.reference}` : ''}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-text-primary text-sm font-medium">
              £{payment.amount.toFixed(2)}
            </Text>
            <Text className={`text-xs ${
              payment.status === 'completed' ? 'text-status-success' : 'text-text-tertiary'
            }`}>
              {payment.status}
            </Text>
          </View>
        </View>
      ))}

      {payments.length === 0 && (
        <Text className="text-text-secondary text-sm text-center py-2">No payments found</Text>
      )}
    </View>
  );
}
