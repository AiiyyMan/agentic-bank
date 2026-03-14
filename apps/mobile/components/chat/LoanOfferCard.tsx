import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface LoanOfferCardProps {
  amount: string;
  rate: string;
  term: number;
  monthlyPayment: string;
  minAmount?: number;
  maxAmount?: number;
  step?: number;
  onApply?: (selectedAmount: number) => void;
}

function calculateEMI(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) return principal / months;
  const r = annualRate / 100 / 12;
  return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
}

export function LoanOfferCard({ amount, rate, term, monthlyPayment, minAmount, maxAmount, step = 100, onApply }: LoanOfferCardProps) {
  const baseAmount = parseFloat(amount);
  const [selectedAmount, setSelectedAmount] = useState(baseAmount);
  const effectiveMin = minAmount ?? 100;
  const effectiveMax = maxAmount ?? baseAmount;
  const annualRate = parseFloat(rate);
  const currentMonthly = calculateEMI(selectedAmount, annualRate, term);
  const isInteractive = (minAmount !== undefined || maxAmount !== undefined) && effectiveMax > effectiveMin;

  const decrease = () => setSelectedAmount(a => Math.max(effectiveMin, a - step));
  const increase = () => setSelectedAmount(a => Math.min(effectiveMax, a + step));

  return (
    <View className="bg-surface-primary border border-status-success-default rounded-2xl p-4 my-2 mx-1">
      <Text className="text-status-success text-xs font-semibold uppercase mb-3">Loan Offer</Text>

      {/* Amount display with stepper */}
      <View className="items-center mb-4">
        {isInteractive ? (
          <View className="flex-row items-center gap-4">
            <TouchableOpacity
              onPress={decrease}
              disabled={selectedAmount <= effectiveMin}
              className={`w-9 h-9 rounded-full border items-center justify-center ${selectedAmount <= effectiveMin ? 'border-border-primary opacity-40' : 'border-brand-default'}`}
            >
              <Text className="text-brand-default text-xl font-light leading-none">−</Text>
            </TouchableOpacity>
            <Text className="text-text-primary text-3xl font-bold min-w-[120px] text-center">
              £{selectedAmount.toLocaleString('en-GB')}
            </Text>
            <TouchableOpacity
              onPress={increase}
              disabled={selectedAmount >= effectiveMax}
              className={`w-9 h-9 rounded-full border items-center justify-center ${selectedAmount >= effectiveMax ? 'border-border-primary opacity-40' : 'border-brand-default'}`}
            >
              <Text className="text-brand-default text-xl font-light leading-none">+</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text className="text-text-primary text-3xl font-bold">
            £{selectedAmount.toLocaleString('en-GB')}
          </Text>
        )}
        {isInteractive && (
          <Text className="text-text-tertiary text-xs mt-1">
            £{effectiveMin.toLocaleString('en-GB')} – £{effectiveMax.toLocaleString('en-GB')} in £{step} steps
          </Text>
        )}
      </View>

      {/* Stats row */}
      <View className="flex-row justify-around mb-4">
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
          <Text className="text-text-primary text-base font-semibold">
            £{isInteractive ? currentMonthly.toFixed(2) : parseFloat(monthlyPayment).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Apply button */}
      {onApply && (
        <TouchableOpacity
          onPress={() => onApply(selectedAmount)}
          className="bg-brand-default rounded-xl py-3 items-center"
        >
          <Text className="text-white text-sm font-semibold">Apply for £{selectedAmount.toLocaleString('en-GB')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
