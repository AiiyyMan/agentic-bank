import { View, Text } from 'react-native';

interface FlexPlan {
  id: string;
  merchant_name: string;
  original_amount: number;
  remaining: number;
  monthly_payment: number;
  plan_months: number;
  payments_made: number;
  apr: number;
  status: string;
}

interface FlexPlanCardProps {
  plans?: FlexPlan[];
  // Single plan mode (from flex_purchase result)
  merchantName?: string;
  originalAmount?: number;
  monthlyPayment?: number;
  planMonths?: number;
  apr?: number;
}

export function FlexPlanCard(props: FlexPlanCardProps) {
  // Single plan display
  if (props.merchantName) {
    return (
      <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
        <View className="flex-row items-center mb-3">
          <Text className="text-lg mr-2">📦</Text>
          <Text className="text-text-primary font-semibold text-base">Flex Plan</Text>
        </View>
        <View className="bg-surface-secondary rounded-xl p-3">
          <Text className="text-text-primary font-medium mb-2">{props.merchantName}</Text>
          <View className="flex-row justify-between py-1">
            <Text className="text-text-tertiary text-sm">Original</Text>
            <Text className="text-text-primary text-sm font-medium">
              £{(props.originalAmount ?? 0).toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between py-1">
            <Text className="text-text-tertiary text-sm">Monthly</Text>
            <Text className="text-text-primary text-sm font-medium">
              £{(props.monthlyPayment ?? 0).toFixed(2)} x {props.planMonths}
            </Text>
          </View>
          <View className="flex-row justify-between py-1">
            <Text className="text-text-tertiary text-sm">APR</Text>
            <Text className="text-text-primary text-sm font-medium">{props.apr ?? 0}%</Text>
          </View>
        </View>
      </View>
    );
  }

  // Multi-plan list
  const plans = props.plans || [];
  if (plans.length === 0) {
    return (
      <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
        <Text className="text-text-secondary text-sm text-center">No active Flex plans</Text>
      </View>
    );
  }

  return (
    <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
      <Text className="text-text-primary font-semibold text-base mb-3">Flex Plans</Text>
      {plans.map((plan, index) => {
        const progress = plan.plan_months > 0
          ? Math.round((plan.payments_made / plan.plan_months) * 100)
          : 0;
        return (
          <View key={plan.id || index} className={`${index > 0 ? 'mt-3 pt-3 border-t border-border-primary' : ''}`}>
            <View className="flex-row justify-between mb-1">
              <Text className="text-text-primary font-medium text-sm">{plan.merchant_name}</Text>
              <Text className="text-text-primary text-sm font-semibold">
                £{plan.remaining.toFixed(2)}
              </Text>
            </View>
            <Text className="text-text-tertiary text-xs mb-1">
              £{plan.monthly_payment.toFixed(2)}/mo · {plan.payments_made}/{plan.plan_months} paid
            </Text>
            <View className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
              <View
                className="h-full bg-brand-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
