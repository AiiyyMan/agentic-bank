import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface FlexPlanOption {
  months: number;
  apr: number;
  monthly_payment: number;
  total_cost: number;
}

interface FlexEligibleTransaction {
  id: string;
  merchant_name: string;
  amount: number;
  posted_at: string;
  options: FlexPlanOption[];
}

interface FlexOptionsCardProps {
  transactions: FlexEligibleTransaction[];
  onSelect?: (message: string) => void;
}

export function FlexOptionsCard({ transactions, onSelect }: FlexOptionsCardProps) {
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);

  const selectedTx = transactions.find((t) => t.id === selectedTxId);

  if (transactions.length === 0) {
    return (
      <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
        <Text className="text-text-secondary text-sm text-center">
          No transactions eligible for Flex
        </Text>
      </View>
    );
  }

  const handleConfirm = () => {
    if (!selectedTx || !selectedMonths || !onSelect) return;
    const option = selectedTx.options.find((o) => o.months === selectedMonths);
    if (!option) return;
    onSelect(
      `Flex ${selectedTx.merchant_name} £${selectedTx.amount.toFixed(2)} over ${selectedMonths} months at ${option.apr}% APR`,
    );
  };

  return (
    <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
      <View className="flex-row items-center mb-3">
        <Text className="text-lg mr-2">📦</Text>
        <Text className="text-text-primary font-semibold text-base">Flex a Purchase</Text>
      </View>

      {/* Transaction picker */}
      <Text className="text-text-tertiary text-xs font-medium uppercase mb-2">Choose transaction</Text>
      {transactions.map((tx) => (
        <TouchableOpacity
          key={tx.id}
          onPress={() => {
            setSelectedTxId(tx.id);
            setSelectedMonths(null);
          }}
          className={`flex-row items-center justify-between px-3 py-2.5 rounded-xl mb-1.5 border ${
            selectedTxId === tx.id
              ? 'border-brand-default bg-brand-default/10'
              : 'border-border-primary bg-surface-secondary'
          }`}
        >
          <View className="flex-1">
            <Text className="text-text-primary font-medium text-sm">{tx.merchant_name}</Text>
            <Text className="text-text-tertiary text-xs">
              {new Date(tx.posted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <Text className="text-text-primary font-semibold text-sm ml-2">
            £{tx.amount.toFixed(2)}
          </Text>
        </TouchableOpacity>
      ))}

      {/* Plan picker */}
      {selectedTx && (
        <View className="mt-3">
          <Text className="text-text-tertiary text-xs font-medium uppercase mb-2">Choose plan</Text>
          <View className="flex-row flex-wrap gap-2">
            {selectedTx.options.map((opt) => (
              <TouchableOpacity
                key={opt.months}
                onPress={() => setSelectedMonths(opt.months)}
                className={`flex-1 min-w-[30%] px-2 py-2.5 rounded-xl border items-center ${
                  selectedMonths === opt.months
                    ? 'border-brand-default bg-brand-default/10'
                    : 'border-border-primary bg-surface-secondary'
                }`}
              >
                <Text className="text-text-primary font-semibold text-sm">{opt.months}mo</Text>
                <Text className="text-text-secondary text-xs">£{opt.monthly_payment.toFixed(2)}/mo</Text>
                <Text className="text-text-tertiary text-xs">{opt.apr}% APR</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Summary + confirm */}
      {selectedTx && selectedMonths && (() => {
        const opt = selectedTx.options.find((o) => o.months === selectedMonths)!;
        return (
          <View className="mt-3 bg-surface-secondary rounded-xl p-3">
            <View className="flex-row justify-between py-0.5">
              <Text className="text-text-tertiary text-sm">Total cost</Text>
              <Text className="text-text-primary text-sm font-medium">£{opt.total_cost.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between py-0.5">
              <Text className="text-text-tertiary text-sm">Interest</Text>
              <Text className="text-text-primary text-sm font-medium">
                £{(opt.total_cost - selectedTx.amount).toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleConfirm}
              className="mt-3 bg-brand-default rounded-xl py-2.5 items-center"
            >
              <Text className="text-white font-semibold text-sm">Flex this purchase</Text>
            </TouchableOpacity>
          </View>
        );
      })()}
    </View>
  );
}
