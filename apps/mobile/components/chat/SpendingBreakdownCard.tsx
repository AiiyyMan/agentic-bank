import { View, Text } from 'react-native';

interface CategoryItem {
  name: string;
  amount: number;
  percent: number;
  icon?: string;
}

interface SpendingBreakdownCardProps {
  period: string;
  total: number;
  categories: CategoryItem[];
}

const CATEGORY_COLORS = [
  'bg-brand-500',
  'bg-blue-500',
  'bg-orange-500',
  'bg-purple-500',
  'bg-success-500',
  'bg-warning-500',
];

export function SpendingBreakdownCard({ period, total, categories }: SpendingBreakdownCardProps) {
  const safeTotal = total ?? 0;
  const safeCategories = categories ?? [];

  return (
    <View className="bg-surface-primary border border-border-primary rounded-2xl p-4 my-2 mx-1">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-text-primary font-semibold text-base">Spending</Text>
        <Text className="text-text-tertiary text-xs">{period}</Text>
      </View>

      <Text className="text-text-primary text-2xl font-bold mb-3">
        £{safeTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
      </Text>

      {/* Stacked bar */}
      <View className="h-3 rounded-full overflow-hidden flex-row mb-4">
        {safeCategories.map((cat, i) => (
          <View
            key={cat.name}
            className={`h-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
            style={{ width: `${cat.percent}%` }}
          />
        ))}
      </View>

      {/* Category breakdown */}
      {safeCategories.map((cat, i) => (
        <View key={cat.name} className="flex-row items-center justify-between py-1.5">
          <View className="flex-row items-center flex-1">
            <View className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} mr-2`} />
            <Text className="text-text-secondary text-sm">{cat.icon || ''} {formatCategoryName(cat.name)}</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-text-primary text-sm font-medium mr-2">
              £{cat.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </Text>
            <Text className="text-text-tertiary text-xs w-10 text-right">{cat.percent}%</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function formatCategoryName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}
